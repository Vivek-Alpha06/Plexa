// Tests for sponsored reserves (CAP-33).
//
// These assert the *structure* of the built transactions — operation order,
// which account sources each operation, and who must sign. That is exactly
// where sponsorship goes wrong: an unbalanced sandwich or an end-operation
// sourced by the wrong account fails the whole transaction, and a
// `startingBalance` of 0 outside a sandwich is rejected by the network.
//
// No network access and no funded accounts required.
//
// Run:  node keeper/sponsored-reserves.test.mjs
import { Account, Asset, Keypair, Networks, Operation } from "@stellar/stellar-sdk";
import {
  BASE_RESERVE_XLM,
  buildReclaimReserves,
  buildSponsoredOnboarding,
  minimumBalanceXlm,
  reservesRequiredFor,
  sponsorCapacity,
} from "./sponsored-reserves.mjs";

const USDC = new Asset(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);

let passed = 0;
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
    failed++;
  }
}

function throws(name, fn, expected) {
  try {
    fn();
    check(name, false, "expected it to throw, but it returned");
  } catch (e) {
    check(name, e.message.includes(expected), `got: ${e.message}`);
  }
}

const sponsor = Keypair.random();
const member = Keypair.random();

function sponsorAccount() {
  // Fresh each time: TransactionBuilder increments the sequence number.
  return new Account(sponsor.publicKey(), "100");
}

function build(asset = USDC) {
  return buildSponsoredOnboarding({
    sponsorAccount: sponsorAccount(),
    sponsorPublicKey: sponsor.publicKey(),
    memberPublicKey: member.publicKey(),
    asset,
    networkPassphrase: Networks.TESTNET,
  });
}

console.log("\nsponsored reserves (CAP-33)\n");

// ------------------------------------------------------------ reserve maths

check(
  "base reserve is 0.5 XLM",
  BASE_RESERVE_XLM === 0.5,
  String(BASE_RESERVE_XLM)
);
check(
  "bare account needs 1.0 XLM (2 base reserves)",
  minimumBalanceXlm(0) === 1.0,
  String(minimumBalanceXlm(0))
);
check(
  "account + one trustline needs 1.5 XLM",
  minimumBalanceXlm(1) === 1.5,
  String(minimumBalanceXlm(1))
);
check(
  "20 members with a USDC trustline need 30 XLM",
  reservesRequiredFor(20) === 30,
  String(reservesRequiredFor(20))
);

// ----------------------------------------------------------- the sandwich

{
  const { tx, reservesLockedXlm } = build();
  const kinds = tx.operations.map((o) => o.type);

  check(
    "operations are in sandwich order",
    JSON.stringify(kinds) ===
      JSON.stringify([
        "beginSponsoringFutureReserves",
        "createAccount",
        "changeTrust",
        "endSponsoringFutureReserves",
      ]),
    kinds.join(", ")
  );

  check(
    "sponsorship names the member as sponsoredId",
    tx.operations[0].sponsoredId === member.publicKey()
  );
  check(
    "begin is sourced by the sponsor",
    tx.operations[0].source === sponsor.publicKey()
  );

  // The detail that silently breaks sponsorship if you get it wrong.
  check(
    "END is sourced by the SPONSORED account, not the sponsor",
    tx.operations[3].source === member.publicKey(),
    `got ${tx.operations[3].source}`
  );

  check(
    "account is created with a zero starting balance",
    // The SDK normalises amounts to 7 decimal places, so compare numerically.
    Number(tx.operations[1].startingBalance) === 0,
    tx.operations[1].startingBalance
  );
  check(
    "trustline is sourced by the member who will own it",
    tx.operations[2].source === member.publicKey()
  );
  check(
    "reports 1.5 XLM locked against the sponsor",
    reservesLockedXlm === 1.5,
    String(reservesLockedXlm)
  );
}

// ------------------------------------------------------------- no trustline

{
  const { tx, reservesLockedXlm } = build(null);
  check(
    "omitting the asset skips changeTrust",
    tx.operations.length === 3 &&
      !tx.operations.some((o) => o.type === "changeTrust")
  );
  check(
    "a bare account locks only 1.0 XLM",
    reservesLockedXlm === 1.0,
    String(reservesLockedXlm)
  );
}

// ---------------------------------------------------------------- signing

{
  const { tx } = build();
  // Both parties must sign: the sponsor to accept the lock, the member to
  // accept the trustline and close the sandwich.
  tx.sign(sponsor);
  tx.sign(member);
  check("accepts signatures from both parties", tx.signatures.length === 2);
  check(
    "transaction serialises to XDR",
    typeof tx.toXDR() === "string" && tx.toXDR().length > 0
  );
}

// -------------------------------------------------------------- validation

throws(
  "refuses to let an account sponsor itself",
  () =>
    buildSponsoredOnboarding({
      sponsorAccount: sponsorAccount(),
      sponsorPublicKey: sponsor.publicKey(),
      memberPublicKey: sponsor.publicKey(),
      asset: USDC,
      networkPassphrase: Networks.TESTNET,
    }),
  "cannot sponsor its own reserves"
);

throws(
  "requires a member public key",
  () =>
    buildSponsoredOnboarding({
      sponsorAccount: sponsorAccount(),
      sponsorPublicKey: sponsor.publicKey(),
      memberPublicKey: "",
      networkPassphrase: Networks.TESTNET,
    }),
  "are required"
);

// ------------------------------------------------------------- reclaiming

{
  const { tx } = buildReclaimReserves({
    sponsorAccount: sponsorAccount(),
    sponsorPublicKey: sponsor.publicKey(),
    memberPublicKey: member.publicKey(),
    asset: USDC,
    networkPassphrase: Networks.TESTNET,
  });
  const kinds = tx.operations.map((o) => o.type);

  // Order matters: revoking the account first would leave the member owning a
  // trustline whose reserve they cannot cover.
  check(
    "revokes the trustline BEFORE the account",
    JSON.stringify(kinds) ===
      JSON.stringify([
        "revokeTrustlineSponsorship",
        "revokeAccountSponsorship",
      ]),
    kinds.join(", ")
  );
  check(
    "revocation targets the member's account",
    tx.operations[1].account === member.publicKey(),
    tx.operations[1].account
  );
}

// --------------------------------------------------------------- capacity

check(
  "a 100 XLM sponsor can onboard 62 members",
  sponsorCapacity(100) === 62,
  String(sponsorCapacity(100))
);
check(
  "a sponsor that cannot cover its own reserve onboards nobody",
  sponsorCapacity(1) === 0,
  String(sponsorCapacity(1))
);
check(
  "capacity accounts for the fee buffer",
  sponsorCapacity(7) === 0,
  String(sponsorCapacity(7))
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
