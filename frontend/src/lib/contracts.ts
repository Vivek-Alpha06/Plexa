// Contract interaction layer over @stellar/stellar-sdk. Reads use simulation;
// writes prepare + sign (Freighter) + submit + poll.
import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  FACTORY_ID,
  USDC_ID,
  XLM_ID,
  ORACLE_ID,
  DEMO,
} from "./config";
import { demoFactory, demoGroup, demoOraclePrice } from "./demo";
import { getDemoBalance } from "./demoWallet";
import { signTx } from "./wallet";
import type {
  GroupConfig,
  GroupState,
  Member,
  Bid,
  JoinRequest,
  HistoryEntry,
  Visibility,
  GroupStatus,
  Phase,
  CollateralAsset,
} from "../types";

const server = new rpc.Server(RPC_URL, {
  allowHttp: RPC_URL.startsWith("http://"),
});

// Valid placeholder account used as the source for read-only simulations.
const READ_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// ----------------------------------------------------------------- arg helpers
const addr = (a: string) => nativeToScVal(a, { type: "address" });
const u32 = (n: number) => nativeToScVal(n, { type: "u32" });
const u64 = (n: number | bigint) => nativeToScVal(BigInt(n), { type: "u64" });
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" });
const bool = (b: boolean) => nativeToScVal(b);
const str = (s: string) => nativeToScVal(s, { type: "string" });
const sym = (s: string) => nativeToScVal(s, { type: "symbol" });

/**
 * Build a Soroban struct (#[contracttype]) ScVal from named fields. Structs
 * serialize as an ScMap keyed by field-name symbols, sorted by key — the SDK's
 * XDR writer requires the entries pre-sorted, so we sort here.
 */
function structVal(fields: Record<string, xdr.ScVal>): xdr.ScVal {
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

const ASSET_CODE: Record<CollateralAsset, number> = { Usdc: 0, Xlm: 1 };

function normCollateralAsset(v: unknown): CollateralAsset {
  if (v === 1 || v === "1" || v === "Xlm") return "Xlm";
  return "Usdc";
}

function normEnum(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return String(v[0]);
  if (v && typeof v === "object" && "tag" in v) return String((v as { tag: unknown }).tag);
  return String(v);
}

// Soroban unit enums with numeric discriminants (Visibility, GroupStatus,
// Phase) serialize as raw u32 across the contract boundary, so scValToNative
// hands back a number — map each to its UI string. Tolerate already-normalized
// strings too, in case the ABI ever changes.
function normVisibility(v: unknown): Visibility {
  if (v === 0 || v === "0" || v === "Public") return "Public";
  if (v === 1 || v === "1" || v === "Private") return "Private";
  return normEnum(v) as Visibility;
}

function normStatus(v: unknown): GroupStatus {
  if (v === 0 || v === "0" || v === "Forming") return "Forming";
  if (v === 1 || v === "1" || v === "Active") return "Active";
  if (v === 2 || v === "2" || v === "Completed") return "Completed";
  return normEnum(v) as GroupStatus;
}

function normPhase(v: unknown): Phase {
  if (v === 0 || v === "0" || v === "Contribution") return "Contribution";
  if (v === 1 || v === "1" || v === "Settlement") return "Settlement";
  if (v === 2 || v === "2" || v === "Auction") return "Auction";
  if (v === 3 || v === "3" || v === "Payout") return "Payout";
  return normEnum(v) as Phase;
}

// --------------------------------------------------------------------- reads
async function read<T>(contractId: string, method: string, args: xdr.ScVal[]): Promise<T> {
  const account = new Account(READ_SOURCE, "0");
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`${method} failed: ${sim.error}`);
  }
  const retval = sim.result?.retval;
  return (retval ? scValToNative(retval) : undefined) as T;
}

// --------------------------------------------------------------------- writes
export async function invoke(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  walletAddress: string
): Promise<void> {
  const account = await server.getAccount(walletAddress);
  const contract = new Contract(contractId);
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const prepared = await server.prepareTransaction(built);
  const signed = await signTx(prepared.toXDR(), walletAddress);
  const signedTx = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE);

  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  await pollTx(sent.hash);
}

/**
 * Raw JSON-RPC call. We bypass the SDK's typed `server.getTransaction` on
 * purpose: Protocol 23 returns `TransactionMetaV4`, which @stellar/stellar-sdk
 * 13.x cannot decode — its parser eagerly runs `xdr.TransactionMeta.fromXDR`
 * and throws "Bad union switch: 4" (see rpc/parsers.js `parseTransactionInfo`).
 * The raw `status` field needs no XDR decoding, so polling stays version-proof.
 * Remove once the SDK is upgraded to a Protocol 23 build (v14+).
 */
async function rpcCall<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result as T;
}

async function pollTx(hash: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const raw = await rpcCall<{ status: string; resultXdr?: string }>(
      "getTransaction",
      { hash }
    );
    if (raw.status === "SUCCESS") return;
    if (raw.status === "FAILED") {
      throw new Error(`transaction failed: ${raw.resultXdr ?? JSON.stringify(raw)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("transaction timed out waiting for confirmation");
}

// =================================================================== Factory
const realFactory = {
  async createGroup(
    wallet: string,
    p: {
      owner: string;
      name: string;
      description: string;
      targetMembers: number;
      visibility: Visibility;
      currency: CollateralAsset;
      periodLength: number;
      contributionWindow: number;
      settlementWindow: number;
      auctionWindow: number;
      contributionAmount: bigint;
      minReputation: number;
    }
  ): Promise<string> {
    // The contract returns the new group Address, but that value only lives in
    // the transaction result meta — which we can't decode on this SDK (see
    // pollTx). Recover it from the registry instead: the group we just created
    // is the most recent entry appended to `get_all_groups`.
    const before = await read<string[]>(FACTORY_ID, "get_all_groups", []);
    // create_group takes a single CreateParams struct (arg-count limit).
    const params = structVal({
      owner: addr(p.owner),
      name: str(p.name),
      description: str(p.description),
      target_members: u32(p.targetMembers),
      visibility: u32(p.visibility === "Public" ? 0 : 1),
      currency: u32(ASSET_CODE[p.currency]),
      period_length: u64(p.periodLength),
      contribution_window: u64(p.contributionWindow),
      settlement_window: u64(p.settlementWindow),
      auction_window: u64(p.auctionWindow),
      contribution_amount: i128(p.contributionAmount),
      min_reputation: u32(p.minReputation),
    });
    await invoke(FACTORY_ID, "create_group", [params], wallet);
    const after = await read<string[]>(FACTORY_ID, "get_all_groups", []);
    // Prefer an id that wasn't there before; fall back to the last entry.
    const created = after.find((id) => !before.includes(id));
    return created ?? after[after.length - 1] ?? "";
  },
  getPublicGroups: () => read<string[]>(FACTORY_ID, "get_public_groups", []),
  getAllGroups: () => read<string[]>(FACTORY_ID, "get_all_groups", []),
  repOf: (a: string) => read<number>(FACTORY_ID, "rep_of", [addr(a)]),
  syncReputation: (wallet: string, group: string) =>
    invoke(FACTORY_ID, "sync_reputation", [addr(group)], wallet),
};

/** Factory client — backed by the demo store when VITE_DEMO=true. */
export const factory = DEMO ? demoFactory : realFactory;

// ===================================================================== Group
function realGroup(id: string) {
  return {
    id,
    async getConfig(): Promise<GroupConfig> {
      const c = await read<GroupConfig>(id, "get_config", []);
      return {
        ...c,
        visibility: normVisibility(c.visibility),
        currency: normCollateralAsset(c.currency),
      };
    },
    async getState(): Promise<GroupState> {
      const s = await read<GroupState>(id, "get_state", []);
      return { ...s, status: normStatus(s.status) };
    },
    async getMembers(): Promise<Member[]> {
      const ms = await read<Member[]>(id, "get_members", []);
      return ms.map((m) => ({
        ...m,
        collateral_asset: normCollateralAsset(m.collateral_asset),
      }));
    },
    async getPhase(): Promise<Phase> {
      return normPhase(await read(id, "get_phase", []));
    },
    getClaimable: (a: string) => read<bigint>(id, "get_claimable", [addr(a)]),
    getCurrentBid: () => read<Bid | null>(id, "get_current_bid", []),
    getJoinRequest: (a: string) =>
      read<JoinRequest | null>(id, "get_join_request", [addr(a)]),
    getPendingJoins: () => read<string[]>(id, "get_pending_joins", []),
    getHistory: () => read<HistoryEntry[]>(id, "get_history", []),
    hasWon: (a: string) => read<boolean>(id, "has_won", [addr(a)]),
    getSettled: (period: number) =>
      read<boolean>(id, "get_settled", [u32(period)]),
    getPot: (period: number) => read<bigint>(id, "get_pot", [u32(period)]),
    /** Health factor (10_000 = 1.0), or null for USDC-collateral members. */
    healthFactor: (a: string) =>
      read<number | null>(id, "health_factor", [addr(a)]),
    /** Token units to lock now for asset 0=USDC / 1=XLM (oracle-sized). */
    requiredCollateral: (asset: CollateralAsset) =>
      read<bigint>(id, "required_collateral", [u32(ASSET_CODE[asset])]),
    collateralUnlockAt: () => read<bigint>(id, "collateral_unlock_at", []),

    requestJoin: (wallet: string) =>
      invoke(id, "request_join", [addr(wallet)], wallet),
    voteOnJoin: (wallet: string, applicant: string, approve: boolean) =>
      invoke(id, "vote_on_join", [addr(wallet), addr(applicant), bool(approve)], wallet),
    lockCollateral: (wallet: string, asset: CollateralAsset = "Usdc") =>
      invoke(id, "lock_collateral", [addr(wallet), u32(ASSET_CODE[asset])], wallet),
    topUp: (wallet: string, asset: CollateralAsset, amount: bigint) =>
      invoke(id, "top_up", [addr(wallet), u32(ASSET_CODE[asset]), i128(amount)], wallet),
    contribute: (wallet: string) =>
      invoke(id, "contribute", [addr(wallet)], wallet),
    settle: (wallet: string) => invoke(id, "settle", [], wallet),
    placeBid: (wallet: string, discount: bigint) =>
      invoke(id, "place_bid", [addr(wallet), i128(discount)], wallet),
    resolvePeriod: (wallet: string) =>
      invoke(id, "resolve_period", [], wallet),
    claimPayout: (wallet: string) =>
      invoke(id, "claim_payout", [addr(wallet)], wallet),
    withdrawCollateral: (wallet: string) =>
      invoke(id, "withdraw_collateral", [addr(wallet)], wallet),
  };
}

/** Group client — backed by the demo store when VITE_DEMO=true. */
export function group(id: string) {
  return DEMO ? demoGroup(id) : realGroup(id);
}

export type GroupClient = ReturnType<typeof realGroup>;

// ====================================================================== USDC
export async function usdcBalance(a: string): Promise<bigint> {
  if (DEMO) return getDemoBalance(a);
  if (!USDC_ID) return 0n;
  try {
    return await read<bigint>(USDC_ID, "balance", [addr(a)]);
  } catch {
    return 0n;
  }
}

// ======================================================================= XLM
export async function xlmBalance(a: string): Promise<bigint> {
  if (DEMO) return getDemoBalance(a); // demo tracks a single simulated balance
  if (!XLM_ID) return 0n;
  try {
    return await read<bigint>(XLM_ID, "balance", [addr(a)]);
  } catch {
    return 0n;
  }
}

// ==================================================================== Oracle
/** Live XLM price in USDC units (7dp). Falls back to the demo feed offline. */
export async function xlmPrice(): Promise<bigint> {
  if (DEMO) return demoOraclePrice();
  if (!ORACLE_ID) return 0n;
  try {
    return await read<bigint>(ORACLE_ID, "price", []);
  } catch {
    return 0n;
  }
}
