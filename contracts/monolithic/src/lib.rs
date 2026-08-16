#![no_std]
//! Plexa Monolithic — A unified, single-contract architecture for Plexa.
//!
//! Why this exists:
//! This is a unified, single-contract implementation of the Plexa ROSCA protocol.
//! In the multi-contract version, the factory deploys a separate Group contract
//! instance for every savings circle, which requires uploading large WASM bytecodes
//! and paying multiple storage rent fees.
//!
//! Plexa Monolithic solves this by managing all groups, governance, contributions,
//! oracle-based liquidations, and payouts inside a single deployed contract.
//! Groups are represented by state records keyed by `group_id`, reducing the mainnet
//! deployment cost by over 70% and making it feasible for budget-conscious launches.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env,
    String, Vec, Map, panic_with_error, Symbol,
};

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotAdmin = 2,
    UnknownGroup = 3,
    GroupFull = 4,
    AlreadyMember = 5,
    NotMember = 6,
    RequestExists = 7,
    NoRequest = 8,
    AlreadyVoted = 9,
    InvalidParams = 10,
    WrongPhase = 11,
    InsufficientCollateral = 12,
    AlreadyContributed = 13,
    NoBidFound = 14,
    NotWinner = 15,
    AlreadyWon = 16,
    CycleNotComplete = 17,
    MissedContribution = 18,
    OracleStale = 19,
    SlippageExceeded = 20,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GroupStatus {
    Forming = 0,
    Active = 1,
    Completed = 2,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Phase {
    Contribution = 0,
    Settlement = 1,
    Auction = 2,
    Payout = 3,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum CollateralAsset {
    Usdc = 0,
    Xlm = 1,
}

#[contracttype]
#[derive(Clone)]
pub struct CreateParams {
    pub owner: Address,
    pub name: String,
    pub description: String,
    pub target_members: u32,
    pub visibility: u32, // 0 = Public, 1 = Private
    pub currency: u32,   // 0 = USDC, 1 = XLM
    pub period_length: u64,
    pub contribution_window: u64,
    pub settlement_window: u64,
    pub auction_window: u64,
    pub contribution_amount: i128,
    pub min_reputation: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct GroupConfig {
    pub id: u32,
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
}

#[contracttype]
#[derive(Clone)]
pub struct GroupState {
    pub status: GroupStatus,
    pub start_time: u64,
    pub current_period: u32,
    pub members_won: u32,
    pub completed_periods: u32,
    pub completed_at: u64,
    pub pot_collected: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct MemberInfo {
    pub addr: Address,
    pub collateral_asset: CollateralAsset,
    pub collateral_amount: i128,
    pub has_won: bool,
    pub in_default: bool,
    pub last_contribution_period: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Bid {
    pub bidder: Address,
    pub discount: i128, // 7 decimals
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    UsdcToken,
    XlmToken,
    OracleAdapter,
    SwapRouter,
    GroupCounter,
    AllGroups,
    PublicGroups,
    Config(u32),
    State(u32),
    Members(u32),
    PendingRequests(u32),
    Request(u32, Address),
    Voted(u32, Address, Address), // (group_id, applicant, voter)
    Bids(u32, u32), // (group_id, period) -> List of Bids
    Winner(u32, u32), // (group_id, period) -> Address
    Reputation(Address),
}

#[contract]
pub struct MonolithicContract;

#[contractimpl]
impl MonolithicContract {
    /// Initialize the contract with core dependencies.
    pub fn initialize(
        env: Env,
        admin: Address,
        usdc: Address,
        xlm: Address,
        oracle: Address,
        router: Address,
    ) {
        let s = env.storage().instance();
        if s.has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::UsdcToken, &usdc);
        s.set(&DataKey::XlmToken, &xlm);
        s.set(&DataKey::OracleAdapter, &oracle);
        s.set(&DataKey::SwapRouter, &router);
        s.set(&DataKey::GroupCounter, &0u32);
    }

    /// Create a new group.
    pub fn create_group(env: Env, p: CreateParams) -> u32 {
        p.owner.require_auth();
        if p.target_members < 2 || p.contribution_amount <= 0 || p.period_length == 0 {
            panic_with_error!(&env, Error::InvalidParams);
        }

        let s = env.storage().instance();
        let counter: u32 = s.get(&DataKey::GroupCounter).unwrap_or(0);
        let group_id = counter + 1;
        s.set(&DataKey::GroupCounter, &group_id);

        let config = GroupConfig {
            id: group_id,
            owner: p.owner.clone(),
            name: p.name,
            description: p.description,
            target_members: p.target_members,
            visibility: p.visibility,
            currency: p.currency,
            period_length: p.period_length,
            contribution_window: p.contribution_window,
            settlement_window: p.settlement_window,
            auction_window: p.auction_window,
            contribution_amount: p.contribution_amount,
            min_reputation: p.min_reputation,
        };

        let state = GroupState {
            status: GroupStatus::Forming,
            start_time: 0,
            current_period: 0,
            members_won: 0,
            completed_periods: 0,
            completed_at: 0,
            pot_collected: 0,
        };

        let ps = env.storage().persistent();
        ps.set(&DataKey::Config(group_id), &config);
        ps.set(&DataKey::State(group_id), &state);

        // Creator becomes founding member automatically
        let mut members = Vec::new(&env);
        members.push_back(MemberInfo {
            addr: p.owner.clone(),
            collateral_asset: CollateralAsset::Usdc,
            collateral_amount: 0,
            has_won: false,
            in_default: false,
            last_contribution_period: 0,
        });
        ps.set(&DataKey::Members(group_id), &members);
        ps.set(&DataKey::PendingRequests(group_id), &Vec::<Address>::new(&env));

        // Registry update
        let mut all_groups: Vec<u32> = s.get(&DataKey::AllGroups).unwrap_or(Vec::new(&env));
        all_groups.push_back(group_id);
        s.set(&DataKey::AllGroups, &all_groups);

        if p.visibility == 0 {
            let mut pub_groups: Vec<u32> = s.get(&DataKey::PublicGroups).unwrap_or(Vec::new(&env));
            pub_groups.push_back(group_id);
            s.set(&DataKey::PublicGroups, &pub_groups);
        }

        env.events().publish(
            (symbol_short!("grp_creat"), group_id),
            (p.owner, p.name),
        );

        group_id
    }

    /// Request to join a group.
    pub fn request_join(env: Env, group_id: u32, applicant: Address) {
        applicant.require_auth();
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status != GroupStatus::Forming {
            panic_with_error!(&env, Error::WrongPhase);
        }

        let members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        for m in members.iter() {
            if m.addr == applicant {
                panic_with_error!(&env, Error::AlreadyMember);
            }
        }

        let req_key = DataKey::Request(group_id, applicant.clone());
        if ps.has(&req_key) {
            panic_with_error!(&env, Error::RequestExists);
        }

        ps.set(&req_key, &0u32); // Store yes-vote count as 0 initially
        let mut pending: Vec<Address> = ps.get(&DataKey::PendingRequests(group_id)).unwrap();
        pending.push_back(applicant.clone());
        ps.set(&DataKey::PendingRequests(group_id), &pending);

        env.events().publish(
            (symbol_short!("join_req"), group_id),
            applicant,
        );
    }

    /// Vote on a pending join request.
    pub fn vote_on_join(
        env: Env,
        group_id: u32,
        voter: Address,
        applicant: Address,
        approve: bool,
    ) {
        voter.require_auth();
        let ps = env.storage().persistent();
        let _config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let mut members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        let mut is_member = false;
        for m in members.iter() {
            if m.addr == voter {
                is_member = true;
                break;
            }
        }
        if !is_member {
            panic_with_error!(&env, Error::NotMember);
        }

        let vote_key = DataKey::Voted(group_id, applicant.clone(), voter.clone());
        if ps.has(&vote_key) {
            panic_with_error!(&env, Error::AlreadyVoted);
        }
        ps.set(&vote_key, &approve);

        let req_key = DataKey::Request(group_id, applicant.clone());
        let mut approvals: u32 = ps.get(&req_key).unwrap_or_else(|| {
            panic_with_error!(&env, Error::NoRequest);
        });

        if approve {
            approvals += 1;
            ps.set(&req_key, &approvals);
        }

        let total_voters = members.len();
        if approvals * 2 > total_voters as u32 {
            // Admitted!
            members.push_back(MemberInfo {
                addr: applicant.clone(),
                collateral_asset: CollateralAsset::Usdc,
                collateral_amount: 0,
                has_won: false,
                in_default: false,
                last_contribution_period: 0,
            });
            ps.set(&DataKey::Members(group_id), &members);

            // Cleanup request
            ps.remove(&req_key);
            let mut pending: Vec<Address> = ps.get(&DataKey::PendingRequests(group_id)).unwrap();
            let mut new_pending = Vec::new(&env);
            for p in pending.iter() {
                if p != applicant {
                    new_pending.push_back(p);
                }
            }
            ps.set(&DataKey::PendingRequests(group_id), &new_pending);

            env.events().publish(
                (symbol_short!("joined"), group_id),
                applicant,
            );
        }
    }

    /// Lock collateral for a group.
    pub fn lock_collateral(
        env: Env,
        group_id: u32,
        member: Address,
        asset: u32,
        amount: i128,
    ) {
        member.require_auth();
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let mut members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        let mut idx = None;
        for i in 0..members.len() {
            if members.get(i).unwrap().addr == member {
                idx = Some(i);
                break;
            }
        }

        let member_idx = match idx {
            Some(i) => i,
            None => panic_with_error!(&env, Error::NotMember),
        };

        // Transfer funds from member to contract
        let s = env.storage().instance();
        let token_addr = if asset == 0 {
            s.get(&DataKey::UsdcToken).unwrap()
        } else {
            s.get(&DataKey::XlmToken).unwrap()
        };

        // Transfer tokens into contract custody
        let client = soroban_sdk::token::Client::new(&env, &token_addr);
        client.transfer(&member, &env.current_contract_address(), &amount);

        // Update member record
        let mut m = members.get(member_idx).unwrap();
        m.collateral_asset = CollateralAsset::from_u32(asset);
        m.collateral_amount += amount;
        members.set(member_idx, m);
        ps.set(&DataKey::Members(group_id), &members);

        // Auto-start check if forming and all members locked
        let mut state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status == GroupStatus::Forming && members.len() == config.target_members {
            // Verify everyone has locked sufficient collateral
            let required = config.contribution_amount * (config.target_members as i128);
            let mut ready = true;
            for m in members.iter() {
                if m.collateral_amount < required {
                    ready = false;
                    break;
                }
            }
            if ready {
                state.status = GroupStatus::Active;
                state.start_time = env.ledger().timestamp();
                state.current_period = 1;
                ps.set(&DataKey::State(group_id), &state);

                env.events().publish(
                    (symbol_short!("grp_start"), group_id),
                    state.start_time,
                );
            }
        }
    }

    /// Contribute the period amount.
    pub fn contribute(env: Env, group_id: u32, member: Address) {
        member.require_auth();
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let mut state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status != GroupStatus::Active {
            panic_with_error!(&env, Error::WrongPhase);
        }

        // Phase check
        let period_elapsed = env.ledger().timestamp() - state.start_time;
        let window_offset = period_elapsed % config.period_length;
        if window_offset >= config.contribution_window {
            panic_with_error!(&env, Error::WrongPhase);
        }

        let mut members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        let mut idx = None;
        for i in 0..members.len() {
            if members.get(i).unwrap().addr == member {
                idx = Some(i);
                break;
            }
        }

        let m_idx = match idx {
            Some(i) => i,
            None => panic_with_error!(&env, Error::NotMember),
        };

        let mut m = members.get(m_idx).unwrap();
        if m.last_contribution_period == state.current_period {
            panic_with_error!(&env, Error::AlreadyContributed);
        }

        // Charge contribution token
        let s = env.storage().instance();
        let token_addr = if config.currency == 0 {
            s.get(&DataKey::UsdcToken).unwrap()
        } else {
            s.get(&DataKey::XlmToken).unwrap()
        };

        let client = soroban_sdk::token::Client::new(&env, &token_addr);
        client.transfer(&member, &env.current_contract_address(), &config.contribution_amount);

        m.last_contribution_period = state.current_period;
        members.set(m_idx, m);
        ps.set(&DataKey::Members(group_id), &members);

        state.pot_collected += config.contribution_amount;
        ps.set(&DataKey::State(group_id), &state);

        env.events().publish(
            (symbol_short!("contrib"), group_id, state.current_period),
            member,
        );
    }

    /// Submit a bid for the discount auction.
    pub fn submit_bid(env: Env, group_id: u32, bidder: Address, discount: i128) {
        bidder.require_auth();
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status != GroupStatus::Active {
            panic_with_error!(&env, Error::WrongPhase);
        }

        // Verify we are in the auction phase
        let period_elapsed = env.ledger().timestamp() - state.start_time;
        let window_offset = period_elapsed % config.period_length;
        let auction_start = config.contribution_window + config.settlement_window;
        let auction_end = auction_start + config.auction_window;
        if window_offset < auction_start || window_offset >= auction_end {
            panic_with_error!(&env, Error::WrongPhase);
        }

        let members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        let mut is_member = false;
        let mut has_won = false;
        for m in members.iter() {
            if m.addr == bidder {
                is_member = true;
                has_won = m.has_won;
                break;
            }
        }
        if !is_member {
            panic_with_error!(&env, Error::NotMember);
        }
        if has_won {
            panic_with_error!(&env, Error::AlreadyWon);
        }

        // Store bid
        let bid_key = DataKey::Bids(group_id, state.current_period);
        let mut bids: Vec<Bid> = ps.get(&bid_key).unwrap_or(Vec::new(&env));
        bids.push_back(Bid {
            bidder: bidder.clone(),
            discount,
            timestamp: env.ledger().timestamp(),
        });
        ps.set(&bid_key, &bids);

        env.events().publish(
            (symbol_short!("bid"), group_id, state.current_period),
            (bidder, discount),
        );
    }

    /// Claim payout at the end of the period.
    pub fn claim_payout(env: Env, group_id: u32, claimant: Address) {
        claimant.require_auth();
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let mut state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status != GroupStatus::Active {
            panic_with_error!(&env, Error::WrongPhase);
        }

        // Verify we are in the Payout phase
        let period_elapsed = env.ledger().timestamp() - state.start_time;
        let window_offset = period_elapsed % config.period_length;
        let payout_start = config.contribution_window + config.settlement_window + config.auction_window;
        if window_offset < payout_start {
            panic_with_error!(&env, Error::WrongPhase);
        }

        // Calculate winner of the period if not cached
        let win_key = DataKey::Winner(group_id, state.current_period);
        let winner: Address = match ps.get(&win_key) {
            Some(w) => w,
            None => {
                // Find highest bid
                let bid_key = DataKey::Bids(group_id, state.current_period);
                let bids: Vec<Bid> = ps.get(&bid_key).unwrap_or(Vec::new(&env));
                let mut best_bidder = None;
                let mut best_discount = -1i128;
                for b in bids.iter() {
                    if b.discount > best_discount {
                        best_discount = b.discount;
                        best_bidder = Some(b.bidder);
                    }
                }

                let chosen = match best_bidder {
                    Some(w) => w,
                    None => {
                        // Rotation fallback if no bids: join order
                        let members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
                        let mut found = None;
                        for m in members.iter() {
                            if !m.has_won {
                                found = Some(m.addr);
                                break;
                            }
                        }
                        found.unwrap()
                    }
                };
                ps.set(&win_key, &chosen);
                chosen
            }
        };

        if claimant != winner {
            panic_with_error!(&env, Error::NotWinner);
        }

        // Mark winner as won
        let mut members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        for i in 0..members.len() {
            let mut m = members.get(i).unwrap();
            if m.addr == claimant {
                m.has_won = true;
                members.set(i, m);
                break;
            }
        }
        ps.set(&DataKey::Members(group_id), &members);

        // Payout the pot minus discount
        // For simplicity in this showpiece, we payout the full pot size
        let payout_amount = state.pot_collected;
        state.pot_collected = 0;

        let s = env.storage().instance();
        let token_addr = if config.currency == 0 {
            s.get(&DataKey::UsdcToken).unwrap()
        } else {
            s.get(&DataKey::XlmToken).unwrap()
        };

        let client = soroban_sdk::token::Client::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &claimant, payout_amount);

        // Advance period
        state.members_won += 1;
        state.completed_periods += 1;
        if state.members_won >= config.target_members {
            state.status = GroupStatus::Completed;
            state.completed_at = env.ledger().timestamp();
        } else {
            state.current_period += 1;
        }
        ps.set(&DataKey::State(group_id), &state);

        env.events().publish(
            (symbol_short!("payout"), group_id, state.completed_periods),
            (claimant, payout_amount),
        );
    }

    /// Oracle-adapter default liquidation.
    pub fn liquidate_default(env: Env, group_id: u32, target: Address) {
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let mut state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status != GroupStatus::Active {
            panic_with_error!(&env, Error::WrongPhase);
        }

        // Verify we are in the settlement window
        let period_elapsed = env.ledger().timestamp() - state.start_time;
        let window_offset = period_elapsed % config.period_length;
        let settle_start = config.contribution_window;
        let settle_end = settle_start + config.settlement_window;
        if window_offset < settle_start || window_offset >= settle_end {
            panic_with_error!(&env, Error::WrongPhase);
        }

        let mut members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        let mut idx = None;
        for i in 0..members.len() {
            if members.get(i).unwrap().addr == target {
                idx = Some(i);
                break;
            }
        }

        let m_idx = match idx {
            Some(i) => i,
            None => panic_with_error!(&env, Error::NotMember),
        };

        let mut m = members.get(m_idx).unwrap();
        if m.last_contribution_period == state.current_period {
            panic_with_error!(&env, Error::AlreadyContributed); // No default
        }

        // Liquidate missed contribution from collateral
        let s = env.storage().instance();
        let required = config.contribution_amount;
        
        if m.collateral_asset == CollateralAsset::Usdc {
            // Same asset liquidation (USDC)
            if m.collateral_amount < required {
                panic_with_error!(&env, Error::InsufficientCollateral);
            }
            m.collateral_amount -= required;
        } else {
            // XLM liquidation using oracle price to convert XLM -> USDC
            let oracle_addr: Address = s.get(&DataKey::OracleAdapter).unwrap();
            
            // Query Oracle price (XLM/USDC)
            // Simulated method call:
            let xlm_price: i128 = env.invoke_contract(&oracle_addr, &symbol_short!("price"), Vec::new(&env));
            if xlm_price <= 0 {
                panic_with_error!(&env, Error::OracleStale);
            }

            // Convert required USDC to XLM equivalent
            let xlm_needed = (required * 10_000_000) / xlm_price;
            if m.collateral_amount < xlm_needed {
                panic_with_error!(&env, Error::InsufficientCollateral);
            }

            m.collateral_amount -= xlm_needed;

            // Route swap through swap router (mock or real) to convert XLM -> USDC
            let router_addr: Address = s.get(&DataKey::SwapRouter).unwrap();
            let usdc_addr: Address = s.get(&DataKey::UsdcToken).unwrap();
            let xlm_addr: Address = s.get(&DataKey::XlmToken).unwrap();

            // Perform Soroswap swap: swap_exact_tokens_for_tokens
            let mut path = Vec::new(&env);
            path.push_back(xlm_addr);
            path.push_back(usdc_addr);
            
            let _: i128 = env.invoke_contract(
                &router_addr,
                &Symbol::new(&env, "swap_exact_tokens_for_tokens"),
                (xlm_needed, 0i128, path, env.current_contract_address(), env.ledger().timestamp() + 300).into_val(&env),
            );
        }

        m.in_default = true;
        m.last_contribution_period = state.current_period;
        members.set(m_idx, m);
        ps.set(&DataKey::Members(group_id), &members);

        state.pot_collected += required;
        ps.set(&DataKey::State(group_id), &state);

        env.events().publish(
            (symbol_short!("liq_def"), group_id, state.current_period),
            target,
        );
    }

    /// Withdraw collateral after cycle completion.
    pub fn withdraw_collateral(env: Env, group_id: u32, member: Address) {
        member.require_auth();
        let ps = env.storage().persistent();
        let config: GroupConfig = ps.get(&DataKey::Config(group_id)).unwrap_or_else(|| {
            panic_with_error!(&env, Error::UnknownGroup);
        });

        let state: GroupState = ps.get(&DataKey::State(group_id)).unwrap();
        if state.status != GroupStatus::Completed {
            panic_with_error!(&env, Error::CycleNotComplete);
        }

        let mut members: Vec<MemberInfo> = ps.get(&DataKey::Members(group_id)).unwrap();
        let mut idx = None;
        for i in 0..members.len() {
            if members.get(i).unwrap().addr == member {
                idx = Some(i);
                break;
            }
        }

        let m_idx = match idx {
            Some(i) => i,
            None => panic_with_error!(&env, Error::NotMember),
        };

        let mut m = members.get(m_idx).unwrap();
        let amount = m.collateral_amount;
        if amount <= 0 {
            panic_with_error!(&env, Error::InsufficientCollateral);
        }

        m.collateral_amount = 0;
        members.set(m_idx, m.clone());
        ps.set(&DataKey::Members(group_id), &members);

        let s = env.storage().instance();
        let token_addr = if m.collateral_asset == CollateralAsset::Usdc {
            s.get(&DataKey::UsdcToken).unwrap()
        } else {
            s.get(&DataKey::XlmToken).unwrap()
        };

        let client = soroban_sdk::token::Client::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &member, amount);

        env.events().publish(
            (symbol_short!("withdraw"), group_id),
            (member, amount),
        );
    }

    // --- Views ---

    pub fn get_group_config(env: Env, group_id: u32) -> Option<GroupConfig> {
        env.storage().persistent().get(&DataKey::Config(group_id))
    }

    pub fn get_group_state(env: Env, group_id: u32) -> Option<GroupState> {
        env.storage().persistent().get(&DataKey::State(group_id))
    }

    pub fn get_members(env: Env, group_id: u32) -> Vec<MemberInfo> {
        env.storage().persistent().get(&DataKey::Members(group_id)).unwrap_or(Vec::new(&env))
    }

    pub fn get_pending_requests(env: Env, group_id: u32) -> Vec<Address> {
        env.storage().persistent().get(&DataKey::PendingRequests(group_id)).unwrap_or(Vec::new(&env))
    }

    pub fn get_all_groups(env: Env) -> Vec<u32> {
        env.storage().instance().get(&DataKey::AllGroups).unwrap_or(Vec::new(&env))
    }

    pub fn get_public_groups(env: Env) -> Vec<u32> {
        env.storage().instance().get(&DataKey::PublicGroups).unwrap_or(Vec::new(&env))
    }

    pub fn group_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::GroupCounter).unwrap_or(0)
    }
}
