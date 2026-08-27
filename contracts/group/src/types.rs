use soroban_sdk::{contracterror, contracttype, Address, String, Symbol, Vec};

/// Category classification for ROSCA groups.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum GroupCategory {
    General = 0,
    Emergency = 1,
    Business = 2,
    FamilyCommunity = 3,
    HighYieldSavings = 4,
}

impl GroupCategory {
    pub fn from_u32(v: u32) -> GroupCategory {
        match v {
            1 => GroupCategory::Emergency,
            2 => GroupCategory::Business,
            3 => GroupCategory::FamilyCommunity,
            4 => GroupCategory::HighYieldSavings,
            _ => GroupCategory::General,
        }
    }
}

/// Group visibility: 0 = Public (discoverable in registry), 1 = Private (invite-only).
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
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

/// Lifecycle states of a ROSCA group.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum GroupStatus {
    /// Members are joining, locking collateral, and depositing initial contribution.
    Forming = 0,
    /// All members locked and funded; rotating periods running.
    Active = 1,
    /// Every eligible member won once; cycle finished and collateral unlocked.
    Completed = 2,
    /// Emergency early dissolution approved by supermajority vote.
    EmergencyDissolved = 3,
}

/// Four distinct sub-windows within each active period.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Phase {
    Contribution = 0,
    Settlement = 1,
    Auction = 2,
    Payout = 3,
}

/// Collateral asset choice: 0 = USDC (100% of pot), 1 = XLM (150% of pot via Oracle).
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
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

/// Constructor parameters bundle matching factory deployer on the wire.
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
    pub category: u32,
    pub late_fee_bps: u32,
    pub usdc: Address,
    pub xlm: Address,
    pub oracle: Address,
    pub router: Address,
    pub factory: Address,
    pub treasury: Address,
    pub protocol_fee_bps: u32,
}

/// Immutable configuration of the ROSCA group.
#[contracttype]
#[derive(Clone)]
pub struct GroupConfig {
    pub name: String,
    pub description: String,
    pub owner: Address,
    pub target_members: u32,
    pub visibility: Visibility,
    pub currency: CollateralAsset,
    pub category: GroupCategory,
    // Timing in seconds
    pub period_length: u64,
    pub contribution_window: u64,
    pub settlement_window: u64,
    pub auction_window: u64,
    pub payout_window: u64,
    // Financial parameters (7 decimals)
    pub contribution_amount: i128,
    pub pot_size: i128,
    pub collateral_requirement: i128,
    pub min_reputation: u32,
    pub late_fee_bps: u32,
    pub protocol_fee_bps: u32,
    // External contract bindings
    pub usdc: Address,
    pub xlm: Address,
    pub oracle: Address,
    pub router: Address,
    pub factory: Address,
    pub treasury: Address,
}

/// Mutable lifecycle state of the group.
#[contracttype]
#[derive(Clone)]
pub struct GroupState {
    pub status: GroupStatus,
    pub start_time: u64,
    pub current_period: u32,
    pub members_won: u32,
    pub completed_periods: u32,
    pub completed_at: u64,
    pub dissolved_at: u64,
    pub total_volume_distributed: i128,
    pub total_discounts_distributed: i128,
    pub total_fees_collected: i128,
}

/// Per-member on-chain record.
#[contracttype]
#[derive(Clone)]
pub struct Member {
    pub addr: Address,
    pub collateral_asset: CollateralAsset,
    pub collateral_usdc: i128,
    pub collateral_xlm: i128,
    pub has_won: bool,
    pub won_period: u32,
    pub in_default: bool,
    pub default_count: u32,
    pub removed: bool,
    pub hf_breach_period: u32,
    pub joined_period: u32,
    pub total_contributed: i128,
    pub total_claimed: i128,
}

/// Active highest bid for the period discount auction.
#[contracttype]
#[derive(Clone)]
pub struct Bid {
    pub bidder: Address,
    pub discount: i128,
    pub placed_at: u64,
}

/// Governance request for joining the group.
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

/// Governance proposal for emergency early dissolution.
#[contracttype]
#[derive(Clone)]
pub struct DissolutionProposal {
    pub proposer: Address,
    pub votes_count: u32,
    pub voters: Vec<Address>,
    pub passed: bool,
    pub created_at: u64,
}

/// Summary metrics for an individual settled period.
#[contracttype]
#[derive(Clone)]
pub struct PeriodMetrics {
    pub period: u32,
    pub pot_collected: i128,
    pub winner: Address,
    pub payout_amount: i128,
    pub discount_split: i128,
    pub protocol_fee: i128,
    pub defaults_count: u32,
    pub settled_at: u64,
    pub resolved_at: u64,
}

/// Audit history log entry.
#[contracttype]
#[derive(Clone)]
pub struct HistoryEntry {
    pub period: u32,
    pub timestamp: u64,
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
    Members,
    Member(Address),
    Approved(Address),
    Contributed(u32, Address),
    EarlyContributor(u32, Address),
    Claimable(Address),
    Debt(Address),
    Bid(u32),
    AuctionExtension(u32), // u64 extra seconds added via anti-sniping
    Settled(u32),
    Pot(u32),
    PeriodMetric(u32),
    JoinReq(Address),
    JoinReqList,
    Dissolution,
    History,
    PendingUpgrade,
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
    NoPendingUpgrade = 34,
    TimelockActive = 35,
    GroupDissolved = 36,
    ProposalActive = 37,
    NoActiveProposal = 38,
}

