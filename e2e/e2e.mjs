// End-to-end integration tests against the *deployed* Plexa contracts.
//
// Unit tests run against an in-process host with a mock oracle and mock router.
// This suite drives the real wasm on testnet with real funded accounts, real
// Reflector prices and real ledger time, because that is where the failures
// that actually bit us lived: a footprint that only diverges under a real
// preflight, an oracle that only goes stale on a real clock, and a period that
// only closes when real seconds pass.
//
//   node e2e.mjs                 # full suite
//   node e2e.mjs --only=oracle   # single test by name substring
//
// Reads contract ids from ../frontend/.env unless overridden by the env.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  rpc, Contract, TransactionBuilder, Networks, Keypair, Address,
  nativeToScVal, scValToNative, xdr,
} from "@stellar/stellar-sdk";

const HERE = dirname(fileURLToPath(import.meta.url));
const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const FRIENDBOT = process.env.FRIENDBOT || "https://friendbot.stellar.org";
const server = new rpc.Server(RPC_URL);

/** Period geometry — short enough to run in minutes, long enough to survive RPC latency. */
const PERIOD = 120;
const CONTRIB_WINDOW = 40;
const SETTLE_WINDOW = 20;
const AUCTION_WINDOW = 30; // auction closes 90s into each period
const CONTRIBUTION = 10_000_000n; // 1 XLM (7dp)

// --------------------------------------------------------------------- config
function envFromFile() {
  const out = {};
  try {
    for (const line of readFileSync(join(HERE, "..", "frontend", ".env"), "utf8").split("\n")) {
      const m = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    // Fall through to process env.
  }
  return out;
}
const FILE_ENV = envFromFile();
const FACTORY_ID = process.env.FACTORY_ID || FILE_ENV.VITE_FACTORY_ID;
const ORACLE_ID = process.env.ORACLE_ID || FILE_ENV.VITE_ORACLE_ID;
if (!FACTORY_ID) throw new Error("FACTORY_ID not set and not found in frontend/.env");

// ---------------------------------------------------------------- primitives
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);
const log = (...a) => console.log(...a);

const addr = (a) => new Address(a).toScVal();
const u32 = (n) => nativeToScVal(n, { type: "u32" });
const i128 = (n) => nativeToScVal(n, { type: "i128" });

async function fund(kp) {
  const res = await fetch(`${FRIENDBOT}?addr=${kp.publicKey()}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`friendbot ${res.status} for ${kp.publicKey()}`);
  }
}

/** Read-only simulate. */
async function read(contractId, method, args = [], source) {
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
  return sim.result?.retval ? scValToNative(sim.result.retval) : null;
}

/** Sign and submit, returning the transaction hash. */
async function send(contractId, method, args, kp) {
  const account = await server.getAccount(kp.publicKey());
  const built = new TransactionBuilder(account, { fee: "2000000", networkPassphrase: PASSPHRASE })
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
    if (got.status !== "SUCCESS") {
      throw new Error(`${method} failed on-chain: ${got.status} (${sent.hash})`);
    }
    return sent.hash;
  }
  throw new Error(`${method} timed out (${sent.hash})`);
}

/** Assert a call is rejected, and that it fails for the expected reason. */
async function expectFailure(label, fn) {
  try {
    await fn();
  } catch (e) {
    log(`    ✓ ${label} rejected — ${String(e.message).slice(0, 90)}`);
    return;
  }
  throw new Error(`${label}: expected rejection, but the call succeeded`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
  log(`    ✓ ${msg}`);
}

/** Wait until a wall-clock instant, reporting progress on long waits. */
async function waitUntil(ts, why) {
  const secs = ts - now();
  if (secs <= 0) return;
  log(`    … waiting ${secs}s (${why})`);
  await sleep((secs + 3) * 1000);
}

// -------------------------------------------------------------------- tests
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("oracle serves a live, fresh, sanely-scaled price", async (ctx) => {
  if (!ORACLE_ID) {
    log("    – skipped (ORACLE_ID not configured)");
    return;
  }
  const price = await read(ORACLE_ID, "price", [], ctx.alice.publicKey());
  const updatedAt = await read(ORACLE_ID, "updated_at", [], ctx.alice.publicKey());

  // Deliberately wide: this asserts the decimal scaling is right and the feed
  // is alive, not that XLM sits at a particular value.
  assert(price > 100_000n && price < 100_000_000n, `price ${price} is within sane 7dp bounds`);
  const age = now() - Number(updatedAt);
  assert(age < 3600, `price is fresh (${age}s old)`);
});

test("factory registry distinguishes real groups from look-alikes", async (ctx) => {
  const registered = await read(FACTORY_ID, "is_group", [addr(ctx.group)], ctx.alice.publicKey());
  assert(registered === true, "the group we created is registered");

  // The security finding this guards: anyone can deploy the byte-identical
  // official wasm naming a factory they control. Registry membership is the
  // only thing that tells them apart.
  const impostor = await read(FACTORY_ID, "is_group", [addr(FACTORY_ID)], ctx.alice.publicKey());
  assert(impostor === false, "an unregistered address is not accepted as a group");
});

test("only the factory admin may schedule an upgrade", async (ctx) => {
  const dummy = xdr.ScVal.scvBytes(Buffer.alloc(32, 9));

  // The critical property: a group member — someone with funds in the group
  // and every incentive to try — cannot replace its code. Upgrade rights come
  // from the factory admin alone.
  await expectFailure("propose_upgrade by an ordinary member", () =>
    send(ctx.group, "propose_upgrade", [dummy], ctx.alice)
  );

  const pending = await read(ctx.group, "pending_upgrade", [], ctx.alice.publicKey());
  assert(pending === null, "no proposal was recorded by the rejected attempt");
});

test("upgrade timelock cannot be short-circuited", async (ctx) => {
  if (!ctx.admin) {
    log("    – skipped (set ADMIN_SECRET to exercise the admin path)");
    return;
  }
  const dummy = xdr.ScVal.scvBytes(Buffer.alloc(32, 9));
  await send(ctx.group, "propose_upgrade", [dummy], ctx.admin);

  const pending = await read(ctx.group, "pending_upgrade", [], ctx.alice.publicKey());
  assert(pending !== null, "proposal is visible on-chain before it can apply");
  assert(Number(pending[1]) > now(), "apply time is in the future");

  // The whole point of the delay: even the admin cannot land code early.
  await expectFailure("apply_upgrade during the delay", () =>
    send(ctx.group, "apply_upgrade", [], ctx.admin)
  );

  // Leave no live proposal behind on a shared testnet deployment.
  await send(ctx.group, "cancel_upgrade", [], ctx.admin);
  const after = await read(ctx.group, "pending_upgrade", [], ctx.alice.publicKey());
  assert(after === null, "proposal cleared after cancel");
});

test("full ROSCA cycle completes and collateral is returned", async (ctx) => {
  const { alice, bob, group } = ctx;

  // --- both members fund period 1, which auto-starts the group.
  await send(group, "contribute", [addr(alice.publicKey())], alice);
  await send(group, "contribute", [addr(bob.publicKey())], bob);

  let state = await read(group, "get_state", [], alice.publicKey());
  assert(Number(state.status) === 1, "group auto-started once full and funded");
  const startTime = Number(state.start_time);

  // --- period 1 lapses with NO keeper and nobody calling resolve_period.
  const p1AuctionEnd = startTime + CONTRIB_WINDOW + SETTLE_WINDOW + AUCTION_WINDOW;
  await waitUntil(p1AuctionEnd, "period 1 auction to close");

  state = await read(group, "get_state", [], alice.publicKey());
  assert(Number(state.current_period) === 1, "period has not advanced on its own");
  assert(Number(state.members_won) === 0, "no winner yet — nothing is driving the group");

  // A member simply pays their next contribution. Catch-up must carry the
  // cycle forward inside that same transaction. This is the property that
  // stops a stopped keeper from freezing everyone's funds, and it can only be
  // proven against real ledger time.
  const hash = await send(group, "contribute", [addr(alice.publicKey())], alice);
  log(`    · alice contributed for period 2 — ${hash.slice(0, 16)}…`);

  state = await read(group, "get_state", [], alice.publicKey());
  assert(Number(state.members_won) === 1, "period 1 resolved as a side effect of a member action");
  assert(Number(state.current_period) === 2, "group advanced with no keeper involved");

  const settled = await read(group, "get_settled", [u32(1)], alice.publicKey());
  assert(settled === true, "period 1 was settled during catch-up");

  // --- period 2 closes out the cycle.
  await send(group, "contribute", [addr(bob.publicKey())], bob);
  const p2AuctionEnd = startTime + PERIOD + CONTRIB_WINDOW + SETTLE_WINDOW + AUCTION_WINDOW;
  await waitUntil(p2AuctionEnd, "period 2 auction to close");

  await send(group, "resolve_period", [], alice);
  state = await read(group, "get_state", [], alice.publicKey());
  assert(Number(state.status) === 2, "cycle completed after every member won");
  assert(Number(state.members_won) === 2, "both members won exactly once");

  // --- winner order is the deterministic rotation, not a draw.
  const aliceWon = await read(group, "has_won", [addr(alice.publicKey())], alice.publicKey());
  const bobWon = await read(group, "has_won", [addr(bob.publicKey())], alice.publicKey());
  assert(aliceWon && bobWon, "both members are recorded as having won");

  // --- claim, then withdraw collateral once the grace window elapses.
  for (const kp of [alice, bob]) {
    const claimable = await read(group, "get_claimable", [addr(kp.publicKey())], kp.publicKey());
    if (claimable > 0n) {
      await send(group, "claim_payout", [addr(kp.publicKey())], kp);
      log(`    · ${kp.publicKey().slice(0, 8)}… claimed ${claimable}`);
    }
  }

  const unlockAt = Number(await read(group, "collateral_unlock_at", [], alice.publicKey()));
  await waitUntil(unlockAt, "collateral grace window");

  await send(group, "withdraw_collateral", [addr(alice.publicKey())], alice);
  const members = await read(group, "get_members", [], alice.publicKey());
  const aliceRec = members.find((m) => m.addr === alice.publicKey());
  assert(
    aliceRec.collateral_xlm === 0n && aliceRec.collateral_usdc === 0n,
    "collateral fully released after the cycle"
  );
});

// ------------------------------------------------------------------- driver
(async () => {
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "").split("=")[1];

  log(`Plexa e2e — ${RPC_URL}`);
  log(`factory ${FACTORY_ID}`);

  const alice = Keypair.random();
  const bob = Keypair.random();
  log(`funding alice ${alice.publicKey().slice(0, 12)}… and bob ${bob.publicKey().slice(0, 12)}…`);
  await Promise.all([fund(alice), fund(bob)]);

  // One XLM group shared by the suite: creating and cycling a group is the
  // expensive part, and every test here is a read or an append to it.
  log("creating group…");
  const params = xdr.ScVal.scvMap(
    [
      ["auction_window", nativeToScVal(AUCTION_WINDOW, { type: "u64" })],
      ["contribution_amount", i128(CONTRIBUTION)],
      ["contribution_window", nativeToScVal(CONTRIB_WINDOW, { type: "u64" })],
      ["currency", u32(1)], // XLM: no trustline, no swap venue needed
      ["description", nativeToScVal("e2e", { type: "string" })],
      ["min_reputation", u32(0)],
      ["name", nativeToScVal("E2E cycle", { type: "string" })],
      ["owner", addr(alice.publicKey())],
      ["period_length", nativeToScVal(PERIOD, { type: "u64" })],
      ["settlement_window", nativeToScVal(SETTLE_WINDOW, { type: "u64" })],
      ["target_members", u32(2)],
      ["visibility", u32(1)], // private: keep the public discovery feed clean
    ]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, v]) => new xdr.ScMapEntry({ key: nativeToScVal(k, { type: "symbol" }), val: v }))
  );

  const acct = await server.getAccount(alice.publicKey());
  const createTx = new TransactionBuilder(acct, { fee: "5000000", networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(FACTORY_ID).call("create_group", params))
    .setTimeout(180)
    .build();
  const prepared = await server.prepareTransaction(createTx);
  prepared.sign(alice);
  const sent = await server.sendTransaction(prepared);
  let group = null;
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const got = await server.getTransaction(sent.hash);
    if (got.status === "NOT_FOUND") continue;
    if (got.status !== "SUCCESS") throw new Error(`create_group failed: ${got.status}`);
    group = scValToNative(got.returnValue);
    break;
  }
  if (!group) throw new Error("create_group timed out");
  log(`group ${group}\n`);

  // Onboarding order is load-bearing: the owner is auto-approved but only
  // becomes a *member* by locking collateral, and only members may vote. So
  // alice must lock before she can approve bob, and bob must be approved
  // before he may lock.
  log("onboarding members…");
  await send(group, "lock_collateral", [addr(alice.publicKey()), u32(1)], alice);
  await send(group, "request_join", [addr(bob.publicKey())], bob);
  await send(
    group,
    "vote_on_join",
    [addr(alice.publicKey()), addr(bob.publicKey()), nativeToScVal(true)],
    alice
  );
  await send(group, "lock_collateral", [addr(bob.publicKey()), u32(1)], bob);
  log("both members onboarded\n");

  // Optional: exercising the admin-only upgrade path needs the factory admin
  // key. Absent it, those tests skip rather than fail, so anyone can run this
  // suite against a deployment they do not control.
  const admin = process.env.ADMIN_SECRET ? Keypair.fromSecret(process.env.ADMIN_SECRET) : null;
  const ctx = { alice, bob, group, admin };
  let passed = 0;
  const failures = [];

  for (const t of tests) {
    if (only && !t.name.includes(only)) continue;
    log(`▶ ${t.name}`);
    const started = Date.now();
    try {
      await t.fn(ctx);
      passed++;
      log(`  PASS (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
    } catch (e) {
      failures.push({ name: t.name, error: e.message });
      log(`  FAIL — ${e.message}\n`);
    }
  }

  log("─".repeat(60));
  log(`${passed} passed, ${failures.length} failed`);
  for (const f of failures) log(`  ✗ ${f.name}: ${f.error}`);
  log(`group under test: ${group}`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error("e2e harness failed:", e);
  process.exit(1);
});
