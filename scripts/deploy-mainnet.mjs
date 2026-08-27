import { readFileSync, writeFileSync } from 'node:fs';
import {
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
  Operation,
  Account,
  BASE_FEE,
  Contract,
  Address,
  scValToNative,
  nativeToScVal,
  xdr
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://mainnet.sorobanrpc.com';
const server = new rpc.Server(RPC_URL);

function requireSecret(name) {
  const s = process.env[name];
  if (!s) {
    console.error(
      `${name} is not set.
` +
      `Never hardcode a Stellar secret key in a file that gets committed —
` +
      `this repo is public, and a committed key stays in git history forever.
` +
      `Pass it in for one command instead:  ${name}="S..." node ${process.argv[1]}`
    );
    process.exit(1);
  }
  return s;
}

const kp = Keypair.fromSecret(requireSecret('DEPLOYER_SECRET'));
console.log('Deployer Public Key:', kp.publicKey());

async function sendAndPoll(tx) {
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(kp);
  const sendRes = await server.sendTransaction(prepared);
  if (sendRes.status !== 'PENDING') {
    throw new Error('Send failed: ' + JSON.stringify(sendRes));
  }
  const txHash = sendRes.hash;
  console.log('  Submitted TX:', txHash);
  console.log('  Explorer: https://stellar.expert/explorer/public/tx/' + txHash);

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const txStatus = await server.getTransaction(txHash);
    if (txStatus.status === 'SUCCESS') {
      return txStatus;
    } else if (txStatus.status === 'FAILED') {
      throw new Error('TX Failed on Mainnet: ' + JSON.stringify(txStatus));
    }
  }
  throw new Error('Timeout waiting for tx confirmation');
}

async function main() {
  console.log('=== MAINNET DEPLOYMENT: FACTORY STEP ===\n');
  const base = 'C:/Users/vivek/OneDrive/Documents/Projects/Plexa(v1)/contracts/target/wasm32v1-none/release/';

  const groupWasmHash = '4602c2c29cc61b2a239c45fbf43e12b3d430d765ca33fa298ddab73e99cd3148';
  console.log('Group WASM Hash (already uploaded):', groupWasmHash);

  // 1. Upload Factory WASM
  console.log('\n1. Uploading plexa_factory.wasm to Mainnet...');
  let acct = await server.getAccount(kp.publicKey());
  const factoryWasm = readFileSync(base + 'plexa_factory.wasm');
  const factoryUploadTx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
    fee: (100000).toString(),
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(Operation.uploadContractWasm({ wasm: factoryWasm }))
    .setTimeout(90)
    .build();

  const factoryUploadRes = await sendAndPoll(factoryUploadTx);
  const factoryWasmHash = factoryUploadRes.returnValue.bytes().toString('hex');
  console.log('✅ Factory WASM Hash:', factoryWasmHash);

  // 2. Deploy Factory Instance
  console.log('\n2. Deploying Factory Instance on Mainnet...');
  acct = await server.getAccount(kp.publicKey());

  const XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';
  const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
  const REFLECTOR = 'CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN';
  const ROUTER = 'CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH';

  const constructorArgs = [
    new Address(kp.publicKey()).toScVal(),
    nativeToScVal(Buffer.from(groupWasmHash, 'hex'), { type: 'bytes' }),
    new Address(USDC).toScVal(),
    new Address(XLM).toScVal(),
    new Address(REFLECTOR).toScVal(),
    new Address(ROUTER).toScVal(),
  ];

  const deployTx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
    fee: (100000).toString(),
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.createCustomContract({
        wasmHash: Buffer.from(factoryWasmHash, 'hex'),
        address: new Address(kp.publicKey()),
        constructorArgs,
      })
    )
    .setTimeout(90)
    .build();

  const deployRes = await sendAndPoll(deployTx);
  const factoryId = Address.fromScVal(deployRes.returnValue).toString();
  console.log('🎉 Factory Contract ID:', factoryId);
  console.log('  Factory on StellarExpert: https://stellar.expert/explorer/public/contract/' + factoryId);

  // Save info
  const envContent = `VITE_NETWORK=mainnet\nVITE_RPC_URL=https://mainnet.sorobanrpc.com\nVITE_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"\nVITE_FACTORY_ID=${factoryId}\nVITE_ORACLE_ID=${REFLECTOR}\nVITE_USDC_ID=${USDC}\nVITE_XLM_ID=${XLM}\nVITE_ROUTER_ID=${ROUTER}\n`;
  writeFileSync('C:/Users/vivek/OneDrive/Documents/Projects/Plexa(v1)/frontend/.env', envContent, 'utf8');
  console.log('\n✅ Updated frontend/.env with Mainnet Contract IDs!');
}

main().catch(console.error);
