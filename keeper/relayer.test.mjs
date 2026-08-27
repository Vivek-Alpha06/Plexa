// Relayer validation tests.
//
// These exercise the checks that stop the relayer being a faucet, against the
// LIVE mainnet factory — so `is_group` is a real on-chain lookup, not a mock.
// No sponsored transaction is ever submitted: the sponsor key is a throwaway
// with no balance, and every case here is expected to be refused before the
// submit step. That is deliberate — the point is to prove the refusals work.
//
// Run:  node keeper/relayer.test.mjs
import { spawn } from "node:child_process";
import {
  Keypair, TransactionBuilder, Networks, Account, Contract, Operation, Asset,
} from "@stellar/stellar-sdk";

const FACTORY = "CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO";
const GROUP = "CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D";
const NOT_A_PLEXA_CONTRACT =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"; // USDC SAC
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

const sponsor = Keypair.random();
const member = Keypair.random();
const source = new Account(member.publicKey(), "1");

function build(ops, fee = "100000") {
  const b = new TransactionBuilder(source, {
    fee,
    networkPassphrase: Networks.PUBLIC,
  });
  for (const op of ops) b.addOperation(op);
  const tx = b.setTimeout(60).build();
  tx.sign(member);
  return tx.toXDR();
}

const child = spawn(
  process.execPath,
  ["relayer.mjs"],
  {
    cwd: new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    env: {
      ...process.env,
      SPONSOR_SECRET: sponsor.secret(),
      FACTORY_ID: FACTORY,
      RPC_URL: "https://mainnet.sorobanrpc.com",
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
);
child.stdout.on("data", (d) => process.stdout.write(`  [relayer] ${d}`));
child.stderr.on("data", (d) => process.stderr.write(`  [relayer!] ${d}`));

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return r.json();
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("relayer did not start");
}

async function post(xdr) {
  const res = await fetch(`${BASE}/sponsor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xdr }),
  });
  return { status: res.status, body: await res.json() };
}

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}\n      ${detail}`);
    failed++;
  }
}

try {
  console.log("\nrelayer validation (live mainnet factory)\n");
  const health = await waitForServer();
  check(
    "health reports sponsor account and network",
    health.sponsor === sponsor.publicKey() && health.network === "public",
    JSON.stringify(health)
  );
  check(
    "unfunded sponsor reports paused",
    health.status === "paused",
    `status=${health.status}`
  );

  // 1. A payment is not a contract call — must be refused on shape alone.
  {
    const xdr = build([
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: "100",
      }),
    ]);
    const { body } = await post(xdr);
    check(
      "refuses a payment operation",
      /not sponsorable/.test(body.error ?? ""),
      body.error
    );
  }

  // 2. Two operations — refused before any contract lookup.
  {
    const c = new Contract(GROUP);
    const xdr = build([c.call("get_state"), c.call("get_config")]);
    const { body } = await post(xdr);
    check(
      "refuses multi-operation transactions",
      /exactly 1 operation/.test(body.error ?? ""),
      body.error
    );
  }

  // 3. A contract call to something the factory does not vouch for. This is
  //    the check that matters most: it is a real is_group() call on mainnet.
  {
    const c = new Contract(NOT_A_PLEXA_CONTRACT);
    const xdr = build([c.call("balance")]);
    const { body } = await post(xdr);
    check(
      "refuses a contract the factory does not recognise",
      /not registered with the Plexa factory/.test(body.error ?? ""),
      body.error
    );
  }

  // 4. A fee above the ceiling, on an otherwise-valid Plexa group call.
  {
    const c = new Contract(GROUP);
    const xdr = build([c.call("get_state")], "99000000"); // 9.9 XLM
    const { body } = await post(xdr);
    check(
      "refuses a transaction above the fee ceiling",
      /exceeds the sponsorship ceiling/.test(body.error ?? ""),
      body.error
    );
  }

  // 5. A well-formed call into the registered group passes every validation
  //    check and is only stopped by the unfunded sponsor balance. Reaching
  //    that error proves the allowlist accepted a genuine Plexa group.
  {
    const c = new Contract(GROUP);
    const xdr = build([c.call("get_state")]);
    const { body } = await post(xdr);
    check(
      "accepts a registered Plexa group call (stops at low balance)",
      /balance low/.test(body.error ?? ""),
      body.error
    );
  }

  // 6. Garbage input must not crash the process.
  {
    const { body } = await post("not-valid-xdr");
    check("rejects malformed XDR without crashing", !!body.error, body.error);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
} finally {
  child.kill();
}

process.exit(failed === 0 ? 0 : 1);
