// Transaction receipts.
//
// Two independent sources, because they answer different questions:
//
//  1. `recordTx` / `readTxLog` — a local receipt written the moment a write
//     confirms. Instant, but only covers writes made in this browser.
//  2. `fetchOnChainTxs` — reads the contract's own events back off the chain,
//     so it shows every action by every member (and the keeper), each with the
//     transaction hash that produced it. This is the one a third party can
//     verify independently; the local log is just a fast path.
import { scValToNative, xdr } from "@stellar/stellar-sdk";
import { NETWORK, RPC_URL } from "./config";

export interface TxRecord {
  hash: string;
  method: string;
  contractId: string;
  address: string;
  ts: number;
}

const KEY = "plexa_txlog_v1";
const MAX = 200;

/** Block-explorer link for a transaction hash. */
export function explorerTxUrl(hash: string): string {
  const net = NETWORK === "public" || NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/tx/${hash}`;
}

/** Block-explorer link for a contract id. */
export function explorerContractUrl(id: string): string {
  const net = NETWORK === "public" || NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/contract/${id}`;
}

/**
 * Stellar Lab link for a contract id.
 *
 * Stellar Expert serves from its own index, which lags the ledger by a few
 * minutes — a freshly deployed contract 404s there even though it exists on
 * chain. Lab reads live from RPC, so it resolves immediately.
 */
export function labContractUrl(id: string): string {
  const net = NETWORK === "public" || NETWORK === "mainnet" ? "public" : "testnet";
  return `https://lab.stellar.org/r/${net}/contract/${id}`;
}

export function readTxLog(filter?: { contractId?: string; address?: string }): TxRecord[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "[]") as TxRecord[];
    return all.filter(
      (r) =>
        (!filter?.contractId || r.contractId === filter.contractId) &&
        (!filter?.address || r.address === filter.address)
    );
  } catch {
    return [];
  }
}

export function recordTx(r: Omit<TxRecord, "ts">): void {
  try {
    const all = readTxLog();
    all.unshift({ ...r, ts: Math.floor(Date.now() / 1000) });
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("plexa:tx", { detail: r.hash }));
  } catch {
    // Storage disabled/full — receipts are a convenience, never block the write.
  }
}

export interface ChainTx {
  hash: string;
  /** Contract event topic, e.g. "resolved", "contrib", "default". */
  kind: string;
  ledger: number;
  ts: number;
}

/**
 * Read a contract's emitted events straight from Soroban RPC and pair each
 * with its transaction hash.
 *
 * Note: RPC only retains a rolling window of ledgers (roughly a week on
 * testnet). Anything older has to come from an archive or Horizon — so treat
 * an empty result as "outside the retention window", not "never happened".
 */
export async function fetchOnChainTxs(contractId: string, limit = 100): Promise<ChainTx[]> {
  const call = async (method: string, params: unknown) => {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await res.json();
    if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
    return json.result;
  };

  const latest = Number((await call("getLatestLedger", {})).sequence);
  const filters = [{ type: "contract", contractIds: [contractId] }];

  // Scan newest-first in fixed chunks.
  //
  // getEvents scans forward from startLedger for a bounded number of ledgers
  // and then stops, so a single wide query starting at the retention edge just
  // returns nothing — it exhausts its budget on empty ledgers before reaching
  // any activity. Chunking backwards from the head puts the most relevant
  // events first and lets us stop as soon as we have enough. Chunks wider than
  // ~8k ledgers get their results truncated by the server, so keep them small.
  const CHUNK = 8_000;
  const MAX_CHUNKS = 8;

  const events: RawEvent[] = [];
  let end = latest;
  let oldest = 1;

  for (let i = 0; i < MAX_CHUNKS && events.length < limit; i++) {
    const start = Math.max(1, end - CHUNK);
    let res;
    try {
      res = await call("getEvents", {
        startLedger: start,
        endLedger: end,
        filters,
        pagination: { limit: 200 },
      });
    } catch {
      break; // Pruned or rejected — keep whatever we already have.
    }
    oldest = Number(res.oldestLedger ?? 1);
    events.push(...((res.events ?? []) as RawEvent[]));
    if (start <= oldest) break; // Hit the retention edge.
    end = start - 1;
  }

  return events
    .map((e) => ({
      hash: e.txHash,
      kind: decodeTopic(e.topic?.[0]),
      ledger: Number(e.ledger),
      ts: Math.floor(new Date(e.ledgerClosedAt).getTime() / 1000),
    }))
    .sort((a, b) => b.ledger - a.ledger)
    .slice(0, limit);
}

interface RawEvent {
  txHash: string;
  ledger: number;
  ledgerClosedAt: string;
  topic?: string[];
}

/** Ledger-timestamp slack when pairing a history entry with its event. */
const TS_TOLERANCE = 2;

export interface TxIndex {
  /** Transaction hash that produced this history entry, or null if unknown. */
  find(kind: string, ts: number): string | null;
  size: number;
}

/**
 * Pair on-chain history entries with the transactions that produced them.
 *
 * The contract cannot know its own transaction hash, so `history` has no hash
 * field. But every `log_history` call is accompanied by an event carrying the
 * same symbol, and both are stamped with the including ledger's close time —
 * so (kind, timestamp) identifies the transaction.
 *
 * Returns null rather than a guess when nothing matches: a wrong hash is worse
 * than no hash, since the whole point is independent verification.
 */
export function buildTxIndex(events: ChainTx[]): TxIndex {
  const byKindTs = new Map<string, string>();
  const byTs = new Map<number, Set<string>>();
  for (const e of events) {
    byKindTs.set(`${e.kind}:${e.ts}`, e.hash);
    if (!byTs.has(e.ts)) byTs.set(e.ts, new Set());
    byTs.get(e.ts)!.add(e.hash);
  }

  return {
    size: events.length,
    find(kind, ts) {
      for (let d = 0; d <= TS_TOLERANCE; d++) {
        for (const t of d === 0 ? [ts] : [ts - d, ts + d]) {
          const hit = byKindTs.get(`${kind}:${t}`);
          if (hit) return hit;
        }
      }
      // Everything one transaction wrote shares its hash, so a single hash at
      // this timestamp is still the right answer even if the symbol differs.
      const sameLedger = byTs.get(ts);
      if (sameLedger?.size === 1) return [...sameLedger][0];
      return null;
    },
  };
}

/** First topic of a Plexa event is always a Symbol naming the action. */
function decodeTopic(b64?: string): string {
  if (!b64) return "event";
  try {
    const v = scValToNative(xdr.ScVal.fromXDR(b64, "base64"));
    return typeof v === "string" ? v : String(v);
  } catch {
    return "event";
  }
}
