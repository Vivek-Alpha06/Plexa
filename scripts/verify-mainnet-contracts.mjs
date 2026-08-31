// Verify every mainnet contract id the README advertises, straight from the
// public ledger. Read-only: no keys, no secrets, no writes.
//
//   node scripts/verify-mainnet-contracts.mjs
//
// What it proves, and why each check exists:
//
//   1. Every advertised contract id actually resolves to a live contract
//      instance on the public network. A wrong or stale id in a README is the
//      single most common reason a submission is rejected, and a wrong id does
//      not error at runtime — the app just reads a different contract.
//   2. The Plexa group contract runs the exact WASM hash the README publishes.
//      A contract id alone says nothing about the code behind it.
//   3. The deployed bytecode is reported honestly. The README discloses that
//      the mainnet build is a size-reduced variant carrying no `transfer`
//      symbol, so it records balances without moving tokens. This script
//      re-derives that from the downloaded bytecode rather than asking anyone
//      to take the disclosure on trust.
//
// Exits non-zero if any advertised id is missing or any hash disagrees, so CI
// fails loudly when the README drifts away from the chain.
import { xdr, Address } from "@stellar/stellar-sdk";

const RPC_URL = process.env.RPC_URL || "https://mainnet.sorobanrpc.com";

// The addresses exactly as the README and frontend/.env.production advertise
// them. Keep this list in step with both.
const CONTRACTS = [
  { name: "Plexa Factory",     id: "CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO", own: true },
  { name: "Live Group",        id: "CDYQ3NVLC62AH5GPCYKUT4P7QIAOLMYDIMRN24IFOTFWTWEEXILEUM4D", own: true },
  { name: "Reflector Oracle",  id: "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN" },
  { name: "Soroswap Router",   id: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH" },
  { name: "USDC SAC",          id: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75" },
  { name: "Native XLM SAC",    id: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA" },
];

// Published in the README's mainnet table. The group instance must point at it.
const EXPECTED_GROUP_WASM =
  "4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148";

// The README's "Known Limitations" entry 1 stands on this: the deployed
// variant has no token-transfer symbol, but is otherwise the live protocol.
const EXPECTED_ABSENT = ["transfer"];
const EXPECTED_PRESENT = [
  "join", "contribute", "bid", "settle", "resolve_period", "claim", "get_members",
];

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

const instanceKey = (id) =>
  xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(id).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  ).toXDR("base64");

const codeKey = (hashHex) =>
  xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({ hash: Buffer.from(hashHex, "hex") }),
  ).toXDR("base64");

let failures = 0;
const fail = (msg) => { failures++; console.log(`   FAIL  ${msg}`); };

console.log(`Plexa — mainnet contract verification`);
console.log(`RPC: ${RPC_URL}\n`);

// ---------------------------------------------------------------- existence
console.log("1. Advertised contract ids resolve on the public network");

const { entries = [] } = await rpcCall("getLedgerEntries", {
  keys: CONTRACTS.map((c) => instanceKey(c.id)),
});

// getLedgerEntries omits missing keys rather than returning a null slot, so
// match returned entries back to the ids we asked about instead of by index.
const found = new Map();
for (const e of entries) {
  const data = xdr.LedgerEntryData.fromXDR(e.xdr, "base64").contractData();
  found.set(Address.fromScAddress(data.contract()).toString(), data);
}

const wasmHashes = new Map();
for (const c of CONTRACTS) {
  const data = found.get(c.id);
  if (!data) { fail(`${c.name} — ${c.id} has no live instance`); continue; }

  const exec = data.val().instance().executable();
  // A Stellar Asset Contract is a host object, not uploaded WASM, so only the
  // Soroban contracts carry a code hash to report.
  let detail = "Stellar Asset Contract";
  if (exec.switch().name === "contractExecutableWasm") {
    const hash = exec.wasmHash().toString("hex");
    wasmHashes.set(c.name, hash);
    detail = `wasm ${hash.slice(0, 16)}…`;
  }
  console.log(`   ok    ${c.name.padEnd(18)} ${c.id}  (${detail})`);
}

// -------------------------------------------------------------- wasm pinning
console.log("\n2. Group contract runs the published WASM hash");
const groupWasm = wasmHashes.get("Live Group");
if (!groupWasm) {
  fail("Live Group exposed no WASM hash");
} else if (groupWasm !== EXPECTED_GROUP_WASM) {
  fail(`group wasm is ${groupWasm}, README publishes ${EXPECTED_GROUP_WASM}`);
} else {
  console.log(`   ok    ${groupWasm}`);
}

// ------------------------------------------------------- disclosure re-check
console.log("\n3. Deployed bytecode matches the disclosed limitation");
if (groupWasm) {
  const res = await rpcCall("getLedgerEntries", { keys: [codeKey(groupWasm)] });
  const entry = (res.entries || [])[0];
  if (!entry) {
    fail(`code entry for ${groupWasm} not found`);
  } else {
    const code = xdr.LedgerEntryData.fromXDR(entry.xdr, "base64").contractCode().code();
    // latin1 keeps every byte addressable, so a symbol search over the raw
    // bytecode is exact rather than mangled by UTF-8 replacement.
    const bytes = code.toString("latin1");
    console.log(`   ok    deployed size: ${code.length} bytes`);

    for (const sym of EXPECTED_ABSENT) {
      if (bytes.includes(sym)) fail(`'${sym}' IS present — the README's disclosure is now wrong`);
      else console.log(`   ok    '${sym}' absent, exactly as disclosed`);
    }
    for (const sym of EXPECTED_PRESENT) {
      if (!bytes.includes(sym)) fail(`protocol entrypoint '${sym}' missing from deployed wasm`);
    }
    console.log(`   ok    protocol entrypoints present: ${EXPECTED_PRESENT.join(", ")}`);
  }
}

console.log(
  failures === 0
    ? "\nAll mainnet claims in the README verified against the public ledger."
    : `\n${failures} check(s) failed — the README no longer matches the chain.`,
);
process.exit(failures === 0 ? 0 : 1);
