use soroban_sdk::{contracterror, contracttype, Address, String, Symbol, Vec};

/// Group visibility. Encoded as u32 across the contract boundary so the factory
/// can forward it without sharing this type: 0 = Public, 1 = Private.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Visibility {
    Public = 0,
    Private = 1,
}

impl Visibility {
    pub fn from_u32(v: u32) -> Visibility {
        if v == 0 {
            Visibility::Public
        } else {
            Visibility::Private
        }
    }
}

/// Lifecycle of a group.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GroupStatus {
    /// Members are still joining / locking collateral / paying first contribution.
    Forming = 0,
    /// All members in, clock running, periods rotating.
    Active = 1,
    /// Every eligible member has won once; collateral withdrawable after grace.
    Completed = 2,
}

/// Which window of the current period we are in (only meaningful while Active).
/// Periods now have FOUR windows: Contribution → Settlement → Auction → Payout.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Phase {
    Contribution = 0,
    Settlement = 1,
    Auction = 2,
    Payout = 3,
}

/// Collateral asset a member chose when locking. Encoded as u32 across the
/// boundary: 0 = USDC (100% of pot), 1 = XLM (150% of pot, priced by oracle).
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CollateralAsset {
    Usdc = 0,
    Xlm = 1,
}

impl CollateralAsset {
    pub fn from_u32(v: u32) -> CollateralAsset {
        if v == 0 {
            CollateralAsset::Usdc
        } else {
            CollateralAsset::Xlm
        }
    }
}

/// Constructor parameters bundle (contract fns are capped at 10 args, so the
/// inputs travel as one struct). `visibility`: 0 = Public, 1 = Private.
/// `currency`: 0 = USDC, 1 = XLM — the token every contribution/payout uses.
/// The factory builds a structurally-identical struct on its side — they match on
/// the wire because `#[contracttype]` structs serialize by field name.
#[contracttype]
#[derive(Clone)]
pub struct GroupParams {
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub target_members: u32,
    pub visibility: u32,
    pub currency: u32,
    pub period_length: u64,
    pub contribution_window: u64,
    pub settlement_window: u64,
    pub auction_window: u64,
    pub contribution_amount: i128,
    pub min_reputation: u32,
    pub usdc: Address,
    pub xlm: Address,
    pub oracle: Address,
    pub router: Address,
    pub factory: Address,
}

/// Immutable group configuration, locked at deploy.
#[contracttype]
#[derive(Clone)]
pub struct GroupConfig {
    pub name: String,
    pub description: String,
    pub owner: Address,
    pub target_members: u32,
    pub visibility: Visibility,
    /// Token every contribution, pot and payout is denominated in.
    /// USDC groups keep the two collateral options (USDC 100% / XLM 150%);
    /// XLM groups require same-asset XLM collateral at 100% (no oracle risk).
    pub currency: CollateralAsset,
    // Timing, all in seconds.
    pub period_length: u64,
    pub contribution_window: u64,
    pub settlement_window: u64,
    pub auction_window: u64,
    pub payout_window: u64, // derived = period − contribution − settlement − auction
    // Finance (in the group currency, 7 decimals — USDC and XLM match).
    pub contribution_amount: i128,
    pub pot_size: i128, // contribution_amount * target_members
    /// Same-asset collateral: 100% of pot in the group currency. For USDC
    /// groups the XLM option is pot * 150% worth of XLM at the oracle price.
    pub collateral_requirement: i128,
    pub min_reputation: u32, // 0 disables the reputation gate
    pub usdc: Address,
    pub xlm: Address,
    pub oracle: Address,
    pub router: Address,
    pub factory: Address,
}

/// Mutable group-level state.
#[contracttype]
#[derive(Clone)]
pub struct GroupState {
    pub status: GroupStatus,
    pub start_time: u64,     // 0 until auto-start
    pub current_period: u32, // 1-indexed; the period currently being collected/resolved
    pub members_won: u32,
    pub completed_periods: u32,
    /// Unix ts the cycle completed (0 while Forming/Active). Collateral unlocks
    /// at completed_at + grace — the single source of truth the UI reads via
    /// `collateral_unlock_at`, so the frontend never re-derives (Bug 1 fix).
    pub completed_at: u64,
}

/// Per-member record. Collateral is held in two buckets because top-ups may mix
/// assets; `collateral_asset` is the option chosen at lock time and fixes the
/// requirement ratio (USDC = 100% of pot, XLM = 150%).
#[contracttype]
#[derive(Clone)]
pub struct Member {
    pub addr: Address,
    pub collateral_asset: CollateralAsset,
    pub collateral_usdc: i128, // USDC collateral held
    pub collateral_xlm: i128,  // XLM collateral held (7dp)
    pub has_won: bool,
    pub in_default: bool, // ever missed a contribution (covered from collateral)
    /// Liquidated out of the group: no longer contributes or wins; remaining
    /// obligations are auto-funded from the liquidated collateral.
    pub removed: bool,
    /// 0 = healthy. Otherwise the period at which the health factor first fell
    /// below 1.0 — the member has until the NEXT period's settlement to top up.
    pub hf_breach_period: u32,
    pub joined_period: u32,
}

/// Live highest bid for a period (open auction — highest discount leads).
#[contracttype]
#[derive(Clone)]
pub struct Bid {
    pub bidder: Address,
    pub discount: i128,
}

/// A pending governance join request.
#[contracttype]
#[derive(Clone)]
pub struct JoinRequest {
    pub applicant: Address,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub voters: Vec<Address>,
    pub resolved: bool,
    pub approved: bool,
    pub created_at: u64,
}

/// One transparent governance/history entry.
#[contracttype]
#[derive(Clone)]
pub struct HistoryEntry {
    pub period: u32,
    pub timestamp: u64,
    /// join_req | join_ok | join_no | joined | contrib | bid | resolved |
    /// default | withdraw | started | settled | liquid | hf_warn | removed | topup
    pub kind: Symbol,
    pub actor: Address,
    pub amount: i128,
    pub detail: String,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    State,
    Members,                   // Vec<Address> of confirmed members
    Member(Address),           // Member record
    Approved(Address),         // bool: approved by governance, may lock collateral
    Contributed(u32, Address), // bool: paid contribution for period N
    Claimable(Address),        // i128 claimable balance (payouts + bonuses)
    Debt(Address),             // i128 uncovered shortfall owed by a defaulter
    Bid(u32),                  // current leading Bid for period N
    Settled(u32),              // bool: settlement executed for period N
    Pot(u32),                  // i128 finalized contribution pool for period N
    JoinReq(Address),          // JoinRequest
    JoinReqList,               // Vec<Address> pending applicants
    History,                   // Vec<HistoryEntry>
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotOwner = 2,
    NotMember = 3,
    AlreadyMember = 4,
    GroupFull = 5,
    NotForming = 6,
    NotActive = 7,
    WrongPhase = 8,
    AlreadyContributed = 9,
    CollateralNotLocked = 10,
    AlreadyLocked = 11,
    AlreadyWon = 12,
    InvalidBid = 13,
    BidTooLow = 14,
    AlreadyVoted = 15,
    JoinNotApproved = 16,
    NoPendingRequest = 17,
    AlreadyResolved = 18,
    PeriodNotEnded = 19,
    NotEligible = 20,
    ReputationTooLow = 21,
    InvalidParams = 22,
    AlreadyRequested = 23,
    NotCompleted = 24,
    GracePeriodActive = 25,
    NothingToClaim = 26,
    NotConfirmed = 27,
    AlreadySettled = 28,
    NotSettled = 29,
    SettlementNotOpen = 30,
    InvalidAsset = 31,
    MemberRemoved = 32,
    InvalidAmount = 33,
}
