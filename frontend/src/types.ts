// Shapes returned by the contracts (after scValToNative). Numeric widths:
// u32 -> number, u64/i128 -> bigint. Enums are normalized to string tags.

export type Visibility = "Public" | "Private";
export type GroupStatus = "Forming" | "Active" | "Completed";
// Four windows per period (Settlement sits between Contribution and Auction).
export type Phase = "Contribution" | "Settlement" | "Auction" | "Payout";
export type CollateralAsset = "Usdc" | "Xlm";
/** Token a group's contributions/pot/payouts are denominated in. */
export type Currency = CollateralAsset;

export interface GroupConfig {
  name: string;
  description: string;
  owner: string;
  target_members: number;
  visibility: Visibility;
  /** Group currency: every contribution/payout/claim flows in this token. */
  currency: Currency;
  period_length: bigint;
  contribution_window: bigint;
  settlement_window: bigint;
  auction_window: bigint;
  payout_window: bigint;
  contribution_amount: bigint;
  pot_size: bigint;
  collateral_requirement: bigint; // USDC option requirement (100% of pot)
  min_reputation: number;
  usdc: string;
  xlm: string;
  oracle: string;
  router: string;
  factory: string;
}

export interface GroupState {
  status: GroupStatus;
  start_time: bigint;
  current_period: number;
  members_won: number;
  completed_periods: number;
  completed_at: bigint; // 0 until Completed; collateral unlocks at + grace
}

export interface Member {
  addr: string;
  collateral_asset: CollateralAsset;
  collateral_usdc: bigint; // USDC bucket
  collateral_xlm: bigint; // XLM bucket (7dp)
  has_won: boolean;
  in_default: boolean;
  removed: boolean; // liquidated out of the group
  hf_breach_period: number; // 0 = healthy; else period the HF first fell < 1.0
  joined_period: number;
}

export interface Bid {
  bidder: string;
  discount: bigint;
}

export interface JoinRequest {
  applicant: string;
  yes_votes: number;
  no_votes: number;
  voters: string[];
  resolved: boolean;
  approved: boolean;
  created_at: bigint;
}

export interface HistoryEntry {
  period: number;
  timestamp: bigint;
  kind: string;
  actor: string;
  amount: bigint;
  detail: string;
}

/** Convenience bundle the dashboard/group view loads in one shot. */
export interface GroupView {
  id: string;
  config: GroupConfig;
  state: GroupState;
  members: Member[];
}

/** Form model for the create wizard (durations held as seconds). */
export interface CreateGroupForm {
  name: string;
  description: string;
  imageDataUrl?: string;
  targetMembers: number;
  visibility: Visibility;
  currency: Currency; // token contributions are paid in (USDC or XLM)
  periodLength: number; // seconds
  contributionWindow: number; // seconds
  settlementWindow: number; // seconds (dev-configurable; fixed in production)
  auctionWindow: number; // seconds
  contributionAmount: string; // human amount in the group currency, e.g. "10"
  minReputation: number; // 0 disables the gate
}
