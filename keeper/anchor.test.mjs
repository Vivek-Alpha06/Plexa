// Tests for anchor integration (SEP-1 / SEP-10 / SEP-24 / SEP-31).
//
// The focus is SEP-10 challenge validation, because that is the security
// boundary for every other SEP: the JWT it issues authorizes deposits and
// withdrawals against a member's account, and the flow asks you to sign a
// transaction handed to you by a remote server.
//
// Each hostile case below builds a real challenge with a real (attacker) key
// and asserts we refuse to sign it. No network access required — challenges
// are constructed locally with the SDK's own `buildChallengeTx`.
//
// Run:  node keeper/anchor.test.mjs
import {
  Account, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, WebAuth,
} from "@stellar/stellar-sdk";
import {
  isTerminal, validateChallenge, validateSep31Fields,
} from "./anchor.mjs";

const NET = Networks.TESTNET;
const HOME = "anchor.example.com";
const WEB_AUTH = "auth.anchor.example.com";

const server = Keypair.random();
const attacker = Keypair.random();
const client = Keypair.random();

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

/** Assert `fn` throws, and that the message mentions `expected`. */
function refuses(name, fn, expected) {
  try {
    fn();
    check(name, false, "expected a refusal, but it accepted");
  } catch (e) {
    const ok = expected ? e.message.toLowerCase().includes(expected.toLowerCase()) : true;
    check(name, ok, `got: ${e.message}`);
  }
}

/** A well-formed SEP-10 challenge from `signer`. */
function challenge({ signer = server, homeDomain = HOME, webAuthDomain = WEB_AUTH, account = client.publicKey() } = {}) {
  return WebAuth.buildChallengeTx(
    signer,
    account,
    homeDomain,
    300,
    NET,
    webAuthDomain
  );
}

function validate(xdr, overrides = {}) {
  return validateChallenge({
    challengeXdr: xdr,
    serverSigningKey: server.publicKey(),
    clientPublicKey: client.publicKey(),
    homeDomain: HOME,
    webAuthDomain: WEB_AUTH,
    networkPassphrase: NET,
    ...overrides,
  });
}

console.log("\nanchor integration (SEP-1 / 10 / 24 / 31)\n");

// ------------------------------------------------------- SEP-10: happy path

{
  const xdr = challenge();
  const { clientAccountID, matchedHomeDomain, tx } = validate(xdr);
  check("accepts a well-formed challenge", clientAccountID === client.publicKey());
  check("reports the matched home domain", matchedHomeDomain === HOME);
  check(
    "a genuine challenge has sequence 0 (unsubmittable)",
    tx.sequence === "0",
    tx.sequence
  );
}

// --------------------------------------------------- SEP-10: hostile inputs

refuses(
  "refuses a challenge minted by a spoofed endpoint",
  // A challenge built entirely by an attacker: caught on the source-account
  // check, before signature verification is even reached.
  () => validate(challenge({ signer: attacker })),
  ""
);

{
  // The sharper case: the challenge names the *real* server as source, so it
  // passes the source check, but the signature is the attacker's. This is what
  // actually exercises SIGNING_KEY verification.
  const genuine = TransactionBuilder.fromXDR(challenge(), NET);
  genuine.signatures.splice(0, genuine.signatures.length);
  genuine.sign(attacker);

  refuses(
    "refuses a challenge whose signature is not the anchor's SIGNING_KEY",
    () => validate(genuine.toXDR()),
    "not signed by server"
  );
}

refuses(
  "refuses a challenge for a different home domain",
  // Otherwise a signature obtained by anchor A replays against anchor B.
  () => validate(challenge({ homeDomain: "evil.example.com" })),
  "home domain"
);

refuses(
  "refuses a challenge addressed to another account",
  () => validate(challenge({ account: attacker.publicKey() })),
  ""
);

refuses(
  "refuses a challenge with the wrong web_auth_domain",
  () => validate(challenge({ webAuthDomain: "evil.example.com" })),
  ""
);

refuses(
  "refuses an empty challenge",
  () => validate(""),
  "no challenge"
);

refuses(
  "refuses when the anchor toml has no SIGNING_KEY",
  () => validate(challenge(), { serverSigningKey: null }),
  "SIGNING_KEY"
);

{
  // The classic SEP-10 phishing vector: a *submittable* transaction dressed up
  // as a challenge. Signing it would authorize a real payment.
  const acct = new Account(server.publicKey(), "42");
  const hostile = new TransactionBuilder(acct, {
    fee: BASE_FEE,
    networkPassphrase: NET,
  })
    .addOperation(
      Operation.payment({
        destination: attacker.publicKey(),
        asset: (await import("@stellar/stellar-sdk")).Asset.native(),
        amount: "1000",
        source: client.publicKey(),
      })
    )
    .setTimeout(300)
    .build();
  hostile.sign(server);

  refuses(
    "refuses a submittable transaction posing as a challenge",
    () => validate(hostile.toXDR()),
    ""
  );
}

{
  // Wrong network: a challenge valid on public replayed onto testnet, or the
  // reverse, must not validate.
  const xdr = WebAuth.buildChallengeTx(
    server,
    client.publicKey(),
    HOME,
    300,
    Networks.PUBLIC,
    WEB_AUTH
  );
  refuses(
    "refuses a challenge built for a different network",
    () => validate(xdr),
    ""
  );
}

// ------------------------------------------------------------ SEP-24 status

check("completed is terminal", isTerminal("completed"));
check("refunded is terminal", isTerminal("refunded"));
check("error is terminal", isTerminal("error"));
check("expired is terminal", isTerminal("expired"));
check("pending_user_transfer_start is NOT terminal", !isTerminal("pending_user_transfer_start"));
check("incomplete is NOT terminal", !isTerminal("incomplete"));

// ------------------------------------------------------ SEP-31 field checks

const info = {
  receive: {
    USDC: {
      enabled: true,
      min_amount: 1,
      max_amount: 1000,
      fields: {
        transaction: {
          receiver_routing_number: { description: "bank routing" },
          receiver_account_number: { description: "bank account" },
          type: { description: "payment type", optional: true },
        },
      },
    },
    NGNT: { enabled: false, fields: {} },
  },
};

{
  const res = validateSep31Fields(info, "USDC", {
    transaction: {
      receiver_routing_number: "123",
      receiver_account_number: "456",
    },
  });
  check("accepts a payment with all required fields", res.ok === true);
  check("reports the anchor's amount bounds", res.amountMin === 1 && res.amountMax === 1000);
}

refuses(
  "names the specific missing field",
  () =>
    validateSep31Fields(info, "USDC", {
      transaction: { receiver_routing_number: "123" },
    }),
  "receiver_account_number"
);

refuses(
  "refuses an asset the anchor does not receive",
  () => validateSep31Fields(info, "EURC", {}),
  "does not receive"
);

refuses(
  "refuses a disabled asset",
  () => validateSep31Fields(info, "NGNT", {}),
  "disabled"
);

{
  // Optional fields must not be demanded — over-strict validation would block
  // legitimate payments.
  const res = validateSep31Fields(info, "USDC", {
    transaction: {
      receiver_routing_number: "123",
      receiver_account_number: "456",
    },
  });
  check("does not demand fields marked optional", res.ok === true);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
