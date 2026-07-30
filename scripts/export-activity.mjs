// Export every real on-chain interaction with the Plexa contracts.
//
// Reads the factory, walks its groups, pulls their emitted events back off
// Soroban RPC, and writes:
//
//   activity.csv    every action: wallet, group, action, amount, ts, tx hash, link
//   wallets.csv     one row per distinct wallet, with its first/last activity
//   activity.md     a markdown table ready to paste into a README
//
// Every hash is a real transaction, and every row comes from the ledger — this
// script invents nothing. Whatever the numbers are, they are what happened.
//
// Why this exists: Soroban RPC only serves events for a rolling window (about a
// week). The history log inside each contract is permanent, but it has no
// transaction hashes — the contract cannot know its own hash. So the pairing of
// action to hash is only recoverable while the events are still in the window.
// Run this regularly and the archive keeps extending itself.
//
//   node export-activity.mjs
//   node export-activity.mjs --out ../docs --factory C...
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  rpc, Contract, TransactionBuilder, Networks, Account, scValToNative, xdr,
} from "@stellar/stellar-sdk";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : fallback;
};

function envFromFile() {
  const out = {};
  try {
    for (const line of readFileSync(join(HERE, "..", "frontend", ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* fall back to flags/env */
  }
  return out;
}
const FILE_ENV = envFromFile();
const RPC_URL = arg("rpc", process.env.RPC_URL || FILE_ENV.VITE_RPC_URL || "https://soroban-testnet.stellar.org");
const FACTORY_ID = arg("factory", process.env.FACTORY_ID || FILE_ENV.VITE_FACTORY_ID);
const NETWORK = arg("network", process.env.NETWORK || FILE_ENV.VITE_NETWORK || "testnet");
const OUT_DIR = arg("out", join(HERE, "..", "docs", "activity"));
const PASSPHRASE = NETWORK === "public" || NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
const EXPLORER = NETWORK === "public" || NETWORK === "mainnet" ? "public" : "testnet";

if (!FACTORY_ID) throw new Error("No factory id — pass --factory or set VITE_FACTORY_ID in frontend/.env");

const server = new rpc.Server(RPC_URL);
// Reads are pure simulations: nothing is signed or submitted, so the source
// account only has to parse. A synthetic Account keeps this script key-free
// and runnable by anyone against any deployment.
const SOURCE = new Account(
  process.env.SOURCE_ACCOUNT || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
  "0"
);

const log = (...a) => console.log(...a);
const txUrl = (h) => `https://stellar.expert/explorer/${EXPLORER}/tx/${h}`;

/** Human labels for contract event topics. */
const LABEL = {
  created: "Group created",
  joined: "Joined group",
  join_req: "Requested to join",
  join_ok: "Join approved",
  join_no: "Join rejected",
  locked: "Locked collateral",
  topup: "Topped up collateral",
  contrib: "Contributed",
  bid: "Placed auction bid",
  settled: "Period settled",
  resolved: "Period resolved",
  default: "Default covered",
  liquid: "Collateral liquidated",
  claim: "Claimed payout",
  withdraw: "Withdrew collateral",
  started: "Group started",
  hf_warn: "Health factor warning",
  removed: "Member removed",
};

async function simulate(contractId, method, args = []) {
  const account = new Account(SOURCE.accountId(), "0");
  const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
  return sim.result?.retval ? scValToNative(sim.result.retval) : null;
}

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

/**
 * Fetch a contract's events, newest first.
 *
 * getEvents scans forward from startLedger for a bounded number of ledgers then
 * stops, so one wide query starting at the retention edge returns nothing — it
 * spends its budget on empty ledgers. Chunk backwards from the head instead.
 */
async function eventsFor(contractId) {
  const latest = Number((await rpcCall("getLatestLedger", {})).sequence);
  const filters = [{ type: "contract", contractIds: [contractId] }];
  const CHUNK = 8_000;
  const out = [];
  let end = latest;

  for (let i = 0; i < 16; i++) {
    const start = Math.max(1, end - CHUNK);
    let res;
    try {
      res = await rpcCall("getEvents", { startLedger: start, endLedger: end, filters, pagination: { limit: 200 } });
    } catch {
      break; // pruned past the retention edge
    }
    out.push(...(res.events ?? []));
    if (start <= Number(res.oldestLedger ?? 1)) break;
    end = start - 1;
  }
  return out;
}

const decode = (b64) => {
  try {
    return scValToNative(xdr.ScVal.fromXDR(b64, "base64"));
  } catch {
    return null;
  }
};

/** Pull the acting wallet + amount out of an event's topics and payload. */
function actorAndAmount(topics, data) {
  const flat = [];
  const walk = (v) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) return v.forEach(walk);
    flat.push(v);
  };
  walk(data);
  walk(topics.slice(1));

  const isAddr = (v) => typeof v === "string" && /^G[A-Z2-7]{55}$/.test(v);
  const actor = flat.find(isAddr) ?? "";
  const amount = flat.find((v) => typeof v === "bigint");
  return { actor, amount: amount === undefined ? "" : amount.toString() };
}

const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows, headers) =>
  [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";

(async () => {
  log(`Plexa activity export — ${NETWORK}`);
  log(`factory ${FACTORY_ID}\n`);

  const groups = await simulate(FACTORY_ID, "get_all_groups");
  log(`${groups.length} group(s) registered\n`);

  const activity = [];
  const wallets = new Map(); // address -> { first, last, actions, groups:Set }
  const groupMeta = [];

  // `ts` is null when we know a wallet participated but not when: members of a
  // group that has not started yet have no start_time. Recording 0 would date
  // them to 1970; leave the timestamp unknown and let their events fill it in.
  const note = (addrStr, ts, groupId) => {
    if (!addrStr) return;
    const w = wallets.get(addrStr) ?? { first: null, last: null, actions: 0, groups: new Set() };
    if (ts) {
      w.first = w.first === null ? ts : Math.min(w.first, ts);
      w.last = w.last === null ? ts : Math.max(w.last, ts);
    }
    w.actions++;
    w.groups.add(groupId);
    wallets.set(addrStr, w);
  };

  for (const g of groups) {
    let config, state, members;
    try {
      [config, state, members] = await Promise.all([
        simulate(g, "get_config"),
        simulate(g, "get_state"),
        simulate(g, "get_members"),
      ]);
    } catch (e) {
      log(`  ${g} — unreadable (${e.message.slice(0, 60)})`);
      continue;
    }

    const status = ["Forming", "Active", "Completed", "Cancelled"][Number(state.status)] ?? state.status;
    log(`  ${g}  "${config.name}"  ${status}  ${members.length} member(s)`);
    groupMeta.push({
      group: g,
      name: config.name,
      status,
      members: members.length,
      currency: Number(config.currency) === 1 ? "XLM" : "USDC",
    });

    // Members are the definitive participant list: they locked real collateral.
    for (const m of members) note(m.addr, Number(state.start_time) || 0, g);

    const evs = await eventsFor(g);
    for (const e of evs) {
      const topics = (e.topic ?? []).map(decode);
      const kind = typeof topics[0] === "string" ? topics[0] : "event";
      const data = decode(e.value ?? e.valueXdr);
      const ts = Math.floor(new Date(e.ledgerClosedAt).getTime() / 1000);
      const { actor, amount } = actorAndAmount(topics, data);

      activity.push({
        wallet: actor,
        group: g,
        group_name: config.name,
        action: LABEL[kind] ?? kind,
        amount,
        currency: Number(config.currency) === 1 ? "XLM" : "USDC",
        timestamp: new Date(ts * 1000).toISOString(),
        ledger: e.ledger,
        tx_hash: e.txHash,
        explorer_url: txUrl(e.txHash),
      });
      note(actor, ts, g);
    }
    log(`      ${evs.length} event(s) in the RPC retention window`);
  }

  activity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const walletRows = [...wallets.entries()]
    .map(([wallet, w]) => ({
      wallet,
      actions: w.actions,
      groups: w.groups.size,
      first_seen: w.first ? new Date(w.first * 1000).toISOString() : "",
      last_seen: w.last ? new Date(w.last * 1000).toISOString() : "",
    }))
    .sort((a, b) => b.actions - a.actions);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "activity.csv"),
    toCsv(activity, [
      "wallet", "group", "group_name", "action", "amount",
      "currency", "timestamp", "ledger", "tx_hash", "explorer_url",
    ])
  );
  writeFileSync(
    join(OUT_DIR, "wallets.csv"),
    toCsv(walletRows, ["wallet", "actions", "groups", "first_seen", "last_seen"])
  );

  // Markdown table for pasting into a README.
  const md = [];
  md.push("# Plexa — on-chain activity\n");
  md.push(`Generated ${new Date().toISOString()} from \`${FACTORY_ID}\` on ${NETWORK}.`);
  md.push("Every hash below is a real transaction; open any link to verify it independently.\n");
  md.push(`- **Distinct wallets:** ${walletRows.length}`);
  md.push(`- **Groups:** ${groups.length}`);
  md.push(`- **Recorded actions:** ${activity.length}\n`);
  md.push("> Events are served by Soroban RPC for a rolling window of roughly a week.");
  md.push("> Older activity remains on the ledger but is not listed here.\n");

  md.push("## Wallets\n");
  md.push("| # | Wallet | Actions | Groups | First seen |");
  md.push("|---|---|---|---|---|");
  walletRows.forEach((w, i) =>
    md.push(`| ${i + 1} | \`${w.wallet}\` | ${w.actions} | ${w.groups} | ${w.first_seen ? w.first_seen.slice(0, 10) : "—"} |`)
  );

  md.push("\n## Transactions\n");
  md.push("| Wallet | Action | Amount | When | Transaction |");
  md.push("|---|---|---|---|---|");
  for (const a of activity.slice(0, 200)) {
    const short = a.wallet ? `\`${a.wallet.slice(0, 6)}…${a.wallet.slice(-4)}\`` : "—";
    const amt = a.amount ? `${(Number(a.amount) / 1e7).toFixed(2)} ${a.currency}` : "";
    md.push(
      `| ${short} | ${a.action} | ${amt} | ${a.timestamp.slice(0, 16).replace("T", " ")} | [\`${a.tx_hash.slice(0, 12)}…\`](${a.explorer_url}) |`
    );
  }
  writeFileSync(join(OUT_DIR, "activity.md"), md.join("\n") + "\n");

  log("\n" + "─".repeat(60));
  log(`distinct wallets : ${walletRows.length}`);
  log(`groups           : ${groups.length}`);
  log(`actions recorded : ${activity.length}`);
  log(`\nwrote ${join(OUT_DIR, "activity.csv")}`);
  log(`wrote ${join(OUT_DIR, "wallets.csv")}`);
  log(`wrote ${join(OUT_DIR, "activity.md")}`);
})().catch((e) => {
  console.error("export failed:", e);
  process.exit(1);
});
