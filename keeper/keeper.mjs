// Plexa keeper — advances every Active group so members never sign to settle
// or resolve. `settle` and `resolve_period` are permissionless on the contract
// (no require_auth), so any funded account can drive them; the keeper pays the
// fee (a fraction of a cent per call) instead of a member.
//
// Why this exists: resolve_period used to be submitted by whichever member had
// the page open. If nobody was around, the period never closed and everyone's
// funds sat frozen behind one absent person.
//
// Footprint widening
// ------------------
// The no-bid winner is drawn with env.prng(), which is seeded per-transaction,
// so preflight and execution can pick different members. Simulation only
// declares Claimable(winner_it_drew), and execution writing a different key
// traps with scecExceededLimit "contract data key outside of the footprint".
// We append Claimable(m) for EVERY eligible member before submitting, so the
// entry is declared whichever way the draw lands. This makes the keeper work
// against the currently-deployed wasm (d58bb092…, which lacks the in-contract
// pre-touch fix) as well as the corrected build (2320f3c3…).
import {
  rpc, Contract, TransactionBuilder, Networks, Keypair,
  Address, xdr, nativeToScVal, scValToNative,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
const FACTORY_ID = process.env.FACTORY_ID;
const DRY_RUN = process.argv.includes("--dry-run");
/** Safety valve: never chase more than this many periods per group per run. */
const MAX_CATCHUP = Number(process.env.MAX_CATCHUP || 12);

if (!FACTORY_ID) throw new Error("FACTORY_ID is required");
if (!DRY_RUN && !process.env.KEEPER_SECRET) throw new Error("KEEPER_SECRET is required");

const server = new rpc.Server(RPC_URL);
const kp = process.env.KEEPER_SECRET ? Keypair.fromSecret(process.env.KEEPER_SECRET) : null;
// Simulation still needs an existing source account to read a sequence number,
// so a dry run without a secret needs KEEPER_PUBLIC to point at a funded one.
const SOURCE = kp ? kp.publicKey() : process.env.KEEPER_PUBLIC;
if (!SOURCE) throw new Error("KEEPER_SECRET (or KEEPER_PUBLIC for --dry-run) is required");
const STATUS = { 0: "Forming", 1: "Active", 2: "Completed", 3: "Cancelled" };

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ------------------------------------------------------------------- reads
async function simulate(contractId, method, args = []) {
  const account = await server.getAccount(SOURCE);
  const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`${method}: ${sim.error}`);
  return sim.result?.retval ? scValToNative(sim.result.retval) : null;
}

/**
 * Wall clock in unix seconds. Only used to decide whether a call is worth
 * attempting — the contract re-checks the real ledger timestamp and rejects
 * with PeriodNotEnded if we are early, so a few seconds of drift is harmless.
 */
function now() {
  return Math.floor(Date.now() / 1000);
}

// ------------------------------------------------------------------ writes
/**
 * Submit a no-arg contract call. When `eligible` is supplied, the read-write
 * footprint is widened with Claimable(m) for each address before signing.
 */
async function send(contractId, method, eligible = null) {
  const account = await server.getAccount(SOURCE);
  const tx = new TransactionBuilder(account, { fee: "3000000", networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method))
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return { skipped: true, reason: sim.error };

  let finalTx;
  if (eligible && eligible.length > 1) {
    const data = rpc.assembleTransaction(tx, sim).build()
      .toEnvelope().v1().tx().ext().sorobanData();
    const res = data.resources();
    const fp = res.footprint();
    const rw = fp.readWrite().slice();
    const seen = new Set(rw.map((k) => k.toXDR("base64")));
    const contractAddr = new Address(contractId).toScAddress();

    for (const addr of eligible) {
      const key = xdr.ScVal.scvVec([
        nativeToScVal("Claimable", { type: "symbol" }),
        new Address(addr).toScVal(),
      ]);
      const lk = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: contractAddr,
          key,
          durability: xdr.ContractDataDurability.persistent(),
        })
      );
      const b64 = lk.toXDR("base64");
      if (!seen.has(b64)) { rw.push(lk); seen.add(b64); }
    }
    fp.readWrite(rw);
    // A different winner can cost marginally more than the simulated one.
    res.instructions(Math.floor(res.instructions() * 2));
    res.diskReadBytes(res.diskReadBytes() + 8000);
    res.writeBytes(res.writeBytes() + 8000);
    data.resourceFee(xdr.Int64.fromString((BigInt(data.resourceFee().toString()) * 5n).toString()));

    const acct = await server.getAccount(SOURCE);
    finalTx = new TransactionBuilder(acct, { fee: "5000000", networkPassphrase: PASSPHRASE })
      .addOperation(new Contract(contractId).call(method))
      .setTimeout(180)
      .setSorobanData(data)
      .build();
  } else {
    finalTx = rpc.assembleTransaction(tx, sim).build();
  }

  if (DRY_RUN) return { dryRun: true };
  finalTx.sign(kp);

  const sent = await server.sendTransaction(finalTx);
  if (sent.status === "ERROR") {
    return { failed: true, reason: JSON.stringify(sent.errorResult) };
  }
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const got = await server.getTransaction(sent.hash);
    if (got.status === "NOT_FOUND") continue;
    return got.status === "SUCCESS"
      ? { hash: sent.hash }
      : { failed: true, hash: sent.hash, reason: got.status };
  }
  return { failed: true, hash: sent.hash, reason: "timed out" };
}

// ------------------------------------------------------------ per-group work
async function advance(groupId) {
  const config = await simulate(groupId, "get_config");
  let handled = 0;

  for (let step = 0; step < MAX_CATCHUP; step++) {
    const state = await simulate(groupId, "get_state");
    if (Number(state.status) !== 1) {
      if (step === 0) log(`  ${groupId} ${STATUS[Number(state.status)] ?? state.status} — skip`);
      break;
    }

    const period = Number(state.current_period);
    const start = Number(state.start_time) + (period - 1) * Number(config.period_length);
    const settleEnd = start + Number(config.contribution_window) + Number(config.settlement_window);
    const auctionEnd = settleEnd + Number(config.auction_window);
    const t = now();

    if (t < settleEnd) {
      log(`  ${groupId} period ${period}: contribution window open, ${settleEnd - t}s to settle`);
      break;
    }

    // 1. Settle — finalizes the pot and covers misses from collateral.
    const settled = await simulate(groupId, "get_settled", [nativeToScVal(period, { type: "u32" })]);
    if (!settled) {
      const r = await send(groupId, "settle");
      if (r.hash) log(`  ${groupId} period ${period}: settled  tx=${r.hash}`);
      else if (r.dryRun) log(`  ${groupId} period ${period}: would settle`);
      else log(`  ${groupId} period ${period}: settle skipped — ${r.reason}`);
    }

    if (t < auctionEnd) {
      log(`  ${groupId} period ${period}: auction open, ${auctionEnd - t}s to resolve`);
      break;
    }

    // 2. Resolve — picks the winner and credits their dashboard.
    const members = await simulate(groupId, "get_members");
    const eligible = members.filter((m) => !m.has_won && !m.removed).map((m) => m.addr);
    const r = await send(groupId, "resolve_period", eligible);
    if (r.hash) {
      log(`  ${groupId} period ${period}: resolved  tx=${r.hash}`);
      handled++;
    } else if (r.dryRun) {
      log(`  ${groupId} period ${period}: would resolve (${eligible.length} eligible)`);
      break;
    } else {
      log(`  ${groupId} period ${period}: resolve failed — ${r.reason}`);
      break;
    }
  }
  return handled;
}

// ------------------------------------------------------------------- driver
(async () => {
  log(`keeper ${DRY_RUN ? "(dry run) " : ""}starting — factory ${FACTORY_ID}`);
  if (!DRY_RUN) log(`keeper account ${SOURCE}`);

  const groups = await simulate(FACTORY_ID, "get_all_groups");
  log(`${groups.length} group(s) registered`);

  let total = 0;
  for (const g of groups) {
    try {
      total += await advance(g);
    } catch (e) {
      log(`  ${g} ERROR — ${e.message}`);
    }
  }
  log(`done — ${total} period(s) advanced`);
})().catch((e) => {
  console.error("keeper failed:", e);
  process.exit(1);
});
