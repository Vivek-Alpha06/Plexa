// Plexa fee-sponsorship relayer — gasless transactions via Stellar fee bump.
//
// Why this exists
// ---------------
// A ROSCA is for people who are outside the banking system. Telling them
// "first acquire XLM to pay network fees" reintroduces exactly the barrier the
// product exists to remove. A new member should be able to join a savings
// circle holding nothing but the asset they are saving in.
//
// Stellar solves this natively with CAP-15 fee-bump transactions: the member
// signs the inner transaction authorising the contract call, and a separate
// account (this relayer) wraps it and pays the fee. The member's signature is
// still required for the contract call itself, so sponsorship grants the
// relayer no authority over member funds — it can only pay, never move.
//
//   member signs inner tx  ─┐
//                           ├─► relayer wraps in fee bump ─► network
//   relayer signs outer tx ─┘        (relayer pays fee)
//
// Threat model
// ------------
// An open relayer is a faucet: anyone could point arbitrary transactions at it
// and drain the sponsor account. Three controls, in order of strength:
//
//   1. Contract allowlist. The inner transaction must invoke the Plexa factory
//      or a group the factory itself vouches for. We ask the deployed factory
//      `is_group(addr)` on-chain rather than trusting a local list, so a group
//      created after this process started is still covered and a lookalike
//      contract is not. Results are cached (positive only) to bound RPC load.
//   2. Shape check. Exactly one operation, and it must be invokeHostFunction.
//      No payments, no account merges, no path payments — nothing that could
//      move value to an attacker even if the allowlist were bypassed.
//   3. Per-source rate limit and a hard per-transaction fee ceiling, so a
//      compromised or buggy client cannot burn the balance in a loop.
//
// The relayer key is therefore low-value by construction: its only power is to
// pay fees for calls into contracts the factory recognises. Keep it separate
// from the contract admin key and fund it with a working balance, not a
// treasury.
import http from "node:http";
import {
  rpc, Contract, TransactionBuilder, Networks, Keypair, Account,
  Address, Asset, FeeBumpTransaction, Horizon, Transaction, scValToNative,
} from "@stellar/stellar-sdk";
import {
  buildSponsoredOnboarding, minimumBalanceXlm, sponsorCapacity,
} from "./sponsored-reserves.mjs";

const RPC_URL = process.env.RPC_URL || "https://mainnet.sorobanrpc.com";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.PUBLIC;
const FACTORY_ID = process.env.FACTORY_ID;
const PORT = Number(process.env.PORT || 8787);

/** Largest total fee (stroops) the relayer will pay for a single transaction. */
const MAX_FEE_STROOPS = BigInt(process.env.MAX_FEE_STROOPS || 20_000_000); // 2 XLM
/** Sponsored transactions allowed per source account per window. */
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 12);
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60 * 60 * 1000);
/** Refuse to sponsor once the relayer balance drops below this (stroops). */
const MIN_BALANCE_STROOPS = BigInt(process.env.MIN_BALANCE_STROOPS || 50_000_000); // 5 XLM
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";
/** Asset whose trustline is opened for a sponsored member, as CODE:ISSUER. */
const SPONSOR_ASSET = process.env.SPONSOR_ASSET || "";
/** Set to "0" to disable reserve sponsorship while keeping fee sponsorship. */
const SPONSOR_RESERVES = process.env.SPONSOR_RESERVES !== "0";

if (!FACTORY_ID) throw new Error("FACTORY_ID is required");
if (!process.env.SPONSOR_SECRET) throw new Error("SPONSOR_SECRET is required");

const sponsorKp = Keypair.fromSecret(process.env.SPONSOR_SECRET);
const server = new rpc.Server(RPC_URL);
/** Canonical all-zero account used as the source for read-only simulation. */
const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// ---------------------------------------------------------------- validation

/** Contracts the factory has vouched for. Positive results only — a `false`
 *  is never cached, so a group created a moment ago is picked up on retry. */
const groupCache = new Set([FACTORY_ID]);

async function isSponsorableContract(contractId) {
  if (groupCache.has(contractId)) return true;

  const probe = new Contract(FACTORY_ID);
  const readSource = new Account(READ_SOURCE, "0");
  const tx = new TransactionBuilder(readSource, {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(probe.call("is_group", new Address(contractId).toScVal()))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) return false;
  const ok = scValToNative(sim.result.retval) === true;
  if (ok) groupCache.add(contractId);
  return ok;
}

/**
 * Reject anything that is not a single contract call into a Plexa contract.
 * Returns the reason string on rejection, or null when the transaction is
 * safe to sponsor.
 */
async function rejectionReason(innerTx) {
  if (innerTx.operations.length !== 1) {
    return `expected exactly 1 operation, got ${innerTx.operations.length}`;
  }
  const op = innerTx.operations[0];
  if (op.type !== "invokeHostFunction") {
    return `operation type ${op.type} is not sponsorable`;
  }
  if (innerTx.source === sponsorKp.publicKey()) {
    return "relayer cannot sponsor its own transaction";
  }

  // The contract being invoked lives in the host function's arguments. An
  // invokeContract host function carries (contractAddress, functionName, args).
  let contractId;
  try {
    const invoked = op.func.invokeContract();
    contractId = Address.fromScAddress(invoked.contractAddress()).toString();
  } catch {
    return "host function is not a contract invocation (no upload/create)";
  }

  if (!(await isSponsorableContract(contractId))) {
    return `contract ${contractId} is not registered with the Plexa factory`;
  }

  const innerFee = BigInt(innerTx.fee);
  if (innerFee * 2n > MAX_FEE_STROOPS) {
    return `fee ${innerFee} exceeds the sponsorship ceiling`;
  }
  return null;
}

// --------------------------------------------------------------- rate limits

const seen = new Map(); // source account -> timestamps[]

function rateLimited(source) {
  const now = Date.now();
  const hits = (seen.get(source) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    seen.set(source, hits);
    return true;
  }
  hits.push(now);
  seen.set(source, hits);
  return false;
}

async function sponsorBalanceStroops() {
  const acct = await server.getAccount(sponsorKp.publicKey()).catch(() => null);
  if (!acct) return 0n;
  // getAccount returns sequence data only; read the balance from Horizon's
  // sibling endpoint on the same host family when available.
  const horizon =
    process.env.HORIZON_URL ||
    (PASSPHRASE === Networks.PUBLIC
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org");
  const res = await fetch(`${horizon}/accounts/${sponsorKp.publicKey()}`);
  if (!res.ok) return 0n;
  const json = await res.json();
  const native = json.balances?.find((b) => b.asset_type === "native");
  return native ? BigInt(Math.floor(Number(native.balance) * 1e7)) : 0n;
}

// ------------------------------------------------------------------ sponsor

/**
 * Wrap a member-signed transaction in a fee bump and submit it.
 *
 * The outer fee must cover the inner transaction in full — for Soroban that
 * includes the resource fee, which dwarfs the inclusion fee — so we size the
 * bump from the inner fee rather than from BASE_FEE. `buildFeeBumpTransaction`
 * multiplies the base fee by (operations + 1), giving 2x the inner fee for our
 * single-operation calls: enough headroom for the network to accept it without
 * being open-ended, since MAX_FEE_STROOPS still caps the total.
 */
async function sponsor(signedInnerXdr) {
  const innerTx = TransactionBuilder.fromXDR(signedInnerXdr, PASSPHRASE);
  if (innerTx instanceof FeeBumpTransaction) {
    throw new Error("transaction is already fee-bumped");
  }
  if (!(innerTx instanceof Transaction)) {
    throw new Error("expected a classic transaction envelope");
  }

  const reason = await rejectionReason(innerTx);
  if (reason) throw new Error(`refused: ${reason}`);

  if (rateLimited(innerTx.source)) {
    throw new Error("rate limit reached for this account, try again later");
  }

  const balance = await sponsorBalanceStroops();
  if (balance < MIN_BALANCE_STROOPS) {
    throw new Error("sponsorship is temporarily paused (relayer balance low)");
  }

  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsorKp,
    innerTx.fee, // per-op base → outer total is 2x inner for 1 operation
    innerTx,
    PASSPHRASE
  );
  feeBump.sign(sponsorKp);

  const sent = await server.sendTransaction(feeBump);
  if (sent.status === "ERROR") {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  return { hash: sent.hash, sponsoredBy: sponsorKp.publicKey() };
}

// ---------------------------------------------------------------- onboarding

function sponsoredAsset() {
  if (!SPONSOR_ASSET) return null;
  const [code, issuer] = SPONSOR_ASSET.split(":");
  if (!code || !issuer) {
    throw new Error(`SPONSOR_ASSET must be CODE:ISSUER, got "${SPONSOR_ASSET}"`);
  }
  return new Asset(code, issuer);
}

const horizonUrl = () =>
  process.env.HORIZON_URL ||
  (PASSPHRASE === Networks.PUBLIC
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");

/**
 * Build a CAP-33 sponsored-onboarding transaction for a brand-new member.
 *
 * Returns the *unsigned* transaction. The relayer does not sign here, and
 * deliberately does not submit: the member must sign too (they are the source
 * of `endSponsoringFutureReserves` and of their own trustline), so the client
 * co-signs and returns it through `/sponsor` for the fee bump. That also means
 * this endpoint cannot be used to make the sponsor lock reserves unilaterally.
 */
async function buildOnboarding(memberPublicKey) {
  if (!SPONSOR_RESERVES) {
    throw new Error("reserve sponsorship is disabled on this relayer");
  }
  if (!/^G[A-Z2-7]{55}$/.test(memberPublicKey || "")) {
    throw new Error("memberPublicKey must be a valid Stellar public key");
  }

  const horizon = new Horizon.Server(horizonUrl());

  // Refuse if the account already exists — createAccount would fail anyway,
  // and this gives the caller a clear reason instead of an opaque tx error.
  const existing = await horizon
    .loadAccount(memberPublicKey)
    .catch(() => null);
  if (existing) {
    throw new Error("account already exists on the network");
  }

  const sponsorAcct = await horizon.loadAccount(sponsorKp.publicKey());
  const native = sponsorAcct.balances.find((b) => b.asset_type === "native");
  const balance = Number(native?.balance ?? 0);

  const asset = sponsoredAsset();
  const needed = minimumBalanceXlm(asset ? 1 : 0);

  if (sponsorCapacity(balance) < 1) {
    throw new Error(
      `sponsor cannot cover another ${needed} XLM of reserves (balance ${balance} XLM)`
    );
  }

  const { tx, reservesLockedXlm } = buildSponsoredOnboarding({
    sponsorAccount: sponsorAcct,
    sponsorPublicKey: sponsorKp.publicKey(),
    memberPublicKey,
    asset,
    networkPassphrase: PASSPHRASE,
  });

  // Sponsor signs its half now; the member co-signs client-side.
  tx.sign(sponsorKp);

  return {
    xdr: tx.toXDR(),
    sponsor: sponsorKp.publicKey(),
    reservesLockedXlm,
    asset: asset ? `${asset.code}:${asset.issuer}` : null,
    remainingCapacity: sponsorCapacity(balance),
    note: "Co-sign with the member key, then submit. The member needs no XLM.",
  };
}

// --------------------------------------------------------------------- http

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  });
  res.end(payload);
}

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});

  if (req.method === "GET" && req.url === "/health") {
    const balance = await sponsorBalanceStroops().catch(() => 0n);
    return send(res, 200, {
      status: balance >= MIN_BALANCE_STROOPS ? "ok" : "paused",
      sponsor: sponsorKp.publicKey(),
      factory: FACTORY_ID,
      network: PASSPHRASE === Networks.PUBLIC ? "public" : "testnet",
      balanceXlm: Number(balance) / 1e7,
      reserveSponsorship: SPONSOR_RESERVES,
      sponsorAsset: SPONSOR_ASSET || null,
      onboardCapacity: sponsorCapacity(Number(balance) / 1e7),
    });
  }

  if (req.method === "POST" && req.url === "/onboard") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 10_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { publicKey } = JSON.parse(raw);
        const result = await buildOnboarding(publicKey);
        console.log(`[relayer] built sponsored onboarding for ${publicKey}`);
        send(res, 200, result);
      } catch (err) {
        console.warn(`[relayer] onboard refused: ${err.message}`);
        send(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/sponsor") {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 200_000) req.destroy();
    });
    req.on("end", async () => {
      try {
        const { xdr: signedXdr } = JSON.parse(raw);
        if (!signedXdr) return send(res, 400, { error: "xdr is required" });
        const result = await sponsor(signedXdr);
        console.log(`[relayer] sponsored ${result.hash}`);
        send(res, 200, result);
      } catch (err) {
        console.warn(`[relayer] ${err.message}`);
        send(res, 400, { error: err.message });
      }
    });
    return;
  }

  send(res, 404, { error: "not found" });
});

httpServer.listen(PORT, () => {
  console.log(`[relayer] fee sponsorship listening on :${PORT}`);
  console.log(`[relayer] sponsor account ${sponsorKp.publicKey()}`);
  console.log(`[relayer] factory ${FACTORY_ID}`);
});
