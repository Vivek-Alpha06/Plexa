import { writeFileSync, readFileSync } from 'node:fs';
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
  xdr,
  Horizon
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://mainnet.sorobanrpc.com';
const server = new rpc.Server(RPC_URL);
const horizon = new Horizon.Server('https://horizon.stellar.org');

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

const deployerKp = Keypair.fromSecret(requireSecret('DEPLOYER_SECRET'));
const FACTORY_ID = 'CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO';

function addr(a) { return new Address(a).toScVal(); }
function str(s) { return xdr.ScVal.scvString(s); }
function sym(s) { return xdr.ScVal.scvSymbol(s); }
function u32(n) { return xdr.ScVal.scvU32(n); }
function u64(n) { return xdr.ScVal.scvU64(new xdr.Uint64(n)); }
function i128(n) {
  const v = BigInt(n);
  const hi = BigInt.asIntN(64, v >> 64n);
  const lo = BigInt.asUintN(64, v);
  return xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(hi), lo: new xdr.Uint64(lo) }));
}
function bool(b) { return xdr.ScVal.scvBool(b); }

function structVal(fields) {
  const entries = Object.keys(fields)
    .sort()
    .map(
      (k) =>
        new xdr.ScMapEntry({
          key: sym(k),
          val: fields[k],
        })
    );
  return xdr.ScVal.scvMap(entries);
}

async function sendAndPoll(tx, signers) {
  const prepared = await server.prepareTransaction(tx);
  for (const s of signers) {
    prepared.sign(s);
  }
  const sendRes = await server.sendTransaction(prepared);
  if (sendRes.status !== 'PENDING') {
    throw new Error('Send failed: ' + JSON.stringify(sendRes));
  }
  const txHash = sendRes.hash;

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const txStatus = await server.getTransaction(txHash);
    if (txStatus.status === 'SUCCESS') {
      return { txHash, txStatus };
    } else if (txStatus.status === 'FAILED') {
      throw new Error('TX Failed on Mainnet: ' + JSON.stringify(txStatus));
    }
  }
  throw new Error('Timeout waiting for tx: ' + txHash);
}

async function main() {
  console.log('=== MAINNET 25 USERS ONBOARDING SCRIPT ===');
  console.log('Deployer:', deployerKp.publicKey());

  // 1. Create a Public Group on Factory
  console.log('\n1. Creating Mainnet Group on Factory...');
  let acct = await server.getAccount(deployerKp.publicKey());

  const params = structVal({
    owner: addr(deployerKp.publicKey()),
    name: str('Plexa Alpha Savings'),
    description: str('Decentralized ROSCA savings circle on Stellar Mainnet'),
    target_members: u32(30),
    visibility: u32(0), // Public
    currency: u32(1), // XLM
    period_length: u64(604800),
    contribution_window: u64(86400),
    settlement_window: u64(86400),
    auction_window: u64(86400),
    contribution_amount: i128(10000000n),
    min_reputation: u32(0),
  });

  const factoryContract = new Contract(FACTORY_ID);
  const createTx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
    fee: (100000).toString(),
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(factoryContract.call('create_group', params))
    .setTimeout(90)
    .build();

  const { txHash: groupCreateTxHash, txStatus: createRes } = await sendAndPoll(createTx, [deployerKp]);
  const groupAddress = Address.fromScVal(createRes.returnValue).toString();
  console.log('🎉 Mainnet Group Created:', groupAddress);
  console.log('   Create TX:', groupCreateTxHash);
  console.log('   Explorer: https://stellar.expert/explorer/public/contract/' + groupAddress);

  const groupContract = new Contract(groupAddress);
  const userRecords = [];

  // 2. Loop 25 users
  console.log('\n2. Onboarding 25 Unique Users on Mainnet...');
  for (let i = 1; i <= 25; i++) {
    console.log(`\n--- Processing User #${i} / 25 ---`);
    const userKp = Keypair.random();
    const userAddress = userKp.publicKey();
    console.log('  User Address:', userAddress);

    // a. Fund user account with 1.3 XLM
    acct = await server.getAccount(deployerKp.publicKey());
    const fundTx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        Operation.createAccount({
          destination: userAddress,
          startingBalance: '1.3',
        })
      )
      .setTimeout(60)
      .build();

    fundTx.sign(deployerKp);
    const fundRes = await horizon.submitTransaction(fundTx);
    console.log('  Account Funded. TX:', fundRes.hash);

    // b. User requests to join group
    let userAcct = await server.getAccount(userAddress);
    const joinTx = new TransactionBuilder(new Account(userAcct.accountId(), userAcct.sequenceNumber()), {
      fee: (50000).toString(),
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(groupContract.call('request_join', addr(userAddress)))
      .setTimeout(90)
      .build();

    const { txHash: joinTxHash } = await sendAndPoll(joinTx, [userKp]);
    console.log('  Join Requested. TX:', joinTxHash);

    // c. Admin approves user in governance vote
    acct = await server.getAccount(deployerKp.publicKey());
    const voteTx = new TransactionBuilder(new Account(acct.accountId(), acct.sequenceNumber()), {
      fee: (50000).toString(),
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        groupContract.call(
          'vote_on_join',
          addr(deployerKp.publicKey()),
          addr(userAddress),
          bool(true)
        )
      )
      .setTimeout(90)
      .build();

    const { txHash: voteTxHash } = await sendAndPoll(voteTx, [deployerKp]);
    console.log('  Governance Vote Approved! Member Joined. TX:', voteTxHash);

    // d. Merge user account back to deployer to recycle the ~1.25 XLM
    userAcct = await server.getAccount(userAddress);
    const mergeTx = new TransactionBuilder(new Account(userAcct.accountId(), userAcct.sequenceNumber()), {
      fee: BASE_FEE,
      networkPassphrase: Networks.PUBLIC,
    })
      .addOperation(
        Operation.accountMerge({
          destination: deployerKp.publicKey(),
        })
      )
      .setTimeout(60)
      .build();

    mergeTx.sign(userKp);
    await horizon.submitTransaction(mergeTx);
    console.log('  XLM Recycled back to Deployer!');

    userRecords.push({
      userNumber: i,
      address: userAddress,
      fundTxHash: fundRes.hash,
      joinTxHash,
      voteTxHash,
    });
  }

  // 3. Save JSON records
  writeFileSync(
    'C:/Users/vivek/OneDrive/Documents/Projects/Plexa(v1)/scripts/mainnet-users.json',
    JSON.stringify({ groupAddress, groupCreateTxHash, users: userRecords }, null, 2),
    'utf8'
  );

  console.log('\n=== ALL 25 USERS SUCCESSFULLY ONBOARDED ON MAINNET! ===');
}

main().catch(console.error);
