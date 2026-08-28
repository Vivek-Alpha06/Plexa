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
import { recordTx } from "./txlog";
import { trySponsoredSubmit } from "./sponsor";
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
export async function read<T>(contractId: string, method: string, args: xdr.ScVal[]): Promise<T> {
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
/**
 * Build → sign → submit → confirm. Resolves with the on-chain transaction
 * hash so callers can record it and link the user to a block explorer; every
 * write in the app is verifiable by a third party this way.
 */
export async function invoke(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  walletAddress: string
): Promise<string> {
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

  // Gasless path: hand the member-signed envelope to the relayer, which wraps
  // it in a fee bump and pays. The member's signature already authorises the
  // contract call, so sponsorship changes who pays the fee and nothing else.
  // A null result means sponsorship was unavailable or declined — fall through
  // and submit normally so a member holding XLM is never blocked by an outage.
  const sponsored = await trySponsoredSubmit(signed);
  if (sponsored) {
    await pollTx(sponsored.hash);
    recordTx({
      hash: sponsored.hash,
      method,
      contractId,
      address: walletAddress,
      sponsoredBy: sponsored.sponsoredBy,
    });
    return sponsored.hash;
  }

  const signedTx = TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(`submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  await pollTx(sent.hash);
  recordTx({ hash: sent.hash, method, contractId, address: walletAddress });
  return sent.hash;
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

interface RawTx {
  status: string;
  resultXdr?: string;
  diagnosticEventsXdr?: string[];
}

async function pollTx(hash: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const raw = await rpcCall<RawTx>("getTransaction", { hash });
    if (raw.status === "SUCCESS") return;
    if (raw.status === "FAILED") throw new Error(describeFailure(raw, hash));
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("transaction timed out waiting for confirmation");
}

/**
 * Turn a failed transaction into something a human can act on. The raw
 * `resultXdr` is base64 and tells the user nothing; the contract's own
 * diagnostic events name the actual cause, so prefer those.
 */
function describeFailure(raw: RawTx, hash: string): string {
  for (const d of raw.diagnosticEventsXdr ?? []) {
    try {
      const body = xdr.DiagnosticEvent.fromXDR(d, "base64").event().body().v0();
      const topics = body.topics();
      if (!topics.length || scValToNative(topics[0]) !== "error") continue;
      const err = topics[1] ? scValToNative(topics[1]) : null;
      const detail = scValToNative(body.data());
      const parts = Array.isArray(detail) ? detail : [detail];
      const kind = err && typeof err === "object" && "value" in err ? String(err.value) : "error";
      return `transaction failed (${kind}): ${parts.filter(Boolean).join(" — ")} [${hash}]`;
    } catch {
      // Undecodable event — keep scanning for one that parses.
    }
  }
  // No usable diagnostic: fall back to naming the operation result.
  try {
    const r = xdr.TransactionResult.fromXDR(raw.resultXdr ?? "", "base64").result();
    const op = r.results()[0]?.tr();
    const name = op?.invokeHostFunctionResult().switch().name ?? r.switch().name;
    return `transaction failed (${name}) [${hash}]`;
  } catch {
    return `transaction failed [${hash}]`;
  }
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
  /**
   * Was this group deployed by the configured factory?
   */
  isGroup: (a: string) => read<boolean>(FACTORY_ID, "is_group", [addr(a)]),
  repOf: (a: string) => read<number>(FACTORY_ID, "rep_of", [addr(a)]),
  syncReputation: (wallet: string, group: string) =>
    invoke(FACTORY_ID, "sync_reputation", [addr(group)], wallet),
};

const fallbackFactory = {
  async createGroup(wallet: string, p: any): Promise<string> {
    try {
      return await realFactory.createGroup(wallet, p);
    } catch (e) {
      console.warn("[contracts.ts] createGroup failed, falling back to demo:", e);
      return await demoFactory.createGroup(wallet, p);
    }
  },
  async getPublicGroups(): Promise<string[]> {
    try {
      return await realFactory.getPublicGroups();
    } catch (e) {
      console.warn("[contracts.ts] getPublicGroups failed, falling back to demo:", e);
      return await demoFactory.getPublicGroups();
    }
  },
  async getAllGroups(): Promise<string[]> {
    try {
      return await realFactory.getAllGroups();
    } catch (e) {
      console.warn("[contracts.ts] getAllGroups failed, falling back to demo:", e);
      return await demoFactory.getAllGroups();
    }
  },
  async isGroup(a: string): Promise<boolean> {
    try {
      return await realFactory.isGroup(a);
    } catch (e) {
      console.warn("[contracts.ts] isGroup failed, falling back to demo:", e);
      return await demoFactory.isGroup(a);
    }
  },
  async repOf(a: string): Promise<number> {
    try {
      return await realFactory.repOf(a);
    } catch (e) {
      console.warn("[contracts.ts] repOf failed, falling back to demo:", e);
      return await demoFactory.repOf(a);
    }
  },
  async syncReputation(wallet: string, group: string): Promise<string> {
    try {
      return await realFactory.syncReputation(wallet, group);
    } catch (e) {
      console.warn("[contracts.ts] syncReputation failed, falling back to demo:", e);
      await demoFactory.syncReputation();
      return "demo_tx_hash";
    }
  }
};

/** Factory client — backed by the demo store when VITE_DEMO=true. */
export const factory = DEMO ? demoFactory : fallbackFactory;

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
    healthFactor: (a: string) =>
      read<number | null>(id, "health_factor", [addr(a)]),
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
  if (DEMO) return demoGroup(id);

  const real = realGroup(id);
  const demo = demoGroup(id);

  return {
    id,
    async getConfig(): Promise<GroupConfig> {
      try {
        return await real.getConfig();
      } catch (e) {
        console.warn(`[contracts.ts] getConfig for ${id} failed, falling back to demo:`, e);
        return await demo.getConfig();
      }
    },
    async getState(): Promise<GroupState> {
      try {
        return await real.getState();
      } catch (e) {
        console.warn(`[contracts.ts] getState for ${id} failed, falling back to demo:`, e);
        return await demo.getState();
      }
    },
    async getMembers(): Promise<Member[]> {
      try {
        return await real.getMembers();
      } catch (e) {
        console.warn(`[contracts.ts] getMembers for ${id} failed, falling back to demo:`, e);
        return await demo.getMembers();
      }
    },
    async getPhase(): Promise<Phase> {
      try {
        return await real.getPhase();
      } catch (e) {
        console.warn(`[contracts.ts] getPhase for ${id} failed, falling back to demo:`, e);
        return await demo.getPhase();
      }
    },
    async getClaimable(a: string): Promise<bigint> {
      try {
        return await real.getClaimable(a);
      } catch (e) {
        console.warn(`[contracts.ts] getClaimable for ${id} failed, falling back to demo:`, e);
        return await demo.getClaimable(a);
      }
    },
    async getCurrentBid(): Promise<Bid | null> {
      try {
        return await real.getCurrentBid();
      } catch (e) {
        console.warn(`[contracts.ts] getCurrentBid for ${id} failed, falling back to demo:`, e);
        return await demo.getCurrentBid();
      }
    },
    async getJoinRequest(a: string): Promise<JoinRequest | null> {
      try {
        return await real.getJoinRequest(a);
      } catch (e) {
        console.warn(`[contracts.ts] getJoinRequest for ${id} failed, falling back to demo:`, e);
        return await demo.getJoinRequest(a);
      }
    },
    async getPendingJoins(): Promise<string[]> {
      try {
        return await real.getPendingJoins();
      } catch (e) {
        console.warn(`[contracts.ts] getPendingJoins for ${id} failed, falling back to demo:`, e);
        return await demo.getPendingJoins();
      }
    },
    async getHistory(): Promise<HistoryEntry[]> {
      try {
        return await real.getHistory();
      } catch (e) {
        console.warn(`[contracts.ts] getHistory for ${id} failed, falling back to demo:`, e);
        return await demo.getHistory();
      }
    },
    async hasWon(a: string): Promise<boolean> {
      try {
        return await real.hasWon(a);
      } catch (e) {
        console.warn(`[contracts.ts] hasWon for ${id} failed, falling back to demo:`, e);
        return await demo.hasWon(a);
      }
    },
    async getSettled(period: number): Promise<boolean> {
      try {
        return await real.getSettled(period);
      } catch (e) {
        console.warn(`[contracts.ts] getSettled for ${id} failed, falling back to demo:`, e);
        return await demo.getSettled(period);
      }
    },
    async getPot(period: number): Promise<bigint> {
      try {
        return await real.getPot(period);
      } catch (e) {
        console.warn(`[contracts.ts] getPot for ${id} failed, falling back to demo:`, e);
        return await demo.getPot(period);
      }
    },
    async healthFactor(a: string): Promise<number | null> {
      try {
        return await real.healthFactor(a);
      } catch (e) {
        console.warn(`[contracts.ts] healthFactor for ${id} failed, falling back to demo:`, e);
        return await demo.healthFactor(a);
      }
    },
    async requiredCollateral(asset: CollateralAsset): Promise<bigint> {
      try {
        return await real.requiredCollateral(asset);
      } catch (e) {
        console.warn(`[contracts.ts] requiredCollateral for ${id} failed, falling back to demo:`, e);
        return await demo.requiredCollateral(asset);
      }
    },
    async collateralUnlockAt(): Promise<bigint> {
      try {
        return await real.collateralUnlockAt();
      } catch (e) {
        console.warn(`[contracts.ts] collateralUnlockAt for ${id} failed, falling back to demo:`, e);
        return await demo.collateralUnlockAt();
      }
    },
    async requestJoin(wallet: string): Promise<string> {
      try {
        return await real.requestJoin(wallet);
      } catch (e) {
        console.warn(`[contracts.ts] requestJoin failed, calling demo:`, e);
        await demo.requestJoin(wallet);
        return "demo_tx_hash";
      }
    },
    async voteOnJoin(wallet: string, applicant: string, approve: boolean): Promise<string> {
      try {
        return await real.voteOnJoin(wallet, applicant, approve);
      } catch (e) {
        console.warn(`[contracts.ts] voteOnJoin failed, calling demo:`, e);
        await demo.voteOnJoin(wallet, applicant, approve);
        return "demo_tx_hash";
      }
    },
    async lockCollateral(wallet: string, asset: CollateralAsset = "Usdc"): Promise<string> {
      try {
        return await real.lockCollateral(wallet, asset);
      } catch (e) {
        console.warn(`[contracts.ts] lockCollateral failed, calling demo:`, e);
        await demo.lockCollateral(wallet, asset);
        return "demo_tx_hash";
      }
    },
    async topUp(wallet: string, asset: CollateralAsset, amount: bigint): Promise<string> {
      try {
        return await real.topUp(wallet, asset, amount);
      } catch (e) {
        console.warn(`[contracts.ts] topUp failed, calling demo:`, e);
        await demo.topUp(wallet, asset, amount);
        return "demo_tx_hash";
      }
    },
    async contribute(wallet: string): Promise<string> {
      try {
        return await real.contribute(wallet);
      } catch (e) {
        console.warn(`[contracts.ts] contribute failed, calling demo:`, e);
        await demo.contribute(wallet);
        return "demo_tx_hash";
      }
    },
    async settle(wallet: string): Promise<string> {
      try {
        return await real.settle(wallet);
      } catch (e) {
        console.warn(`[contracts.ts] settle failed, calling demo:`, e);
        await demo.settle(wallet);
        return "demo_tx_hash";
      }
    },
    async placeBid(wallet: string, discount: bigint): Promise<string> {
      try {
        return await real.placeBid(wallet, discount);
      } catch (e) {
        console.warn(`[contracts.ts] placeBid failed, calling demo:`, e);
        await demo.placeBid(wallet, discount);
        return "demo_tx_hash";
      }
    },
    async resolvePeriod(wallet: string): Promise<string> {
      try {
        return await real.resolvePeriod(wallet);
      } catch (e) {
        console.warn(`[contracts.ts] resolvePeriod failed, calling demo:`, e);
        await demo.resolvePeriod(wallet);
        return "demo_tx_hash";
      }
    },
    async claimPayout(wallet: string): Promise<string> {
      try {
        return await real.claimPayout(wallet);
      } catch (e) {
        console.warn(`[contracts.ts] claimPayout failed, calling demo:`, e);
        await demo.claimPayout(wallet);
        return "demo_tx_hash";
      }
    },
    async withdrawCollateral(wallet: string): Promise<string> {
      try {
        return await real.withdrawCollateral(wallet);
      } catch (e) {
        console.warn(`[contracts.ts] withdrawCollateral failed, calling demo:`, e);
        await demo.withdrawCollateral(wallet);
        return "demo_tx_hash";
      }
    }
  };
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
