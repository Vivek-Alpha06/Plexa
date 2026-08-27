#![no_std]
//! Plexa Factory — Decentralized ROSCA Factory, Group Discovery Registry,
//! Multi-Tier Credit Scoring Engine, Protocol Treasury Controller, and Governance Hub.

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    IntoVal, String, Symbol, Val, Vec,
};

/// Category classification for deployed ROSCA groups.
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

/// User reputation tier based on on-chain ROSCA credit performance.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum ReputationTier {
    Newcomer = 0, // Score 0..2
    Bronze = 1,   // Score 3..5
    Silver = 2,   // Score 6..10
    Gold = 3,     // Score 11..20
    Platinum = 4, // Score 21+
}

impl ReputationTier {
    pub fn from_score(score: u32) -> ReputationTier {
        if score >= 21 {
            ReputationTier::Platinum
        } else if score >= 11 {
            ReputationTier::Gold
        } else if score >= 6 {
            ReputationTier::Silver
        } else if score >= 3 {
            ReputationTier::Bronze
        } else {
            ReputationTier::Newcomer
        }
    }
}

/// Comprehensive on-chain credit and reputation profile for a participant.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReputationProfile {
    pub score: u32,
    pub clean_cycles: u32,
    pub default_count: u32,
    pub tier: ReputationTier,
    pub total_volume_saved: i128,
    pub vouched_by: Option<Address>,
    pub last_active_timestamp: u64,
}

/// Global protocol analytics and cumulative performance statistics.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ProtocolStats {
    pub total_groups_created: u32,
    pub total_groups_completed: u32,
    pub total_active_groups: u32,
    pub total_volume_locked: i128,
    pub total_payouts_distributed: i128,
    pub total_discounts_split: i128,
    pub total_defaults_prevented: u32,
    pub total_reputation_minted: u32,
}

/// Summary card representation of a group for discovery feeds and filtering.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct GroupSummary {
    pub group_address: Address,
    pub owner: Address,
    pub name: String,
    pub category: GroupCategory,
    pub visibility: u32,
    pub currency: u32,
    pub target_members: u32,
    pub contribution_amount: i128,
    pub pot_size: i128,
    pub created_at: u64,
    pub is_verified: bool,
}

/// Mirror of the Group contract's `GroupParams`. `#[contracttype]` structs
/// serialize by field name, so this matches the Group constructor on the wire
/// without the factory depending on the group crate.
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

/// Creation inputs supplied by the user (the factory injects system addresses,
/// treasury, and fee configuration automatically).
#[contracttype]
#[derive(Clone)]
pub struct CreateParams {
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub target_members: u32,
    pub visibility: u32,
    /// 0 = USDC, 1 = XLM — the token the group's contributions/payouts use.
    pub currency: u32,
    pub period_length: u64,
    pub contribution_window: u64,
    pub settlement_window: u64,
    pub auction_window: u64,
    pub contribution_amount: i128,
    pub min_reputation: u32,
    pub category: u32,
    pub late_fee_bps: u32,
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotAdmin = 2,
    NotPendingAdmin = 3,
    UnknownGroup = 4,
    NotCompleted = 5,
    AlreadySynced = 6,
    InvalidParams = 7,
    NoPendingUpgrade = 8,
    TimelockActive = 9,
    ProtocolPaused = 10,
    AddressBlacklisted = 11,
    FeeTooHigh = 12,
    ReputationTooLow = 13,
    UnauthorizedGroup = 14,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    WasmHash,
    Usdc,
    Xlm,
    Oracle,
    Router,
    Treasury,
    ProtocolFeeBps,
    Counter,
    AllGroups,
    PublicGroups,
    GroupsByCategory(u32),
    GroupsByOwner(Address),
    IsGroup(Address),
    Reputation(Address),
    RepProfile(Address),
    Synced(Address),
    Verified(Address),
    Blacklisted(Address),
    Paused,
    Stats,
    PendingWasm,    // (BytesN<32>, u64) proposed group wasm + earliest apply ts
    PendingUpgrade, // (BytesN<32>, u64) proposed factory wasm + earliest apply ts
}

/// 48-hour timelock delay for contract upgrades.
const UPGRADE_DELAY: u64 = 172_800;
/// Max protocol fee: 5% (500 basis points).
const MAX_PROTOCOL_FEE_BPS: u32 = 500;
/// TTL Extension parameters (~30 days).
const BUMP_AMOUNT: u32 = 518_400;
const BUMP_THRESHOLD: u32 = 60_480;

#[contract]
pub struct FactoryContract;

#[contractimpl]
impl FactoryContract {
    /// Deploy-time initialization of the Plexa Factory.
    pub fn __constructor(
        env: Env,
        admin: Address,
        wasm_hash: BytesN<32>,
        usdc: Address,
        xlm: Address,
        oracle: Address,
        router: Address,
    ) {
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::WasmHash, &wasm_hash);
        store.set(&DataKey::Usdc, &usdc);
        store.set(&DataKey::Xlm, &xlm);
        store.set(&DataKey::Oracle, &oracle);
        store.set(&DataKey::Router, &router);
        store.set(&DataKey::Treasury, &admin);
        store.set(&DataKey::ProtocolFeeBps, &0u32); // Default 0%
        store.set(&DataKey::Counter, &0u32);
        store.set(&DataKey::Paused, &false);
        store.set(&DataKey::AllGroups, &Vec::<Address>::new(&env));
        store.set(&DataKey::PublicGroups, &Vec::<Address>::new(&env));

        let initial_stats = ProtocolStats {
            total_groups_created: 0,
            total_groups_completed: 0,
            total_active_groups: 0,
            total_volume_locked: 0,
            total_payouts_distributed: 0,
            total_discounts_split: 0,
            total_defaults_prevented: 0,
            total_reputation_minted: 0,
        };
        store.set(&DataKey::Stats, &initial_stats);
        bump_instance(&env);
    }

    /// Deploy a new ROSCA group and register it in discovery indexes.
    /// `p.visibility`: 0 = Public (added to discovery feed), 1 = Private.
    pub fn create_group(env: Env, p: CreateParams) -> Address {
        p.owner.require_auth();
        let store = env.storage().instance();

        // 1. Protocol security checks
        let paused: bool = store.get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic_with(&env, Error::ProtocolPaused);
        }
        if env
            .storage()
            .persistent()
            .get(&DataKey::Blacklisted(p.owner.clone()))
            .unwrap_or(false)
        {
            panic_with(&env, Error::AddressBlacklisted);
        }

        // 2. Validate input parameters
        if p.target_members < 2 || p.target_members > 255 {
            panic_with(&env, Error::InvalidParams);
        }
        if p.currency > 1 {
            panic_with(&env, Error::InvalidParams);
        }
        if p.contribution_amount <= 0 || p.period_length == 0 {
            panic_with(&env, Error::InvalidParams);
        }
        if p.contribution_window == 0 || p.auction_window == 0 {
            panic_with(&env, Error::InvalidParams);
        }
        let total_windows = p
            .contribution_window
            .checked_add(p.settlement_window)
            .and_then(|w| w.checked_add(p.auction_window))
            .unwrap_or(u64::MAX);
        if total_windows >= p.period_length {
            panic_with(&env, Error::InvalidParams);
        }

        // 3. Check reputation threshold if required by creator
        if p.min_reputation > 0 {
            let creator_rep = Self::rep_of(env.clone(), p.owner.clone());
            if creator_rep < p.min_reputation {
                panic_with(&env, Error::ReputationTooLow);
            }
        }

        let wasm_hash: BytesN<32> = store.get(&DataKey::WasmHash).unwrap();
        let usdc: Address = store.get(&DataKey::Usdc).unwrap();
        let xlm: Address = store.get(&DataKey::Xlm).unwrap();
        let oracle: Address = store.get(&DataKey::Oracle).unwrap();
        let router: Address = store.get(&DataKey::Router).unwrap();
        let treasury: Address = store.get(&DataKey::Treasury).unwrap_or(p.owner.clone());
        let protocol_fee_bps: u32 = store.get(&DataKey::ProtocolFeeBps).unwrap_or(0);
        let factory = env.current_contract_address();

        let mut counter: u32 = store.get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        store.set(&DataKey::Counter, &counter);

        let mut salt_bytes = [0u8; 32];
        salt_bytes[0..4].copy_from_slice(&counter.to_be_bytes());
        let salt = BytesN::from_array(&env, &salt_bytes);

        let visibility = p.visibility;
        let category = p.category;
        let owner = p.owner.clone();
        let pot_size = p.contribution_amount * (p.target_members as i128);

        let params = GroupParams {
            owner: p.owner.clone(),
            name: p.name.clone(),
            description: p.description.clone(),
            target_members: p.target_members,
            visibility: p.visibility,
            currency: p.currency,
            period_length: p.period_length,
            contribution_window: p.contribution_window,
            settlement_window: p.settlement_window,
            auction_window: p.auction_window,
            contribution_amount: p.contribution_amount,
            min_reputation: p.min_reputation,
            category: p.category,
            late_fee_bps: p.late_fee_bps,
            usdc,
            xlm,
            oracle,
            router,
            factory,
            treasury,
            protocol_fee_bps,
        };

        // Deploy the group contract dynamically via Soroban deployer
        let mut args: Vec<Val> = Vec::new(&env);
        args.push_back(params.into_val(&env));

        let group = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, args);

        // 4. Update Registries & Indexes
        store.set(&DataKey::IsGroup(group.clone()), &true);

        let mut all: Vec<Address> = store.get(&DataKey::AllGroups).unwrap_or(Vec::new(&env));
        all.push_back(group.clone());
        store.set(&DataKey::AllGroups, &all);

        if visibility == 0 {
            let mut public: Vec<Address> =
                store.get(&DataKey::PublicGroups).unwrap_or(Vec::new(&env));
            public.push_back(group.clone());
            store.set(&DataKey::PublicGroups, &public);
        }

        // Category index
        let cat_key = DataKey::GroupsByCategory(category);
        let mut by_cat: Vec<Address> = store.get(&cat_key).unwrap_or(Vec::new(&env));
        by_cat.push_back(group.clone());
        store.set(&cat_key, &by_cat);

        // Owner index
        let owner_key = DataKey::GroupsByOwner(owner.clone());
        let mut by_owner: Vec<Address> = store.get(&owner_key).unwrap_or(Vec::new(&env));
        by_owner.push_back(group.clone());
        store.set(&owner_key, &by_owner);

        // 5. Update Protocol Analytics
        let mut stats: ProtocolStats = store.get(&DataKey::Stats).unwrap();
        stats.total_groups_created += 1;
        stats.total_active_groups += 1;
        stats.total_volume_locked += pot_size;
        store.set(&DataKey::Stats, &stats);

        env.events().publish(
            (symbol_short!("created"), category, p.currency),
            (owner, group.clone(), p.contribution_amount, p.target_members),
        );

        bump_instance(&env);
        group
    }

    /// Pull and synchronize on-chain reputation from a completed group.
    /// Every graduate (finished without defaulting) gains +1 base credit score
    /// plus streak multiplier and tier upgrades. Defaulters receive credit penalties.
    pub fn sync_reputation(env: Env, group: Address) {
        let store = env.storage().instance();
        if !store.get(&DataKey::IsGroup(group.clone())).unwrap_or(false) {
            panic_with(&env, Error::UnknownGroup);
        }
        if store.get(&DataKey::Synced(group.clone())).unwrap_or(false) {
            panic_with(&env, Error::AlreadySynced);
        }

        let completed: bool =
            env.invoke_contract(&group, &Symbol::new(&env, "is_completed"), Vec::new(&env));
        if !completed {
            panic_with(&env, Error::NotCompleted);
        }

        let graduates: Vec<Address> =
            env.invoke_contract(&group, &symbol_short!("graduates"), Vec::new(&env));

        let now = env.ledger().timestamp();
        let mut minted_rep = 0u32;

        for addr in graduates.iter() {
            let mut profile = Self::get_reputation_profile(env.clone(), addr.clone());
            profile.clean_cycles += 1;
            // Clean streak bonus: 1 base point + bonus for consistent cycles
            let streak_bonus = if profile.clean_cycles % 3 == 0 { 2 } else { 1 };
            profile.score += streak_bonus;
            profile.tier = ReputationTier::from_score(profile.score);
            profile.last_active_timestamp = now;

            store.set(&DataKey::Reputation(addr.clone()), &profile.score);
            env.storage()
                .persistent()
                .set(&DataKey::RepProfile(addr.clone()), &profile);
            minted_rep += streak_bonus;
        }

        // Update protocol-wide stats
        let mut stats: ProtocolStats = store.get(&DataKey::Stats).unwrap();
        stats.total_groups_completed += 1;
        if stats.total_active_groups > 0 {
            stats.total_active_groups -= 1;
        }
        stats.total_reputation_minted += minted_rep;
        store.set(&DataKey::Stats, &stats);

        store.set(&DataKey::Synced(group.clone()), &true);
        env.events()
            .publish((symbol_short!("rep_sync"),), (group, graduates.len(), minted_rep));
        bump_instance(&env);
    }

    /// Endorse / Vouch for another participant's creditworthiness on-chain.
    /// Requires Gold+ tier (11+ score) to vouch.
    pub fn vouch_member(env: Env, voucher: Address, candidate: Address) {
        voucher.require_auth();
        let voucher_profile = Self::get_reputation_profile(env.clone(), voucher.clone());
        if voucher_profile.score < 11 {
            panic_with(&env, Error::ReputationTooLow);
        }
        let mut candidate_profile = Self::get_reputation_profile(env.clone(), candidate.clone());
        candidate_profile.vouched_by = Some(voucher.clone());
        env.storage()
            .persistent()
            .set(&DataKey::RepProfile(candidate.clone()), &candidate_profile);

        env.events()
            .publish((symbol_short!("vouched"),), (voucher, candidate));
    }

    /// Admin / Curator badge verification for reputable community groups.
    pub fn verify_group(env: Env, group: Address, verified: bool) {
        require_admin(&env);
        let store = env.storage().instance();
        if !store.get(&DataKey::IsGroup(group.clone())).unwrap_or(false) {
            panic_with(&env, Error::UnknownGroup);
        }
        store.set(&DataKey::Verified(group.clone()), &verified);
        env.events()
            .publish((symbol_short!("verified"),), (group, verified));
    }

    /// Blacklist or un-blacklist an address from creating / participating in groups.
    pub fn set_blacklist(env: Env, target: Address, blacklisted: bool) {
        require_admin(&env);
        env.storage()
            .persistent()
            .set(&DataKey::Blacklisted(target.clone()), &blacklisted);
        env.events()
            .publish((symbol_short!("bl_set"),), (target, blacklisted));
    }

    /// Emergency circuit breaker pause switch for the protocol.
    pub fn set_paused(env: Env, paused: bool) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Paused, &paused);
        env.events().publish((symbol_short!("pause_set"),), paused);
    }

    /// Update the protocol fee treasury address.
    pub fn set_treasury(env: Env, new_treasury: Address) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Treasury, &new_treasury);
        env.events().publish((symbol_short!("treasury"),), new_treasury);
    }

    /// Set the protocol fee in basis points (max 500 bps = 5%).
    pub fn set_protocol_fee_bps(env: Env, fee_bps: u32) {
        require_admin(&env);
        if fee_bps > MAX_PROTOCOL_FEE_BPS {
            panic_with(&env, Error::FeeTooHigh);
        }
        env.storage().instance().set(&DataKey::ProtocolFeeBps, &fee_bps);
        env.events().publish((symbol_short!("fee_set"),), fee_bps);
    }

    // ------------------------------------------------------------------- Views

    /// Read reputation score for an address (count of cleanly-completed cycles + bonuses).
    pub fn rep_of(env: Env, addr: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Reputation(addr))
            .unwrap_or(0)
    }

    /// Read detailed credit profile and tier status.
    pub fn get_reputation_profile(env: Env, addr: Address) -> ReputationProfile {
        let default_score = env
            .storage()
            .instance()
            .get(&DataKey::Reputation(addr.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .get(&DataKey::RepProfile(addr.clone()))
            .unwrap_or(ReputationProfile {
                score: default_score,
                clean_cycles: default_score,
                default_count: 0,
                tier: ReputationTier::from_score(default_score),
                total_volume_saved: 0,
                vouched_by: None,
                last_active_timestamp: 0,
            })
    }

    /// Get all publicly discoverable groups.
    pub fn get_public_groups(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::PublicGroups)
            .unwrap_or(Vec::new(&env))
    }

    /// Get all deployed groups.
    pub fn get_all_groups(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AllGroups)
            .unwrap_or(Vec::new(&env))
    }

    /// Filter groups by category (Emergency, Business, Community, Savings, etc.).
    pub fn get_groups_by_category(env: Env, category: u32) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::GroupsByCategory(category))
            .unwrap_or(Vec::new(&env))
    }

    /// Filter groups created by a specific owner/curator.
    pub fn get_groups_by_owner(env: Env, owner: Address) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::GroupsByOwner(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Read global protocol statistics and metrics.
    pub fn get_protocol_stats(env: Env) -> ProtocolStats {
        env.storage().instance().get(&DataKey::Stats).unwrap_or(ProtocolStats {
            total_groups_created: 0,
            total_groups_completed: 0,
            total_active_groups: 0,
            total_volume_locked: 0,
            total_payouts_distributed: 0,
            total_discounts_split: 0,
            total_defaults_prevented: 0,
            total_reputation_minted: 0,
        })
    }

    /// Is this address a verified official group deployed by this factory?
    pub fn is_group(env: Env, addr: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsGroup(addr))
            .unwrap_or(false)
    }

    /// Has this group received an official verification badge?
    pub fn is_verified(env: Env, addr: Address) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Verified(addr))
            .unwrap_or(false)
    }

    /// Is this address blacklisted from protocol participation?
    pub fn is_blacklisted(env: Env, addr: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Blacklisted(addr))
            .unwrap_or(false)
    }

    /// Is the protocol currently paused?
    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    pub fn pending_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    pub fn treasury(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Treasury)
            .unwrap_or_else(|| Self::admin(env.clone()))
    }

    pub fn protocol_fee_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::ProtocolFeeBps).unwrap_or(0)
    }

    /// Installed Group wasm hash that `create_group` deploys.
    pub fn group_wasm(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::WasmHash).unwrap()
    }

    // ------------------------------------------------- Upgrades & Governance

    /// 2-Step Admin Transfer: Step 1 propose new admin.
    pub fn transfer_admin(env: Env, new_admin: Address) {
        require_admin(&env);
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        env.events().publish((symbol_short!("adm_prop"),), new_admin);
    }

    /// 2-Step Admin Transfer: Step 2 new admin claims role.
    pub fn accept_admin(env: Env) {
        let store = env.storage().instance();
        let pending: Address = store
            .get(&DataKey::PendingAdmin)
            .unwrap_or_else(|| panic_with(&env, Error::NotPendingAdmin));
        pending.require_auth();

        store.set(&DataKey::Admin, &pending);
        store.remove(&DataKey::PendingAdmin);
        env.events().publish((symbol_short!("admin_set"),), pending);
    }

    /// Direct admin rotation (backward compatible).
    pub fn set_admin(env: Env, new_admin: Address) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events().publish((symbol_short!("admin_set"),), new_admin);
    }

    /// Propose a new Group WASM hash with 48h timelock.
    pub fn propose_group_wasm(env: Env, new_wasm_hash: BytesN<32>) {
        require_admin(&env);
        let ready_at = env.ledger().timestamp() + UPGRADE_DELAY;
        env.storage()
            .instance()
            .set(&DataKey::PendingWasm, &(new_wasm_hash.clone(), ready_at));
        env.events()
            .publish((symbol_short!("wasm_prop"),), (new_wasm_hash, ready_at));
    }

    pub fn apply_group_wasm(env: Env) {
        require_admin(&env);
        let hash = take_pending(&env, DataKey::PendingWasm);
        env.storage().instance().set(&DataKey::WasmHash, &hash);
        env.events().publish((symbol_short!("wasm_set"),), hash);
    }

    /// Propose factory contract upgrade with 48h timelock.
    pub fn propose_upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        require_admin(&env);
        let ready_at = env.ledger().timestamp() + UPGRADE_DELAY;
        env.storage()
            .instance()
            .set(&DataKey::PendingUpgrade, &(new_wasm_hash.clone(), ready_at));
        env.events()
            .publish((symbol_short!("up_prop"),), (new_wasm_hash, ready_at));
    }

    pub fn apply_upgrade(env: Env) {
        require_admin(&env);
        let hash = take_pending(&env, DataKey::PendingUpgrade);
        env.deployer().update_current_contract_wasm(hash);
    }

    pub fn cancel_pending(env: Env) {
        require_admin(&env);
        let s = env.storage().instance();
        s.remove(&DataKey::PendingWasm);
        s.remove(&DataKey::PendingUpgrade);
        env.events().publish((symbol_short!("cancelled"),), ());
    }

    pub fn pending_group_wasm(env: Env) -> Option<(BytesN<32>, u64)> {
        env.storage().instance().get(&DataKey::PendingWasm)
    }

    pub fn pending_upgrade(env: Env) -> Option<(BytesN<32>, u64)> {
        env.storage().instance().get(&DataKey::PendingUpgrade)
    }
}

fn panic_with(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}

fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}

fn take_pending(env: &Env, key: DataKey) -> BytesN<32> {
    let (hash, ready_at): (BytesN<32>, u64) = match env.storage().instance().get(&key) {
        Some(p) => p,
        None => panic_with(env, Error::NoPendingUpgrade),
    };
    if env.ledger().timestamp() < ready_at {
        panic_with(env, Error::TimelockActive);
    }
    env.storage().instance().remove(&key);
    hash
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

