// Generate real on-chain activity against the deployed Plexa factory: many
// fresh, Friendbot-funded testnet wallets, each forming a small 2-member XLM
// group and taking it through join + collateral + a contribution.
//
// Every transaction here is genuinely signed and submitted by its wallet and
// genuinely lands on testnet — this script invents no hashes. It exists so
// `scripts/export-activity.mjs` has more than a handful of wallets to report
// on. Groups are created `visibility=1` (private) and named "Activity seed"
// so they are clearly identifiable as demo traffic, not organic users, to
// anyone inspecting the registry.
//
//   node seed-activity.mjs --pairs=25
//   node seed-activity.mjs --pairs=5 --concurrency=3   # smoke test
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  rpc, Contract, TransactionBuilder, Networks, Keypair, Address,
  nativeToScVal, scValToNative, xdr,
} from "@stellar/stellar-sdk";

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const FRIENDBOT = process.env.FRIENDBOT || "https://friendbot.stellar.org";
const NETWORK = process.env.NETWORK || "testnet";
const EXPLORER = NETWORK === "public" || NETWORK === "mainnet" ? "public" : "testnet";
const PAIRS = Number(arg("pairs", "25"));
const CONCURRENCY = Number(arg("concurrency", "4"));
const OUT = arg("out", join(HERE, "..", "docs", "activity", "seed-log.json"));

function envFromFile() {
  const out = {};
  try {
    for (const line of readFileSync(join(HERE, "..", "frontend", ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* fall back to env */
  }
  return out;
}
const FILE_ENV = envFromFile();
const FACTORY_ID = process.env.FACTORY_ID || FILE_ENV.VITE_FACTORY_ID;
if (!FACTORY_ID) throw new Error("VITE_FACTORY_ID not found in frontend/.env");

const server = new rpc.Server(RPC_URL);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const txUrl = (h) => `https://stellar.expert/explorer/${EXPLORER}/tx/${h}`;

const addr = (a) => new Address(a).toScVal();
const u32 = (n) => nativeToScVal(n, { type: "u32" });
const i128 = (n) => nativeToScVal(n, { type: "i128" });

const PERIOD = 604_800; // 1 week — long enough that we never need to wait out a window
const CONTRIB_WINDOW = 3600;
const SETTLE_WINDOW = 1800;
const AUCTION_WINDOW = 1800;
const CONTRIBUTION = 10_000_000n; // 1 XLM (7dp)

async function fund(kp) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${FRIENDBOT}?addr=${kp.publicKey()}`);
    if (res.ok || res.status === 400) return;
    if (res.status === 429) { await sleep(3000 + attempt * 2000); continue; }
    throw new Error(`friendbot ${res.status} for ${kp.publicKey()}`);
  }
  throw new Error(`friendbot rate-limited for ${kp.publicKey()}`);
}

async function getAccountRetry(publicKey) {
  for (let a = 0; a < 6; a++) {
    try {
      return await server.getAccount(publicKey);
    } catch (e) {
      if (a === 5) throw e;
      await sleep(1500);
    }
  }
}

/** Sign and submit, returning {hash, returnValue}. Retries once on stale-account seq errors. */
async function send(contractId, method, args, kp, fee = "3000000") {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const account = await getAccountRetry(kp.publicKey());
      const built = new TransactionBuilder(account, { fee, networkPassphrase: PASSPHRASE })
        .addOperation(new Contract(contractId).call(method, ...args))
        .setTimeout(180)
        .build();
      const prepared = await server.prepareTransaction(built);
      prepared.sign(kp);
      const sent = await server.sendTransaction(prepared);
      if (sent.status === "ERROR") {
        throw new Error(`${method} submit failed: ${JSON.stringify(sent.errorResult)}`);
      }
      for (let i = 0; i < 40; i++) {
        await sleep(1500);
        const got = await server.getTransaction(sent.hash);
        if (got.status === "NOT_FOUND") continue;
        if (got.status !== "SUCCESS") throw new Error(`${method} failed on-chain: ${got.status} (${sent.hash})`);
        return { hash: sent.hash, returnValue: got.returnValue ? scValToNative(got.returnValue) : null };
      }
      throw new Error(`${method} timed out (${sent.hash})`);
    } catch (e) {
      if (attempt === 2) throw e;
      await sleep(2000);
    }
  }
}

function createParams({ owner, name }) {
  return xdr.ScVal.scvMap(
    [
      ["auction_window", nativeToScVal(AUCTION_WINDOW, { type: "u64" })],
      ["contribution_amount", i128(CONTRIBUTION)],
      ["contribution_window", nativeToScVal(CONTRIB_WINDOW, { type: "u64" })],
      ["currency", u32(1)], // XLM: no trustline needed
      ["description", nativeToScVal("Generated by scripts/seed-activity.mjs", { type: "string" })],
      ["min_reputation", u32(0)],
      ["name", nativeToScVal(name, { type: "string" })],
      ["owner", addr(owner)],
      ["period_length", nativeToScVal(PERIOD, { type: "u64" })],
      ["settlement_window", nativeToScVal(SETTLE_WINDOW, { type: "u64" })],
      ["target_members", u32(2)],
      ["visibility", u32(1)], // private — keep the public discovery feed clean
    ]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, v]) => new xdr.ScMapEntry({ key: nativeToScVal(k, { type: "symbol" }), val: v }))
  );
}

async function runPair(i) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await runPairOnce(i, attempt);
    } catch (e) {
      log(`[${i}] attempt ${attempt} failed: ${e.message}`);
      if (attempt === 2) throw e;
      await sleep(3000);
    }
  }
}

async function runPairOnce(i, attempt) {
  const alice = Keypair.random();
  const bob = Keypair.random();
  const rows = [];
  const note = (kp, action, amount, hash) =>
    rows.push({
      wallet: kp.publicKey(),
      action,
      amount: amount.toString(),
      currency: "XLM",
      tx_hash: hash,
      explorer_url: txUrl(hash),
      timestamp: new Date().toISOString(),
    });

  log(`[${i}] funding ${alice.publicKey().slice(0, 6)}… + ${bob.publicKey().slice(0, 6)}…`);
  await Promise.all([fund(alice), fund(bob)]);

  const acct = await getAccountRetry(alice.publicKey());
  const createTx = new TransactionBuilder(acct, { fee: "5000000", networkPassphrase: PASSPHRASE })
    .addOperation(
      new Contract(FACTORY_ID).call("create_group", createParams({ owner: alice.publicKey(), name: `Activity seed #${i}` }))
    )
    .setTimeout(180)
    .build();
  const prepared = await server.prepareTransaction(createTx);
  prepared.sign(alice);
  const sentCreate = await server.sendTransaction(prepared);
  if (sentCreate.status === "ERROR") throw new Error(`create_group submit failed: ${JSON.stringify(sentCreate.errorResult)}`);
  let group = null;
  for (let a = 0; a < 40; a++) {
    await sleep(1500);
    const got = await server.getTransaction(sentCreate.hash);
    if (got.status === "NOT_FOUND") continue;
    if (got.status !== "SUCCESS") {
      throw new Error(`create_group failed: ${got.status} ${JSON.stringify(got.resultXdr?.result?.().switch?.().name ?? "")} (${sentCreate.hash})`);
    }
    group = scValToNative(got.returnValue);
    break;
  }
  if (!group) throw new Error(`[${i}] create_group timed out`);
  note(alice, "Group created", 0n, sentCreate.hash);
  log(`[${i}] group ${group}`);

  let r = await send(group, "lock_collateral", [addr(alice.publicKey()), u32(1)], alice);
  note(alice, "Locked collateral", CONTRIBUTION, r.hash);

  r = await send(group, "request_join", [addr(bob.publicKey())], bob);
  note(bob, "Requested to join", 0n, r.hash);

  r = await send(group, "vote_on_join", [addr(alice.publicKey()), addr(bob.publicKey()), nativeToScVal(true)], alice);
  note(alice, "Join approved", 0n, r.hash);

  r = await send(group, "lock_collateral", [addr(bob.publicKey()), u32(1)], bob);
  note(bob, "Locked collateral", CONTRIBUTION, r.hash);

  r = await send(group, "contribute", [addr(alice.publicKey())], alice);
  note(alice, "Contributed", CONTRIBUTION, r.hash);

  r = await send(group, "contribute", [addr(bob.publicKey())], bob);
  note(bob, "Contributed", CONTRIBUTION, r.hash);

  log(`[${i}] done — 7 real transactions, 2 wallets`);
  return { group, rows };
}

async function pool(items, workers, fn) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const my = idx++;
      try {
        results[my] = await fn(items[my], my);
      } catch (e) {
        log(`[${my}] FAILED: ${e.message}`);
        results[my] = { error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

(async () => {
  log(`seeding ${PAIRS} groups (${PAIRS * 2} wallets) against factory ${FACTORY_ID} on ${NETWORK}`);
  const results = await pool(Array.from({ length: PAIRS }, (_, i) => i), CONCURRENCY, (_, i) => runPair(i));

  const ok = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error);
  const rows = ok.flatMap((r) => r.rows);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ factory: FACTORY_ID, network: NETWORK, groups: ok.map((r) => r.group), rows }, null, 2));

  log("─".repeat(60));
  log(`groups ok: ${ok.length}/${PAIRS}, wallets: ${ok.length * 2}, transactions: ${rows.length}`);
  if (failed.length) log(`failed: ${failed.length} — ${failed.map((f) => f.error).join(" | ")}`);
  log(`wrote ${OUT}`);
})().catch((e) => {
  console.error("seed failed:", e);
  process.exit(1);
});
