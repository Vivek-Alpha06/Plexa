import { readFileSync } from "node:fs";
import {
  TransactionBuilder, Networks, rpc, Operation, Account, BASE_FEE,
} from "@stellar/stellar-sdk";

const server = new rpc.Server("https://mainnet.sorobanrpc.com");
const SRC = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const XLM_USD = 0.15691;
const acct = await server.getAccount(SRC);

const base = process.env.WASM_DIR || "../contracts/target/wasm32v1-none/release/";
const items = [
  ["plexa_group.wasm", "group wasm (one-time)"],
  ["plexa_factory.wasm", "factory wasm (one-time)"],
  ["plexa_oracle.wasm", "oracle wasm (one-time)"],
];

let total = 0;
console.log("MAINNET UPLOAD COSTS (measured via simulation)\n");
for (const [file, label] of items) {
  const wasm = readFileSync(base + file);
  const tx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
    fee: BASE_FEE, networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (sim.error) { console.log(`  ${label}: sim error ${sim.error}`); continue; }
  const fee = Number(sim.minResourceFee);
  total += fee;
  console.log(
    `  ${label.padEnd(26)} ${String(wasm.length).padStart(6)} B  ` +
    `${(fee / 1e7).toFixed(2).padStart(7)} XLM  $${((fee / 1e7) * XLM_USD).toFixed(2)}`
  );
}
console.log("\n  " + "TOTAL uploads".padEnd(26) + "        " +
  `${(total / 1e7).toFixed(2).padStart(7)} XLM  $${((total / 1e7) * XLM_USD).toFixed(2)}`);
console.log("\nNote: contract *instance* creation (factory, oracle, each group) is");
console.log("billed separately and is much smaller than code upload.");
