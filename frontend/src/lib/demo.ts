// In-memory + localStorage demo backend. Enabled via VITE_DEMO=true so the
// whole UI (create / list / open / participate) works locally with no Stellar
// network and no browser wallet. Shapes mirror exactly what contracts.ts returns
// after scValToNative, so the React layer is unaware it's talking to a fake.
//
// This mirrors the v3 contract: four-window periods (Contribution → Settlement →
// Auction → Payout), multi-collateral (USDC 100% / XLM 150%), health factors,
// automatic liquidation of missed contributions, and discount split among ALL
// members including the winner.
import type {
  GroupConfig,
  GroupState,
  Member,
  Bid,
  JoinRequest,
  HistoryEntry,
  Visibility,
  Phase,
  CollateralAsset,
} from "../types";
import { confirmTx, debit, credit } from "./demoWallet";
import { priceUnitsAtSeconds } from "./price";

const SCALE = 10_000_000n; // 7dp
const HF_SCALE = 10_000n; // 1.00
const GRACE = 86_400; // 24h cap

/** Live simulated XLM price (USDC per XLM, 7dp) — the demo oracle. */
export function demoOraclePrice(): bigint {
  return priceUnitsAtSeconds(Math.floor(Date.now() / 1000));
}

/** Prompt the simulated wallet; throw if the user rejects. */
async function approve(
  title: string,
  detail: string,
  amount?: bigint,
  outgoing = true
): Promise<void> {
  const okd = await confirmTx({ title, detail, amount, outgoing });
  if (!okd) throw new Error("Transaction rejected in wallet.");
}

// A deterministic, valid-length (56 char) fake account + token id so shortAddr
// and the UI render naturally without a real wallet.
export const DEMO_ADDRESS = "GDEMO" + "A".repeat(51);
export const DEMO_USDC = "CDEMOUSDC" + "A".repeat(47);
export const DEMO_XLM = "CDEMOXLM" + "A".repeat(48);

// Multiple demo accounts so you can play several members. Each tab connects as
// one of these (see wallet.ts — selection is per-tab via sessionStorage), and
// all tabs share the same groups + balances, so e.g. Alice can create a group
// in one tab and Bob can join it in another.
const acct = (tag: string, fill: string) => (tag + fill.repeat(56)).slice(0, 56);
export interface DemoAccount {
  name: string;
  address: string;
}
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { name: "Alice", address: DEMO_ADDRESS }, // keep == DEMO_ADDRESS for existing data
  { name: "Bob", address: acct("GBOB", "B") },
  { name: "Carol", address: acct("GCAROL", "C") },
  { name: "Dave", address: acct("GDAVE", "D") },
  { name: "Eve", address: acct("GEVE", "E") },
];

/** Friendly name for a known demo account, else null. */
export function demoNameFor(address: string): string | null {
  return DEMO_ACCOUNTS.find((a) => a.address === address)?.name ?? null;
}

// v3: schema changed for the per-group currency (USDC/XLM) rework.
const STORE_KEY = "plexa_demo_groups_v3";

interface DemoGroup {
  id: string;
  config: GroupConfig;
  state: GroupState;
  members: Member[];
  history: HistoryEntry[];
  bid: Bid | null;
  joins: Record<string, JoinRequest>;
  claimable: Record<string, bigint>;
  debt: Record<string, bigint>;
  contributed: string[]; // "<period>:<addr>" markers
  settled: number[]; // periods whose settlement ran
  pot: Record<number, bigint>; // finalized pool per period
}

// ---------------------------------------------------- bigint-aware persistence
const replacer = (_k: string, v: unknown) =>
  typeof v === "bigint" ? { __bigint: v.toString() } : v;
const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "__bigint" in (v as object)
    ? BigInt((v as { __bigint: string }).__bigint)
    : v;

function load(): DemoGroup[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw, reviver) as DemoGroup[]) : [];
  } catch {
    return [];
  }
}

function save(groups: DemoGroup[]): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(groups, replacer));
}

function find(id: string): DemoGroup {
  const g = load().find((x) => x.id === id);
  if (!g) throw new Error(`demo: group ${id} not found`);
  return g;
}

function mutate(id: string, fn: (g: DemoGroup) => void): void {
  const groups = load();
  const g = groups.find((x) => x.id === id);
  if (!g) throw new Error(`demo: group ${id} not found`);
  fn(g);
  save(groups);
}

const now = () => BigInt(Math.floor(Date.now() / 1000));
const nowSec = () => Math.floor(Date.now() / 1000);

function genId(): string {
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "C";
  for (let i = 0; i < 55; i++) s += cs[Math.floor(Math.random() * cs.length)];
  return s;
}

function logHist(g: DemoGroup, e: Omit<HistoryEntry, "timestamp">): void {
  g.history.push({ ...e, timestamp: now() });
}

const effectiveGrace = (plen: number) => Math.min(GRACE, plen);

// -------------------------------------------------------------- collateral math
/** USDC value the XLM option must cover: 150% of pot. */
function xlmRequiredValue(g: DemoGroup): bigint {
  return (g.config.pot_size * 3n) / 2n;
}
/** XLM units worth 150% of pot at the live price (rounded up). */
export function demoRequiredXlm(g: DemoGroup): bigint {
  const price = demoOraclePrice();
  const num = xlmRequiredValue(g) * SCALE;
  return (num + price - 1n) / price;
}
function collateralValue(m: Member, price: bigint): bigint {
  return m.collateral_usdc + (m.collateral_xlm * price) / SCALE;
}
function hfOf(g: DemoGroup, m: Member, price: bigint): bigint {
  const required =
    m.collateral_asset === "Usdc" ? g.config.collateral_requirement : xlmRequiredValue(g);
  if (required <= 0n) return HF_SCALE * 1000n;
  return (collateralValue(m, price) * HF_SCALE) / required;
}
/** Same-asset collateral (group currency == collateral) carries no market risk. */
function sameAsset(g: DemoGroup, m: Member): boolean {
  return m.collateral_asset === (g.config.currency ?? "Usdc");
}

// Promote a Forming group to Active once it's full and the first contributions
// are in — mirrors the contract's auto-start rule.
function maybeStart(g: DemoGroup): void {
  if (g.state.status !== "Forming") return;
  if (g.members.length < g.config.target_members) return;
  const allFirstPaid = g.members.every((m) => g.contributed.includes(`1:${m.addr}`));
  if (!allFirstPaid) return;
  g.state.status = "Active";
  g.state.start_time = now();
  g.state.current_period = 1;
  logHist(g, {
    period: 1,
    kind: "started",
    actor: g.config.owner,
    amount: 0n,
    detail: "Group started — all members funded",
  });
}

function periodStartSec(g: DemoGroup): number {
  return Number(g.state.start_time) + (g.state.current_period - 1) * Number(g.config.period_length);
}

/** Settlement engine — mirrors run_settlement in the contract. */
function runSettlement(g: DemoGroup, period: number): void {
  const price = demoOraclePrice();
  const xlmGroup = (g.config.currency ?? "Usdc") === "Xlm";
  let pot = 0n;
  for (const m of g.members) {
    if (g.contributed.includes(`${period}:${m.addr}`)) {
      pot += g.config.contribution_amount;
    } else {
      let need = g.config.contribution_amount;
      // Same-currency bucket first (no swap required).
      const bucket = xlmGroup ? m.collateral_xlm : m.collateral_usdc;
      const useSame = bucket >= need ? need : bucket;
      if (useSame > 0n) {
        if (xlmGroup) m.collateral_xlm -= useSame;
        else m.collateral_usdc -= useSame;
        pot += useSame;
        need -= useSame;
      }
      // USDC groups only: swap the necessary XLM (demo router at the oracle price).
      if (!xlmGroup && need > 0n && m.collateral_xlm > 0n) {
        const xlmValue = (m.collateral_xlm * price) / SCALE;
        if (xlmValue >= need) {
          const xlmSpent = (need * SCALE + price - 1n) / price;
          m.collateral_xlm -= xlmSpent;
          pot += need;
          logHist(g, { period, kind: "liquid", actor: m.addr, amount: need, detail: "XLM liquidated to cover contribution" });
          need = 0n;
        } else {
          const out = (m.collateral_xlm * price) / SCALE;
          m.collateral_xlm = 0n;
          const applied = out >= need ? need : out;
          pot += applied;
          if (out > applied) m.collateral_usdc += out - applied;
          need -= applied;
          logHist(g, { period, kind: "liquid", actor: m.addr, amount: applied, detail: "all XLM liquidated to cover contribution" });
        }
      }
      if (need > 0n) g.debt[m.addr] = (g.debt[m.addr] ?? 0n) + need;
      m.in_default = true;
      logHist(g, { period, kind: "default", actor: m.addr, amount: g.config.contribution_amount - need, detail: "contribution covered by collateral" });
    }

    // Health-factor pass for cross-asset collateral members still in the
    // group (XLM collateral in a USDC group). Same-asset carries no risk.
    if (!m.removed && !sameAsset(g, m) && m.collateral_asset === "Xlm") {
      const hf = hfOf(g, m, price);
      if (hf < HF_SCALE) {
        if (m.hf_breach_period === 0) {
          m.hf_breach_period = period;
          logHist(g, { period, kind: "hf_warn", actor: m.addr, amount: hf, detail: "health factor below 1.0 — top up collateral" });
        } else if (period > m.hf_breach_period) {
          if (m.collateral_xlm > 0n) {
            const out = (m.collateral_xlm * price) / SCALE;
            m.collateral_usdc += out;
            m.collateral_xlm = 0n;
          }
          m.removed = true;
          logHist(g, { period, kind: "removed", actor: m.addr, amount: m.collateral_usdc, detail: "removed — collateral not restored in time" });
        }
      } else if (m.hf_breach_period !== 0) {
        m.hf_breach_period = 0;
      }
    }
  }
  g.settled.push(period);
  g.pot[period] = pot;
  logHist(g, { period, kind: "settled", actor: g.config.owner, amount: pot, detail: "settlement complete — pool finalized" });
}

function isSettled(g: DemoGroup, period: number): boolean {
  return g.settled.includes(period);
}

// =================================================================== Factory
export const demoFactory = {
  async createGroup(
    _wallet: string,
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
    const pot = p.contributionAmount * BigInt(p.targetMembers);
    const ticker = p.currency === "Xlm" ? "XLM" : "USDC";
    await approve(
      "Create group & lock collateral",
      `Deploy "${p.name}" and lock your ${ticker} collateral as the owner.`,
      pot
    );
    debit(p.owner, pot); // owner locks 100%-of-pot collateral up front
    const id = genId();
    const config: GroupConfig = {
      name: p.name,
      description: p.description,
      owner: p.owner,
      target_members: p.targetMembers,
      visibility: p.visibility,
      currency: p.currency,
      period_length: BigInt(p.periodLength),
      contribution_window: BigInt(p.contributionWindow),
      settlement_window: BigInt(p.settlementWindow),
      auction_window: BigInt(p.auctionWindow),
      payout_window: BigInt(
        p.periodLength - p.contributionWindow - p.settlementWindow - p.auctionWindow
      ),
      contribution_amount: p.contributionAmount,
      pot_size: pot,
      collateral_requirement: pot, // same-asset option: 100% of pot
      min_reputation: p.minReputation,
      usdc: DEMO_USDC,
      xlm: DEMO_XLM,
      oracle: "CDEMOORACLE" + "A".repeat(45),
      router: "CDEMOROUTER" + "A".repeat(45),
      factory: "CDEMOFACTORY" + "A".repeat(44),
    };
    const owner: Member = {
      addr: p.owner,
      collateral_asset: p.currency,
      collateral_usdc: p.currency === "Usdc" ? pot : 0n,
      collateral_xlm: p.currency === "Xlm" ? pot : 0n,
      has_won: false,
      in_default: false,
      removed: false,
      hf_breach_period: 0,
      joined_period: 0,
    };
    const g: DemoGroup = {
      id,
      config,
      state: {
        status: "Forming",
        start_time: 0n,
        current_period: 1,
        members_won: 0,
        completed_periods: 0,
        completed_at: 0n,
      },
      members: [owner],
      history: [],
      bid: null,
      joins: {},
      claimable: {},
      debt: {},
      contributed: [],
      settled: [],
      pot: {},
    };
    logHist(g, { period: 0, kind: "joined", actor: p.owner, amount: pot, detail: "Owner created group and locked collateral" });
    const groups = load();
    groups.push(g);
    save(groups);
    return id;
  },

  async getAllGroups(): Promise<string[]> {
    return load().map((g) => g.id);
  },
  async getPublicGroups(): Promise<string[]> {
    return load().filter((g) => g.config.visibility === "Public").map((g) => g.id);
  },
  async repOf(addr: string): Promise<number> {
    return load().filter(
      (g) =>
        g.state.status === "Completed" &&
        g.members.some((m) => m.addr === addr && !m.in_default && !m.removed)
    ).length;
  },
  async syncReputation(): Promise<unknown> {
    return undefined;
  },
};

// ===================================================================== Group
export function demoGroup(id: string) {
  const majority = (g: DemoGroup) => Math.floor(g.members.length / 2) + 1;

  return {
    id,
    async getConfig(): Promise<GroupConfig> {
      return find(id).config;
    },
    async getState(): Promise<GroupState> {
      return find(id).state;
    },
    async getMembers(): Promise<Member[]> {
      return find(id).members;
    },
    async getPhase(): Promise<Phase> {
      const g = find(id);
      if (g.state.status !== "Active") return "Contribution";
      const into = nowSec() - periodStartSec(g);
      const c = Number(g.config.contribution_window);
      const s = Number(g.config.settlement_window);
      const a = Number(g.config.auction_window);
      if (into < c) return "Contribution";
      if (into < c + s) return "Settlement";
      if (into < c + s + a) return "Auction";
      return "Payout";
    },
    async getClaimable(a: string): Promise<bigint> {
      return find(id).claimable[a] ?? 0n;
    },
    async getCurrentBid(): Promise<Bid | null> {
      return find(id).bid;
    },
    async getJoinRequest(a: string): Promise<JoinRequest | null> {
      return find(id).joins[a] ?? null;
    },
    async getPendingJoins(): Promise<string[]> {
      const g = find(id);
      return Object.values(g.joins)
        .filter((r) => !r.resolved)
        .map((r) => r.applicant);
    },
    async getHistory(): Promise<HistoryEntry[]> {
      return find(id).history;
    },
    async hasWon(a: string): Promise<boolean> {
      return find(id).members.find((m) => m.addr === a)?.has_won ?? false;
    },
    async getSettled(period: number): Promise<boolean> {
      return isSettled(find(id), period);
    },
    async getPot(period: number): Promise<bigint> {
      return find(id).pot[period] ?? 0n;
    },
    async healthFactor(a: string): Promise<number | null> {
      const g = find(id);
      const m = g.members.find((x) => x.addr === a);
      if (!m || sameAsset(g, m)) return null;
      return Number(hfOf(g, m, demoOraclePrice()));
    },
    async requiredCollateral(asset: CollateralAsset): Promise<bigint> {
      const g = find(id);
      // XLM groups: same-asset collateral only, flat 100% of pot.
      if ((g.config.currency ?? "Usdc") === "Xlm") {
        if (asset !== "Xlm") throw new Error("XLM groups take XLM collateral only.");
        return g.config.collateral_requirement;
      }
      return asset === "Usdc" ? g.config.collateral_requirement : demoRequiredXlm(g);
    },
    async collateralUnlockAt(): Promise<bigint> {
      const g = find(id);
      const plen = Number(g.config.period_length);
      const base =
        g.state.completed_at > 0n
          ? Number(g.state.completed_at)
          : g.state.start_time > 0n
            ? Number(g.state.start_time) + g.config.target_members * plen
            : 0;
      if (base === 0) return 0n;
      return BigInt(base + effectiveGrace(plen));
    },

    // ------------------------------------------------------------- writes
    async requestJoin(wallet: string): Promise<unknown> {
      await approve("Request to join", "Submit a join request for members to vote on.");
      mutate(id, (g) => {
        if (g.members.some((m) => m.addr === wallet))
          throw new Error("You are already a member.");
        if (g.joins[wallet] && !g.joins[wallet].resolved)
          throw new Error("Join request already pending.");
        if (g.members.length >= g.config.target_members)
          throw new Error("Group is already full.");
        g.joins[wallet] = {
          applicant: wallet,
          yes_votes: 0,
          no_votes: 0,
          voters: [],
          resolved: false,
          approved: false,
          created_at: now(),
        };
        logHist(g, { period: g.state.current_period, kind: "join_req", actor: wallet, amount: 0n, detail: "Requested to join" });
      });
      return undefined;
    },
    async voteOnJoin(wallet: string, applicant: string, approveVote: boolean): Promise<unknown> {
      await approve(
        approveVote ? "Approve applicant" : "Reject applicant",
        `Cast your ${approveVote ? "approve" : "reject"} vote on this join request.`
      );
      mutate(id, (g) => {
        const req = g.joins[applicant];
        if (!req || req.resolved) throw new Error("No open request for that applicant.");
        if (req.voters.includes(wallet)) throw new Error("You already voted.");
        req.voters.push(wallet);
        if (approveVote) req.yes_votes += 1;
        else req.no_votes += 1;
        const need = majority(g);
        if (req.yes_votes >= need) {
          req.resolved = true;
          req.approved = true;
          logHist(g, { period: g.state.current_period, kind: "join_ok", actor: applicant, amount: 0n, detail: "Join approved by members" });
        } else if (req.no_votes >= need) {
          req.resolved = true;
          req.approved = false;
          logHist(g, { period: g.state.current_period, kind: "join_no", actor: applicant, amount: 0n, detail: "Join rejected by members" });
        }
      });
      return undefined;
    },
    async lockCollateral(wallet: string, asset: CollateralAsset = "Usdc"): Promise<unknown> {
      const g0 = find(id);
      const xlmGroup = (g0.config.currency ?? "Usdc") === "Xlm";
      if (xlmGroup && asset !== "Xlm")
        throw new Error("This group runs on XLM — collateral must be XLM.");
      const amount = xlmGroup
        ? g0.config.collateral_requirement
        : asset === "Usdc"
          ? g0.config.collateral_requirement
          : demoRequiredXlm(g0);
      await approve(
        `Lock ${asset === "Usdc" ? "USDC" : "XLM"} collateral`,
        xlmGroup
          ? "Lock 100% of the pot in XLM to join."
          : asset === "Usdc"
            ? "Lock 100% of the pot in USDC to join."
            : "Lock 150% of the pot's value in XLM to join.",
        amount
      );
      mutate(id, (g) => {
        if (g.members.some((m) => m.addr === wallet))
          throw new Error("Collateral already locked.");
        const req = g.joins[wallet];
        const isOwner = wallet === g.config.owner;
        if (!isOwner && (!req || !req.resolved || !req.approved))
          throw new Error("Not approved to join yet.");
        const lockAmt = xlmGroup
          ? g.config.collateral_requirement
          : asset === "Usdc"
            ? g.config.collateral_requirement
            : demoRequiredXlm(g);
        debit(wallet, lockAmt);
        g.members.push({
          addr: wallet,
          collateral_asset: asset,
          collateral_usdc: asset === "Usdc" ? lockAmt : 0n,
          collateral_xlm: asset === "Xlm" ? lockAmt : 0n,
          has_won: false,
          in_default: false,
          removed: false,
          hf_breach_period: 0,
          joined_period: g.state.current_period,
        });
        logHist(g, { period: g.state.current_period, kind: "joined", actor: wallet, amount: lockAmt, detail: `Locked ${asset === "Usdc" ? "USDC" : "XLM"} collateral and joined` });
        maybeStart(g);
      });
      return undefined;
    },
    async topUp(wallet: string, asset: CollateralAsset, amount: bigint): Promise<unknown> {
      await approve(
        `Top up ${asset === "Usdc" ? "USDC" : "XLM"} collateral`,
        "Add collateral to restore your health factor.",
        amount
      );
      mutate(id, (g) => {
        const m = g.members.find((x) => x.addr === wallet);
        if (!m) throw new Error("Not a member.");
        if (m.removed) throw new Error("You have been removed from the group.");
        if (amount <= 0n) throw new Error("Amount must be positive.");
        if ((g.config.currency ?? "Usdc") === "Xlm" && asset !== "Xlm")
          throw new Error("This group runs on XLM — top-ups must be XLM.");
        debit(wallet, amount);
        if (asset === "Usdc") m.collateral_usdc += amount;
        else m.collateral_xlm += amount;
        if (m.hf_breach_period !== 0 && hfOf(g, m, demoOraclePrice()) >= HF_SCALE) {
          m.hf_breach_period = 0;
        }
        logHist(g, { period: g.state.current_period, kind: "topup", actor: wallet, amount, detail: `Topped up ${asset === "Usdc" ? "USDC" : "XLM"} collateral` });
      });
      return undefined;
    },
    async contribute(wallet: string): Promise<unknown> {
      const amount = find(id).config.contribution_amount;
      await approve("Pay contribution", "Pay your contribution for this period.", amount);
      mutate(id, (g) => {
        const m = g.members.find((x) => x.addr === wallet);
        if (!m) throw new Error("Only members can contribute.");
        if (m.removed) throw new Error("You have been removed from the group.");
        const marker = `${g.state.current_period}:${wallet}`;
        if (g.contributed.includes(marker))
          throw new Error("Already contributed this period.");
        debit(wallet, g.config.contribution_amount);
        g.contributed.push(marker);
        logHist(g, { period: g.state.current_period, kind: "contrib", actor: wallet, amount: g.config.contribution_amount, detail: "Paid contribution" });
        maybeStart(g);
      });
      return undefined;
    },
    async settle(_wallet: string): Promise<unknown> {
      await approve("Run settlement", "Verify contributions, liquidate misses and finalize the pool.");
      mutate(id, (g) => {
        if (g.state.status !== "Active") throw new Error("Group is not active.");
        const period = g.state.current_period;
        if (isSettled(g, period)) throw new Error("Already settled this period.");
        runSettlement(g, period);
      });
      return undefined;
    },
    async placeBid(wallet: string, discount: bigint): Promise<unknown> {
      await approve("Place auction bid", "Submit your discount bid for the pot.");
      mutate(id, (g) => {
        if (g.state.status !== "Active") throw new Error("Auction is not open.");
        const m = g.members.find((x) => x.addr === wallet);
        if (!m) throw new Error("Only members can bid.");
        if (m.has_won) throw new Error("You've already won this cycle — you can't bid again.");
        if (m.removed) throw new Error("You have been removed from the group.");
        const period = g.state.current_period;
        if (!isSettled(g, period)) runSettlement(g, period);
        if (discount <= 0n || discount >= g.config.pot_size)
          throw new Error("Bid must be between 0 and the pot size.");
        if (g.bid && discount <= g.bid.discount)
          throw new Error("Bid must beat the current leading discount.");
        g.bid = { bidder: wallet, discount };
        logHist(g, { period, kind: "bid", actor: wallet, amount: discount, detail: "Placed auction bid" });
      });
      return undefined;
    },
    async resolvePeriod(_wallet: string): Promise<unknown> {
      await approve("Resolve period", "Close this period's auction and assign the pot.");
      mutate(id, (g) => {
        if (g.state.status !== "Active") throw new Error("Group is not active.");
        const period = g.state.current_period;
        if (!isSettled(g, period)) runSettlement(g, period);
        const potCollected = g.pot[period] ?? 0n;
        const active = g.members.filter((m) => !m.removed);
        const eligible = active.filter((m) => !m.has_won);

        if (eligible.length === 0) {
          const n = BigInt(active.length);
          if (n > 0n) {
            const share = potCollected / n;
            for (const m of active) g.claimable[m.addr] = (g.claimable[m.addr] ?? 0n) + share;
          }
          g.state.completed_periods += 1;
          g.state.status = "Completed";
          g.state.completed_at = now();
          g.bid = null;
          return;
        }

        const winnerAddr = g.bid?.bidder ?? eligible[Math.floor(Math.random() * eligible.length)].addr;
        const winner = g.members.find((m) => m.addr === winnerAddr)!;
        const discount = g.bid?.discount ?? 0n;
        winner.has_won = true;
        g.state.members_won += 1;
        g.state.completed_periods += 1;
        g.claimable[winner.addr] = (g.claimable[winner.addr] ?? 0n) + (potCollected - discount);

        // Split the discount equally among ALL active members incl. winner.
        if (discount > 0n) {
          const n = BigInt(active.length);
          const share = discount / n;
          if (share > 0n) {
            for (const m of active) g.claimable[m.addr] = (g.claimable[m.addr] ?? 0n) + share;
          }
          const dust = discount - share * n;
          if (dust > 0n) g.claimable[winner.addr] = (g.claimable[winner.addr] ?? 0n) + dust;
        }

        logHist(g, { period, kind: "resolved", actor: winner.addr, amount: potCollected - discount, detail: "Won the pot" });
        g.bid = null;
        if (eligible.length <= 1) {
          g.state.status = "Completed";
          g.state.completed_at = now();
        } else {
          g.state.current_period += 1;
        }
      });
      return undefined;
    },
    async claimPayout(wallet: string): Promise<unknown> {
      const claimAmt = find(id).claimable[wallet] ?? 0n;
      await approve("Claim payout", "Receive your pot payout into your wallet.", claimAmt, false);
      mutate(id, (g) => {
        let amt = g.claimable[wallet] ?? 0n;
        // Net off any outstanding default debt first.
        const debt = g.debt[wallet] ?? 0n;
        if (debt > 0n && amt > 0n) {
          const used = amt >= debt ? debt : amt;
          g.debt[wallet] = debt - used;
          amt -= used;
        }
        if (amt <= 0n) throw new Error("Nothing to claim.");
        g.claimable[wallet] = 0n;
        credit(wallet, amt);
        logHist(g, { period: g.state.current_period, kind: "withdraw", actor: wallet, amount: amt, detail: "Claimed payout" });
      });
      return undefined;
    },
    async withdrawCollateral(wallet: string): Promise<unknown> {
      const g0 = find(id);
      const m0 = g0.members.find((x) => x.addr === wallet);
      const wAmt = (m0?.collateral_usdc ?? 0n) + (m0?.collateral_xlm ?? 0n);
      await approve("Withdraw collateral", "Return your locked collateral to your wallet.", wAmt, false);
      mutate(id, (g) => {
        if (g.state.status !== "Completed") throw new Error("Group is not completed yet.");
        const m = g.members.find((x) => x.addr === wallet);
        if (!m) throw new Error("Not a member.");
        let usdc = m.collateral_usdc;
        let xlm = m.collateral_xlm;
        // Net debt from the bucket denominated in the group currency.
        const debt = g.debt[wallet] ?? 0n;
        if ((g.config.currency ?? "Usdc") === "Xlm") {
          if (debt > 0n && xlm > 0n) {
            const used = xlm >= debt ? debt : xlm;
            g.debt[wallet] = debt - used;
            xlm -= used;
          }
        } else if (debt > 0n && usdc > 0n) {
          const used = usdc >= debt ? debt : usdc;
          g.debt[wallet] = debt - used;
          usdc -= used;
        }
        if (usdc <= 0n && xlm <= 0n) throw new Error("No collateral to withdraw.");
        m.collateral_usdc = 0n;
        m.collateral_xlm = 0n;
        credit(wallet, usdc + xlm);
        logHist(g, { period: g.state.current_period, kind: "withdraw", actor: wallet, amount: usdc + xlm, detail: "Withdrew collateral" });
      });
      return undefined;
    },
  };
}
