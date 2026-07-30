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

  // Walk back until we land inside the node's retention window. RPC rejects a
  // startLedger that has already been pruned, and the window size varies by
  // provider, so probe rather than assume.
  let events: RawEvent[] = [];
  for (const back of [100_000, 40_000, 10_000, 2_000]) {
    try {
      const res = await call("getEvents", {
        startLedger: Math.max(1, latest - back),
        filters,
        pagination: { limit },
      });
      events = res.events ?? [];
      break;
    } catch {
      // Pruned that far back — try a shorter window.
    }
  }

  return events.map((e) => ({
    hash: e.txHash,
    kind: decodeTopic(e.topic?.[0]),
    ledger: Number(e.ledger),
    ts: Math.floor(new Date(e.ledgerClosedAt).getTime() / 1000),
  }));
}

interface RawEvent {
  txHash: string;
  ledger: number;
  ledgerClosedAt: string;
  topic?: string[];
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
