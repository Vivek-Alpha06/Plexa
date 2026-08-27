#![no_std]
//! Plexa Group contract — One deployed instance per decentralized ROSCA savings circle.
//!
//! Implements the complete Rotating Savings and Credit Association protocol on Stellar/Soroban:
//! - Multi-token support (USDC / XLM) with precision scaling.
//! - 4-Phase Period Clock: Contribution -> Settlement -> Auction -> Payout.
//! - Dual Collateral: 100% same-asset or 150% cross-asset overcollateralized via Reflector Oracle.
//! - Automated Liquidation Engine: Soroswap AMM router integration with fallback debt accounting.
//! - Open Descending Discount Auction with Anti-Sniping dynamic window extensions.
//! - Equal Discount Dividend Distribution across all active circle participants.
//! - Deterministic Join-Order Rotation fallback when no bids are placed.
//! - Emergency Group Dissolution Governance & Forming-stage safe exits.
//! - Self-Advancing Keeperless Engine (catch_up on user interactions).
//! - 48-Hour Timelocked Contract Upgradeability.

mod types;
#[cfg(test)]
mod test;

pub use types::*;

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractimpl, symbol_short, token, vec, Address, BytesN, Env, IntoVal, String, Symbol, Val,
    Vec,
};

/// Max settlement grace after the cycle completes (24 hours).
const GRACE_PERIOD: u64 = 86_400;
/// Margin added to `now` for the router's swap deadline.
const SWAP_DEADLINE_WINDOW: u64 = 300;
/// 7-decimal fixed point scale for USDC, XLM and Oracle prices.
const SCALE: i128 = 10_000_000;
/// Health factor fixed point: 10_000 = 1.00.
const HF_SCALE: i128 = 10_000;
/// XLM collateral requirement = 150% of pot value.
const XLM_RATIO_NUM: i128 = 3;
const XLM_RATIO_DEN: i128 = 2;
/// Anti-sniping extension window (seconds) added when bid is placed near deadline.
const ANTI_SNIPE_EXTENSION: u64 = 60;
/// Basis points denominator (100% = 10,000 bps).
const BPS_DENOMINATOR: i128 = 10_000;

fn effective_grace(config: &GroupConfig) -> u64 {
    if config.period_length < GRACE_PERIOD {
        config.period_length
    } else {
        GRACE_PERIOD
    }
}

/// Persistent storage TTL bump settings (~30 days).
const BUMP_AMOUNT: u32 = 518_400;
const BUMP_THRESHOLD: u32 = 60_480;
/// Max overdue periods a single caller will advance per transaction.
const MAX_CATCHUP_PER_CALL: u32 = 2;
/// 48h Upgrade Timelock.
const UPGRADE_DELAY: u64 = 172_800;
/// Circular buffer history log capacity.
const MAX_HISTORY: u32 = 200;

#[contract]
pub struct GroupContract;

#[contractimpl]
impl GroupContract {
    /// Deploy-time constructor invoked dynamically by the Factory contract.
    pub fn __constructor(env: Env, p: GroupParams) {
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

        let windows = p
            .contribution_window
            .checked_add(p.settlement_window)
            .and_then(|w| w.checked_add(p.auction_window))
            .unwrap_or(u64::MAX);
        if windows >= p.period_length {
            panic_with(&env, Error::InvalidParams);
        }
        let payout_window = p.period_length - windows;
        let pot_size = p.contribution_amount * (p.target_members as i128);

        let config = GroupConfig {
            name: p.name,
            description: p.description,
            owner: p.owner.clone(),
            target_members: p.target_members,
            visibility: Visibility::from_u32(p.visibility),
            currency: CollateralAsset::from_u32(p.currency),
            category: GroupCategory::from_u32(p.category),
            period_length: p.period_length,
            contribution_window: p.contribution_window,
            settlement_window: p.settlement_window,
            auction_window: p.auction_window,
            payout_window,
            contribution_amount: p.contribution_amount,
            pot_size,
            collateral_requirement: pot_size,
            min_reputation: p.min_reputation,
            late_fee_bps: p.late_fee_bps,
            protocol_fee_bps: p.protocol_fee_bps,
            usdc: p.usdc,
            xlm: p.xlm,
            oracle: p.oracle,
            router: p.router,
            factory: p.factory,
            treasury: p.treasury,
        };

        let state = GroupState {
            status: GroupStatus::Forming,
            start_time: 0,
            current_period: 1,
            members_won: 0,
            completed_periods: 0,
            completed_at: 0,
            dissolved_at: 0,
            total_volume_distributed: 0,
            total_discounts_distributed: 0,
            total_fees_collected: 0,
        };

        let store = env.storage();
        store.instance().set(&DataKey::Config, &config);
        store.instance().set(&DataKey::State, &state);
        store
            .instance()
            .set(&DataKey::Members, &Vec::<Address>::new(&env));
        store
            .instance()
            .set(&DataKey::JoinReqList, &Vec::<Address>::new(&env));
        store
            .instance()
            .set(&DataKey::History, &Vec::<HistoryEntry>::new(&env));

        // Group founder is auto-approved
        store.persistent().set(&DataKey::Approved(p.owner), &true);
        bump_instance(&env);
    }

    // ---------------------------------------------------------------- Joining

    /// Request to join an existing group. Opens an on-chain governance vote.
    pub fn request_join(env: Env, applicant: Address) {
        applicant.require_auth();
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Forming {
            panic_with(&env, Error::NotForming);
        }
        if is_member(&env, &applicant) || is_approved(&env, &applicant) {
            panic_with(&env, Error::AlreadyMember);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::JoinReq(applicant.clone()))
        {
            panic_with(&env, Error::AlreadyRequested);
        }
        let members = get_members(&env);
        if members.len() >= config.target_members {
            panic_with(&env, Error::GroupFull);
        }

        // Check factory reputation score gate
        if config.min_reputation > 0 {
            let rep = query_reputation(&env, &config.factory, &applicant);
            if rep < config.min_reputation {
                panic_with(&env, Error::ReputationTooLow);
            }
        }

        let req = JoinRequest {
            applicant: applicant.clone(),
            yes_votes: 0,
            no_votes: 0,
            voters: Vec::new(&env),
            resolved: false,
            approved: false,
            created_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::JoinReq(applicant.clone()), &req);

        let mut pending: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::JoinReqList)
            .unwrap();
        pending.push_back(applicant.clone());
        env.storage()
            .instance()
            .set(&DataKey::JoinReqList, &pending);

        log_history(
            &env,
            symbol_short!("join_req"),
            applicant.clone(),
            0,
            String::from_str(&env, "join requested"),
        );
        env.events()
            .publish((symbol_short!("join_req"),), applicant);
    }

    /// Member voting on pending join request (majority quorum).
    pub fn vote_on_join(env: Env, voter: Address, applicant: Address, approve: bool) {
        voter.require_auth();
        require_member(&env, &voter);

        let mut req: JoinRequest = env
            .storage()
            .persistent()
            .get(&DataKey::JoinReq(applicant.clone()))
            .unwrap_or_else(|| panic_with(&env, Error::NoPendingRequest));
        if req.resolved {
            panic_with(&env, Error::AlreadyResolved);
        }
        if req.voters.contains(&voter) {
            panic_with(&env, Error::AlreadyVoted);
        }
        req.voters.push_back(voter.clone());
        if approve {
            req.yes_votes += 1;
        } else {
            req.no_votes += 1;
        }

        let members = get_members(&env);
        let total = members.len();
        let majority = total / 2 + 1;

        if req.yes_votes >= majority {
            req.resolved = true;
            req.approved = true;
            env.storage()
                .persistent()
                .set(&DataKey::Approved(applicant.clone()), &true);
            remove_pending(&env, &applicant);
            log_history(
                &env,
                symbol_short!("join_ok"),
                applicant.clone(),
                0,
                String::from_str(&env, "join approved"),
            );
            env.events()
                .publish((symbol_short!("join_ok"),), applicant.clone());
        } else if req.no_votes >= majority {
            req.resolved = true;
            req.approved = false;
            remove_pending(&env, &applicant);
            log_history(
                &env,
                symbol_short!("join_no"),
                applicant.clone(),
                0,
                String::from_str(&env, "join rejected"),
            );
            env.events()
                .publish((symbol_short!("join_no"),), applicant.clone());
        }
        env.storage()
            .persistent()
            .set(&DataKey::JoinReq(applicant), &req);
    }

    /// Lock collateral in chosen asset. Required before confirmed member status.
    pub fn lock_collateral(env: Env, member: Address, asset: u32) {
        member.require_auth();
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Forming {
            panic_with(&env, Error::NotForming);
        }
        if is_member(&env, &member) {
            panic_with(&env, Error::AlreadyLocked);
        }
        if !is_approved(&env, &member) {
            panic_with(&env, Error::JoinNotApproved);
        }
        let members = get_members(&env);
        if members.len() >= config.target_members {
            panic_with(&env, Error::GroupFull);
        }
        if asset > 1 {
            panic_with(&env, Error::InvalidAsset);
        }
        if config.currency == CollateralAsset::Xlm && asset != 1 {
            panic_with(&env, Error::InvalidAsset);
        }
        let chosen = CollateralAsset::from_u32(asset);

        let (usdc_amt, xlm_amt) = if config.currency == CollateralAsset::Xlm {
            (0i128, config.collateral_requirement)
        } else {
            match chosen {
                CollateralAsset::Usdc => (config.collateral_requirement, 0i128),
                CollateralAsset::Xlm => (0i128, required_xlm(&env, &config)),
            }
        };

        if usdc_amt > 0 {
            token::TokenClient::new(&env, &config.usdc).transfer(
                &member,
                &env.current_contract_address(),
                &usdc_amt,
            );
        }
        if xlm_amt > 0 {
            token::TokenClient::new(&env, &config.xlm).transfer(
                &member,
                &env.current_contract_address(),
                &xlm_amt,
            );
        }

        let record = Member {
            addr: member.clone(),
            collateral_asset: chosen,
            collateral_usdc: usdc_amt,
            collateral_xlm: xlm_amt,
            has_won: false,
            won_period: 0,
            in_default: false,
            default_count: 0,
            removed: false,
            hf_breach_period: 0,
            joined_period: 1,
            total_contributed: 0,
            total_claimed: 0,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Member(member.clone()), &record);

        let mut members = members;
        members.push_back(member.clone());
        env.storage().instance().set(&DataKey::Members, &members);

        let logged = if usdc_amt > 0 { usdc_amt } else { xlm_amt };
        log_history(
            &env,
            symbol_short!("joined"),
            member.clone(),
            logged,
            match chosen {
                CollateralAsset::Usdc => String::from_str(&env, "collateral locked (USDC)"),
                CollateralAsset::Xlm => String::from_str(&env, "collateral locked (XLM)"),
            },
        );
        env.events()
            .publish((symbol_short!("joined"),), (member, asset, logged));

        bump_instance(&env);
        Self::maybe_start(env);
    }

    /// Safe exit during Forming stage before the circle starts.
    pub fn exit_forming(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Forming {
            panic_with(&env, Error::NotForming);
        }

        let m = get_member(&env, &member);
        if m.collateral_usdc > 0 {
            token::TokenClient::new(&env, &config.usdc).transfer(
                &env.current_contract_address(),
                &member,
                &m.collateral_usdc,
            );
        }
        if m.collateral_xlm > 0 {
            token::TokenClient::new(&env, &config.xlm).transfer(
                &env.current_contract_address(),
                &member,
                &m.collateral_xlm,
            );
        }
        // Refund period 1 contribution if already paid
        if has_contributed(&env, 1, &member) {
            token::TokenClient::new(&env, pay_token(&config)).transfer(
                &env.current_contract_address(),
                &member,
                &config.contribution_amount,
            );
            env.storage().persistent().remove(&DataKey::Contributed(1, member.clone()));
        }

        env.storage().persistent().remove(&DataKey::Member(member.clone()));
        env.storage().persistent().remove(&DataKey::Approved(member.clone()));

        let members = get_members(&env);
        let mut next = Vec::new(&env);
        for a in members.iter() {
            if a != member {
                next.push_back(a);
            }
        }
        env.storage().instance().set(&DataKey::Members, &next);

        log_history(
            &env,
            symbol_short!("exit_form"),
            member.clone(),
            0,
            String::from_str(&env, "member exited forming group"),
        );
        env.events().publish((symbol_short!("exit_form"),), member);
    }

    /// Top up collateral balance at any time before completion.
    pub fn top_up(env: Env, member: Address, asset: u32, amount: i128) {
        member.require_auth();
        require_member(&env, &member);
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status == GroupStatus::Completed || state.status == GroupStatus::EmergencyDissolved {
            panic_with(&env, Error::NotActive);
        }
        if amount <= 0 {
            panic_with(&env, Error::InvalidAmount);
        }
        if asset > 1 {
            panic_with(&env, Error::InvalidAsset);
        }
        if config.currency == CollateralAsset::Xlm && asset != 1 {
            panic_with(&env, Error::InvalidAsset);
        }
        let mut m = get_member(&env, &member);
        if m.removed {
            panic_with(&env, Error::MemberRemoved);
        }
        let token_addr = if asset == 0 { &config.usdc } else { &config.xlm };
        token::TokenClient::new(&env, token_addr).transfer(
            &member,
            &env.current_contract_address(),
            &amount,
        );
        if asset == 0 {
            m.collateral_usdc += amount;
        } else {
            m.collateral_xlm += amount;
        }

        // If breached, check if health factor is restored above 1.00
        if m.hf_breach_period != 0 {
            let price = oracle_price(&env, &config);
            if hf_of(&config, &m, price) >= HF_SCALE {
                m.hf_breach_period = 0;
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::Member(member.clone()), &m);

        log_history(
            &env,
            symbol_short!("topup"),
            member.clone(),
            amount,
            if asset == 0 {
                String::from_str(&env, "collateral topped up (USDC)")
            } else {
                String::from_str(&env, "collateral topped up (XLM)")
            },
        );
        env.events()
            .publish((symbol_short!("topup"),), (member, asset, amount));
    }

    // ------------------------------------------------------------ Contributing

    /// Pay current period's contribution in group currency.
    pub fn contribute(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        catch_up(&env);

        let config = get_config(&env);
        let state = get_state(&env);
        if state.status == GroupStatus::EmergencyDissolved {
            panic_with(&env, Error::GroupDissolved);
        }
        let mut m = get_member(&env, &member);
        if m.removed {
            panic_with(&env, Error::MemberRemoved);
        }

        let period = match state.status {
            GroupStatus::Forming => 1,
            GroupStatus::Active => {
                if current_phase(&config, &state, env.ledger().timestamp()) != Phase::Contribution {
                    panic_with(&env, Error::WrongPhase);
                }
                state.current_period
            }
            GroupStatus::Completed => panic_with(&env, Error::NotActive),
            GroupStatus::EmergencyDissolved => panic_with(&env, Error::GroupDissolved),
        };

        if has_contributed(&env, period, &member) {
            panic_with(&env, Error::AlreadyContributed);
        }

        token::TokenClient::new(&env, pay_token(&config)).transfer(
            &member,
            &env.current_contract_address(),
            &config.contribution_amount,
        );

        env.storage()
            .persistent()
            .set(&DataKey::Contributed(period, member.clone()), &true);

        m.total_contributed += config.contribution_amount;
        env.storage()
            .persistent()
            .set(&DataKey::Member(member.clone()), &m);

        // Record early contribution if paid in the first 25% of contribution window
        let now = env.ledger().timestamp();
        let p_start = config_period_start(&config, &state, period);
        if now <= p_start + (config.contribution_window / 4) {
            env.storage()
                .persistent()
                .set(&DataKey::EarlyContributor(period, member.clone()), &true);
        }

        log_history(
            &env,
            symbol_short!("contrib"),
            member.clone(),
            config.contribution_amount,
            String::from_str(&env, "contribution paid"),
        );
        env.events().publish(
            (symbol_short!("contrib"), period),
            (member, config.contribution_amount),
        );

        if state.status == GroupStatus::Forming {
            Self::maybe_start(env);
        }
    }

    // -------------------------------------------------------------- Settlement

    /// Permissionless settlement: verify contributions, execute automated collateral
    /// liquidation via Soroswap Router if defaults occurred, and finalize period pot.
    pub fn settle(env: Env) {
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Active {
            panic_with(&env, Error::NotActive);
        }
        let period = state.current_period;
        let now = env.ledger().timestamp();
        let period_start = config_period_start(&config, &state, period);
        if now < period_start + config.contribution_window {
            panic_with(&env, Error::SettlementNotOpen);
        }
        if is_settled(&env, period) {
            panic_with(&env, Error::AlreadySettled);
        }
        run_settlement(&env, &config, period);
        bump_instance(&env);
    }

    // ---------------------------------------------------------------- Auction

    /// Place a discount bid for the current period pot.
    /// Includes anti-sniping dynamic extension if placed close to window deadline.
    pub fn place_bid(env: Env, member: Address, discount: i128) {
        member.require_auth();
        require_member(&env, &member);
        catch_up(&env);

        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Active {
            panic_with(&env, Error::NotActive);
        }
        if current_phase(&config, &state, env.ledger().timestamp()) != Phase::Auction {
            panic_with(&env, Error::WrongPhase);
        }
        let record = get_member(&env, &member);
        if record.has_won {
            panic_with(&env, Error::AlreadyWon);
        }
        if record.removed {
            panic_with(&env, Error::MemberRemoved);
        }
        let period = state.current_period;
        if !is_settled(&env, period) {
            run_settlement(&env, &config, period);
            if get_member(&env, &member).removed {
                panic_with(&env, Error::MemberRemoved);
            }
        }
        if discount <= 0 || discount >= config.pot_size {
            panic_with(&env, Error::InvalidBid);
        }
        if let Some(current) = env
            .storage()
            .persistent()
            .get::<DataKey, Bid>(&DataKey::Bid(period))
        {
            if discount <= current.discount {
                panic_with(&env, Error::BidTooLow);
            }
        }

        let now = env.ledger().timestamp();
        let bid = Bid {
            bidder: member.clone(),
            discount,
            placed_at: now,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Bid(period), &bid);

        // Anti-sniping dynamic extension: if bid in the last 10% of auction window, extend by 60s
        let p_start = config_period_start(&config, &state, period);
        let normal_auction_end = p_start
            + config.contribution_window
            + config.settlement_window
            + config.auction_window;
        if now + (config.auction_window / 10) >= normal_auction_end {
            let current_ext: u64 = env
                .storage()
                .persistent()
                .get(&DataKey::AuctionExtension(period))
                .unwrap_or(0);
            if current_ext < ANTI_SNIPE_EXTENSION * 3 {
                env.storage()
                    .persistent()
                    .set(&DataKey::AuctionExtension(period), &(current_ext + ANTI_SNIPE_EXTENSION));
            }
        }

        log_history(
            &env,
            symbol_short!("bid"),
            member.clone(),
            discount,
            String::from_str(&env, "discount bid placed"),
        );
        env.events()
            .publish((symbol_short!("bid"), period), (member, discount));
    }

    /// Resolve the auction and distribute payout and discount dividends.
    pub fn resolve_period(env: Env) {
        let state = get_state(&env);
        if state.status != GroupStatus::Active {
            panic_with(&env, Error::NotActive);
        }
        if !resolve_due(&env, &get_config(&env), &state) {
            panic_with(&env, Error::PeriodNotEnded);
        }
        resolve_one(&env);
    }

    // ------------------------------------------------------------- Withdrawals

    /// Claim accrued payout + discount dividends from protocol to member wallet.
    pub fn claim_payout(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        catch_up(&env);

        let config = get_config(&env);
        let mut amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Claimable(member.clone()))
            .unwrap_or(0);

        amount = settle_debt(&env, &member, amount);
        if amount <= 0 {
            panic_with(&env, Error::NothingToClaim);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Claimable(member.clone()), &0i128);

        let mut m = get_member(&env, &member);
        m.total_claimed += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Member(member.clone()), &m);

        token::TokenClient::new(&env, pay_token(&config)).transfer(
            &env.current_contract_address(),
            &member,
            &amount,
        );
        env.events()
            .publish((symbol_short!("claim"),), (member, amount));
    }

    /// Withdraw locked collateral after cycle completion and grace period.
    pub fn withdraw_collateral(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        catch_up(&env);

        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Completed && state.status != GroupStatus::EmergencyDissolved {
            panic_with(&env, Error::NotCompleted);
        }
        if state.status == GroupStatus::Completed
            && env.ledger().timestamp() < state.completed_at + effective_grace(&config)
        {
            panic_with(&env, Error::GracePeriodActive);
        }

        let mut m = get_member(&env, &member);
        let mut usdc_amt = m.collateral_usdc;
        let mut xlm_amt = m.collateral_xlm;

        if config.currency == CollateralAsset::Xlm {
            xlm_amt = settle_debt(&env, &member, xlm_amt);
        } else {
            usdc_amt = settle_debt(&env, &member, usdc_amt);
        }

        if usdc_amt <= 0 && xlm_amt <= 0 {
            panic_with(&env, Error::NothingToClaim);
        }

        m.collateral_usdc = 0;
        m.collateral_xlm = 0;
        env.storage()
            .persistent()
            .set(&DataKey::Member(member.clone()), &m);

        if usdc_amt > 0 {
            token::TokenClient::new(&env, &config.usdc).transfer(
                &env.current_contract_address(),
                &member,
                &usdc_amt,
            );
        }
        if xlm_amt > 0 {
            token::TokenClient::new(&env, &config.xlm).transfer(
                &env.current_contract_address(),
                &member,
                &xlm_amt,
            );
        }

        log_history(
            &env,
            symbol_short!("withdraw"),
            member.clone(),
            usdc_amt,
            String::from_str(&env, "collateral withdrawn"),
        );
        env.events()
            .publish((symbol_short!("withdraw"),), (member, usdc_amt, xlm_amt));
    }

    // ------------------------------------------------- Emergency Dissolution

    /// Propose early dissolution of the ROSCA group.
    pub fn propose_dissolution(env: Env, proposer: Address) {
        proposer.require_auth();
        require_member(&env, &proposer);
        let state = get_state(&env);
        if state.status == GroupStatus::Completed || state.status == GroupStatus::EmergencyDissolved {
            panic_with(&env, Error::NotActive);
        }
        if env.storage().instance().has(&DataKey::Dissolution) {
            panic_with(&env, Error::ProposalActive);
        }

        let mut voters = Vec::new(&env);
        voters.push_back(proposer.clone());
        let proposal = DissolutionProposal {
            proposer: proposer.clone(),
            votes_count: 1,
            voters,
            passed: false,
            created_at: env.ledger().timestamp(),
        };
        env.storage().instance().set(&DataKey::Dissolution, &proposal);

        log_history(
            &env,
            symbol_short!("diss_prop"),
            proposer.clone(),
            0,
            String::from_str(&env, "emergency dissolution proposed"),
        );
        env.events()
            .publish((symbol_short!("diss_prop"),), proposer);
    }

    /// Vote on emergency dissolution (2/3 supermajority required).
    pub fn vote_on_dissolution(env: Env, voter: Address) {
        voter.require_auth();
        require_member(&env, &voter);

        let mut prop: DissolutionProposal = env
            .storage()
            .instance()
            .get(&DataKey::Dissolution)
            .unwrap_or_else(|| panic_with(&env, Error::NoActiveProposal));
        if prop.passed {
            panic_with(&env, Error::AlreadyResolved);
        }
        if prop.voters.contains(&voter) {
            panic_with(&env, Error::AlreadyVoted);
        }

        prop.voters.push_back(voter.clone());
        prop.votes_count += 1;

        let members = get_members(&env);
        let total = members.len();
        // Supermajority: at least 2/3 of members, rounded up.
        //
        // Must be a ceiling, not `(total * 2) / 3 + 1`: that form demands
        // unanimity whenever the member count divides by 3 (3 members needed
        // 3 votes, not 2), which would let a single hold-out block a
        // dissolution the supermajority had already agreed to.
        //
        //   total=3 -> 2    total=4 -> 3    total=5 -> 4    total=6 -> 4
        let threshold = (total * 2).div_ceil(3);

        if prop.votes_count >= threshold {
            prop.passed = true;
            let mut state = get_state(&env);
            state.status = GroupStatus::EmergencyDissolved;
            state.dissolved_at = env.ledger().timestamp();
            env.storage().instance().set(&DataKey::State, &state);

            log_history(
                &env,
                symbol_short!("dissolved"),
                voter.clone(),
                0,
                String::from_str(&env, "group emergency dissolved by supermajority"),
            );
            env.events()
                .publish((symbol_short!("dissolved"),), state.dissolved_at);
        }
        env.storage().instance().set(&DataKey::Dissolution, &prop);
    }

    // ---------------------------------------------------------------- Internal

    fn maybe_start(env: Env) {
        let config = get_config(&env);
        let mut state = get_state(&env);
        if state.status != GroupStatus::Forming {
            return;
        }
        let members = get_members(&env);
        if members.len() != config.target_members {
            return;
        }
        for addr in members.iter() {
            if !has_contributed(&env, 1, &addr) {
                return;
            }
            let m = get_member(&env, &addr);
            if m.collateral_usdc <= 0 && m.collateral_xlm <= 0 {
                return;
            }
        }
        state.status = GroupStatus::Active;
        state.start_time = env.ledger().timestamp();
        state.current_period = 1;
        env.storage().instance().set(&DataKey::State, &state);

        log_history(
            &env,
            symbol_short!("started"),
            config.owner.clone(),
            0,
            String::from_str(&env, "group started"),
        );
        env.events()
            .publish((symbol_short!("started"),), state.start_time);
    }

    // ---------------------------------------------------------------- Upgrade

    pub fn propose_upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        require_factory_admin(&env);
        let ready_at = env.ledger().timestamp() + UPGRADE_DELAY;
        env.storage()
            .instance()
            .set(&DataKey::PendingUpgrade, &(new_wasm_hash.clone(), ready_at));
        env.events()
            .publish((symbol_short!("up_prop"),), (new_wasm_hash, ready_at));
    }

    pub fn cancel_upgrade(env: Env) {
        require_factory_admin(&env);
        env.storage().instance().remove(&DataKey::PendingUpgrade);
        env.events().publish((symbol_short!("up_cancel"),), ());
    }

    pub fn pending_upgrade(env: Env) -> Option<(BytesN<32>, u64)> {
        env.storage().instance().get(&DataKey::PendingUpgrade)
    }

    pub fn apply_upgrade(env: Env) {
        require_factory_admin(&env);
        let (hash, ready_at): (BytesN<32>, u64) = match env
            .storage()
            .instance()
            .get(&DataKey::PendingUpgrade)
        {
            Some(p) => p,
            None => panic_with(&env, Error::NoPendingUpgrade),
        };
        if env.ledger().timestamp() < ready_at {
            panic_with(&env, Error::TimelockActive);
        }
        env.storage().instance().remove(&DataKey::PendingUpgrade);
        env.deployer().update_current_contract_wasm(hash.clone());
        env.events().publish((symbol_short!("upgraded"),), hash);
    }

    // ------------------------------------------------------------------- Views

    pub fn get_config(env: Env) -> GroupConfig {
        get_config(&env)
    }

    pub fn get_state(env: Env) -> GroupState {
        get_state(&env)
    }

    pub fn get_members(env: Env) -> Vec<Member> {
        let mut out = Vec::new(&env);
        for addr in get_members(&env).iter() {
            out.push_back(get_member(&env, &addr));
        }
        out
    }

    pub fn get_member_info(env: Env, member: Address) -> Member {
        get_member(&env, &member)
    }

    pub fn get_phase(env: Env) -> Phase {
        let config = get_config(&env);
        let state = get_state(&env);
        current_phase(&config, &state, env.ledger().timestamp())
    }

    pub fn get_claimable(env: Env, member: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Claimable(member))
            .unwrap_or(0)
    }

    pub fn get_current_bid(env: Env) -> Option<Bid> {
        let state = get_state(&env);
        env.storage()
            .persistent()
            .get(&DataKey::Bid(state.current_period))
    }

    pub fn get_join_request(env: Env, applicant: Address) -> Option<JoinRequest> {
        env.storage().persistent().get(&DataKey::JoinReq(applicant))
    }

    pub fn get_pending_joins(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::JoinReqList)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_history(env: Env) -> Vec<HistoryEntry> {
        env.storage()
            .instance()
            .get(&DataKey::History)
            .unwrap_or(Vec::new(&env))
    }

    pub fn get_period_metrics(env: Env, period: u32) -> Option<PeriodMetrics> {
        env.storage().persistent().get(&DataKey::PeriodMetric(period))
    }

    pub fn get_dissolution_proposal(env: Env) -> Option<DissolutionProposal> {
        env.storage().instance().get(&DataKey::Dissolution)
    }

    pub fn has_won(env: Env, member: Address) -> bool {
        get_member(&env, &member).has_won
    }

    pub fn is_completed(env: Env) -> bool {
        get_state(&env).status == GroupStatus::Completed
    }

    pub fn get_settled(env: Env, period: u32) -> bool {
        is_settled(&env, period)
    }

    pub fn get_pot(env: Env, period: u32) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Pot(period))
            .unwrap_or(0)
    }

    pub fn health_factor(env: Env, member: Address) -> Option<u32> {
        let config = get_config(&env);
        let m = get_member(&env, &member);
        if m.collateral_asset == config.currency {
            return None;
        }
        let price = oracle_price(&env, &config);
        let hf = hf_of(&config, &m, price);
        Some(if hf > u32::MAX as i128 {
            u32::MAX
        } else {
            hf as u32
        })
    }

    pub fn required_collateral(env: Env, asset: u32) -> i128 {
        let config = get_config(&env);
        if config.currency == CollateralAsset::Xlm {
            if asset != 1 {
                panic_with(&env, Error::InvalidAsset);
            }
            return config.collateral_requirement;
        }
        match CollateralAsset::from_u32(asset) {
            CollateralAsset::Usdc => config.collateral_requirement,
            CollateralAsset::Xlm => required_xlm(&env, &config),
        }
    }

    pub fn collateral_unlock_at(env: Env) -> u64 {
        let config = get_config(&env);
        let state = get_state(&env);
        let base = if state.completed_at > 0 {
            state.completed_at
        } else if state.start_time > 0 {
            state.start_time + (config.target_members as u64) * config.period_length
        } else {
            return 0;
        };
        base + effective_grace(&config)
    }

    pub fn graduates(env: Env) -> Vec<Address> {
        let mut out = Vec::new(&env);
        if get_state(&env).status != GroupStatus::Completed {
            return out;
        }
        for addr in get_members(&env).iter() {
            let m = get_member(&env, &addr);
            if !m.in_default && !m.removed {
                out.push_back(addr);
            }
        }
        out
    }

    pub fn total_volume(env: Env) -> i128 {
        get_state(&env).total_volume_distributed
    }

    pub fn total_discounts(env: Env) -> i128 {
        get_state(&env).total_discounts_distributed
    }
}

// ===================================================================== helpers

fn get_config(env: &Env) -> GroupConfig {
    env.storage().instance().get(&DataKey::Config).unwrap()
}
fn get_state(env: &Env) -> GroupState {
    env.storage().instance().get(&DataKey::State).unwrap()
}
fn get_members(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Members)
        .unwrap_or(Vec::new(env))
}
fn get_member(env: &Env, addr: &Address) -> Member {
    env.storage()
        .persistent()
        .get(&DataKey::Member(addr.clone()))
        .unwrap_or_else(|| panic_with(env, Error::NotMember))
}
fn is_member(env: &Env, addr: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Member(addr.clone()))
}
fn is_approved(env: &Env, addr: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Approved(addr.clone()))
        .unwrap_or(false)
}
fn require_member(env: &Env, addr: &Address) {
    if !is_member(env, addr) {
        panic_with(env, Error::NotMember);
    }
}
fn pay_token(config: &GroupConfig) -> &Address {
    match config.currency {
        CollateralAsset::Usdc => &config.usdc,
        CollateralAsset::Xlm => &config.xlm,
    }
}
fn has_contributed(env: &Env, period: u32, addr: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Contributed(period, addr.clone()))
        .unwrap_or(false)
}
fn is_settled(env: &Env, period: u32) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Settled(period))
        .unwrap_or(false)
}

fn credit(env: &Env, addr: &Address, amount: i128) {
    if amount == 0 {
        return;
    }
    let bal: i128 = env
        .storage()
        .persistent()
        .get(&DataKey::Claimable(addr.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Claimable(addr.clone()), &(bal + amount));
}

fn settle_debt(env: &Env, addr: &Address, amount: i128) -> i128 {
    let debt: i128 = env
        .storage()
        .persistent()
        .get(&DataKey::Debt(addr.clone()))
        .unwrap_or(0);
    if debt <= 0 || amount <= 0 {
        return amount;
    }
    if amount >= debt {
        env.storage()
            .persistent()
            .set(&DataKey::Debt(addr.clone()), &0i128);
        amount - debt
    } else {
        env.storage()
            .persistent()
            .set(&DataKey::Debt(addr.clone()), &(debt - amount));
        0
    }
}

fn add_debt(env: &Env, addr: &Address, amount: i128) {
    if amount <= 0 {
        return;
    }
    let debt: i128 = env
        .storage()
        .persistent()
        .get(&DataKey::Debt(addr.clone()))
        .unwrap_or(0);
    env.storage()
        .persistent()
        .set(&DataKey::Debt(addr.clone()), &(debt + amount));
}

fn config_period_start(config: &GroupConfig, state: &GroupState, period: u32) -> u64 {
    state.start_time + ((period - 1) as u64) * config.period_length
}

fn current_phase(config: &GroupConfig, state: &GroupState, now: u64) -> Phase {
    if state.status != GroupStatus::Active {
        return Phase::Contribution;
    }
    let start = config_period_start(config, state, state.current_period);
    if now < start {
        return Phase::Contribution;
    }
    let into = now - start;
    if into < config.contribution_window {
        Phase::Contribution
    } else if into < config.contribution_window + config.settlement_window {
        Phase::Settlement
    } else if into
        < config.contribution_window + config.settlement_window + config.auction_window
    {
        Phase::Auction
    } else {
        Phase::Payout
    }
}

// --------------------------------------------------------- collateral & price

fn oracle_price(env: &Env, config: &GroupConfig) -> i128 {
    let price: i128 = env.invoke_contract(&config.oracle, &symbol_short!("price"), Vec::new(env));
    if price <= 0 {
        panic_with(env, Error::InvalidParams);
    }
    price
}

fn try_oracle_price(env: &Env, config: &GroupConfig) -> Option<i128> {
    match env.try_invoke_contract::<i128, soroban_sdk::Error>(
        &config.oracle,
        &symbol_short!("price"),
        Vec::new(env),
    ) {
        Ok(Ok(p)) if p > 0 => Some(p),
        _ => None,
    }
}

fn xlm_required_value(config: &GroupConfig) -> i128 {
    config.pot_size * XLM_RATIO_NUM / XLM_RATIO_DEN
}

fn required_xlm(env: &Env, config: &GroupConfig) -> i128 {
    let price = oracle_price(env, config);
    ceil_div(xlm_required_value(config) * SCALE, price)
}

fn collateral_value(m: &Member, price: i128) -> i128 {
    m.collateral_usdc + m.collateral_xlm * price / SCALE
}

fn hf_of(config: &GroupConfig, m: &Member, price: i128) -> i128 {
    let required = match m.collateral_asset {
        CollateralAsset::Usdc => config.collateral_requirement,
        CollateralAsset::Xlm => xlm_required_value(config),
    };
    if required <= 0 {
        return i128::MAX;
    }
    collateral_value(m, price) * HF_SCALE / required
}

// ------------------------------------------------------------------- swapping

fn authorize_router_pull(env: &Env, config: &GroupConfig, spender: &Address, xlm_in: i128) {
    env.authorize_as_current_contract(vec![
        env,
        InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: config.xlm.clone(),
                fn_name: Symbol::new(env, "transfer"),
                args: (env.current_contract_address(), spender.clone(), xlm_in).into_val(env),
            },
            sub_invocations: Vec::new(env),
        }),
    ]);
}

fn swap_deadline(env: &Env) -> u64 {
    env.ledger().timestamp() + SWAP_DEADLINE_WINDOW
}

fn router_pair(env: &Env, config: &GroupConfig) -> Option<Address> {
    let args: Vec<Val> = vec![
        env,
        config.xlm.clone().into_val(env),
        config.usdc.clone().into_val(env),
    ];
    match env.try_invoke_contract::<Address, soroban_sdk::Error>(
        &config.router,
        &Symbol::new(env, "router_pair_for"),
        args,
    ) {
        Ok(Ok(pair)) => Some(pair),
        _ => None,
    }
}

fn quote_xlm_in(env: &Env, config: &GroupConfig, usdc_out: i128) -> Option<i128> {
    let path = vec![env, config.xlm.clone(), config.usdc.clone()];
    let args: Vec<Val> = vec![env, usdc_out.into_val(env), path.into_val(env)];
    match env.try_invoke_contract::<Vec<i128>, soroban_sdk::Error>(
        &config.router,
        &Symbol::new(env, "router_get_amounts_in"),
        args,
    ) {
        Ok(Ok(amounts)) => amounts.get(0),
        _ => None,
    }
}

fn swap_xlm_for_exact_usdc(
    env: &Env,
    config: &GroupConfig,
    usdc_out: i128,
    xlm_max: i128,
) -> Option<i128> {
    if usdc_out <= 0 || xlm_max <= 0 {
        return None;
    }
    let pair = router_pair(env, config)?;
    let xlm_in = quote_xlm_in(env, config, usdc_out)?;
    if xlm_in <= 0 || xlm_in > xlm_max {
        return None;
    }
    authorize_router_pull(env, config, &pair, xlm_in);
    let path = vec![env, config.xlm.clone(), config.usdc.clone()];
    let args: Vec<Val> = vec![
        env,
        usdc_out.into_val(env),
        xlm_in.into_val(env),
        path.into_val(env),
        env.current_contract_address().into_val(env),
        swap_deadline(env).into_val(env),
    ];
    match env.try_invoke_contract::<Vec<i128>, soroban_sdk::Error>(
        &config.router,
        &Symbol::new(env, "swap_tokens_for_exact_tokens"),
        args,
    ) {
        Ok(Ok(res)) => res.get(0),
        _ => None,
    }
}

fn swap_exact_xlm_for_usdc(env: &Env, config: &GroupConfig, xlm_in: i128) -> Option<i128> {
    if xlm_in <= 0 {
        return None;
    }
    let pair = router_pair(env, config)?;
    authorize_router_pull(env, config, &pair, xlm_in);
    let path = vec![env, config.xlm.clone(), config.usdc.clone()];
    let args: Vec<Val> = vec![
        env,
        xlm_in.into_val(env),
        0i128.into_val(env),
        path.into_val(env),
        env.current_contract_address().into_val(env),
        swap_deadline(env).into_val(env),
    ];
    match env.try_invoke_contract::<Vec<i128>, soroban_sdk::Error>(
        &config.router,
        &Symbol::new(env, "swap_exact_tokens_for_tokens"),
        args,
    ) {
        Ok(Ok(res)) => res.get(1),
        _ => None,
    }
}

// ----------------------------------------------------------------- settlement

fn run_settlement(env: &Env, config: &GroupConfig, period: u32) {
    let price = if config.currency == CollateralAsset::Usdc {
        try_oracle_price(env, config)
    } else {
        None
    };
    let mut pot: i128 = 0;
    let mut defaults_count = 0u32;

    for addr in get_members(env).iter() {
        let mut m = get_member(env, &addr);
        let mut dirty = false;

        if has_contributed(env, period, &addr) {
            pot += config.contribution_amount;
        } else {
            defaults_count += 1;
            let mut need = config.contribution_amount;

            // 1. Deduct same-currency collateral bucket
            let bucket = if config.currency == CollateralAsset::Xlm {
                m.collateral_xlm
            } else {
                m.collateral_usdc
            };
            let use_same = if bucket >= need { need } else { bucket };
            if use_same > 0 {
                if config.currency == CollateralAsset::Xlm {
                    m.collateral_xlm -= use_same;
                } else {
                    m.collateral_usdc -= use_same;
                }
                pot += use_same;
                need -= use_same;
            }

            // 2. Cross-asset liquidation via Soroswap Router if USDC group
            if config.currency == CollateralAsset::Usdc && need > 0 && m.collateral_xlm > 0 {
                if let Some(xlm_spent) = swap_xlm_for_exact_usdc(env, config, need, m.collateral_xlm)
                {
                    m.collateral_xlm -= xlm_spent;
                    pot += need;
                    log_history(
                        env,
                        symbol_short!("liquid"),
                        addr.clone(),
                        need,
                        String::from_str(env, "XLM liquidated via router to cover contribution"),
                    );
                    env.events().publish(
                        (symbol_short!("liquid"), period),
                        (addr.clone(), xlm_spent, need),
                    );
                    need = 0;
                } else if let Some(out) = swap_exact_xlm_for_usdc(env, config, m.collateral_xlm) {
                    let xlm_all = m.collateral_xlm;
                    m.collateral_xlm = 0;
                    let applied = if out >= need { need } else { out };
                    pot += applied;
                    if out > applied {
                        m.collateral_usdc += out - applied;
                    }
                    need -= applied;
                    log_history(
                        env,
                        symbol_short!("liquid"),
                        addr.clone(),
                        applied,
                        String::from_str(env, "all XLM liquidated to cover contribution"),
                    );
                    env.events().publish(
                        (symbol_short!("liquid"), period),
                        (addr.clone(), xlm_all, applied),
                    );
                }
            }

            // 3. Outstanding uncovered amount converts to member debt
            if need > 0 {
                add_debt(env, &addr, need);
            }
            m.in_default = true;
            m.default_count += 1;
            dirty = true;

            log_history(
                env,
                symbol_short!("default"),
                addr.clone(),
                config.contribution_amount - need,
                String::from_str(env, "contribution covered by collateral"),
            );
            env.events().publish(
                (symbol_short!("default"), period),
                (addr.clone(), config.contribution_amount - need),
            );
        }

        // Health factor risk check
        if config.currency == CollateralAsset::Usdc
            && !m.removed
            && m.collateral_asset == CollateralAsset::Xlm
            && price.is_some()
        {
            let hf = hf_of(config, &m, price.unwrap());
            if hf < HF_SCALE {
                if m.hf_breach_period == 0 {
                    m.hf_breach_period = period;
                    dirty = true;
                    log_history(
                        env,
                        symbol_short!("hf_warn"),
                        addr.clone(),
                        hf,
                        String::from_str(env, "health factor below 1.0 - top up collateral"),
                    );
                    env.events()
                        .publish((symbol_short!("hf_warn"), period), (addr.clone(), hf as u32));
                } else if period > m.hf_breach_period {
                    let liquidated = if m.collateral_xlm > 0 {
                        match swap_exact_xlm_for_usdc(env, config, m.collateral_xlm) {
                            Some(out) => {
                                m.collateral_usdc += out;
                                m.collateral_xlm = 0;
                                true
                            }
                            None => false,
                        }
                    } else {
                        true
                    };
                    if liquidated {
                        m.removed = true;
                        dirty = true;
                        log_history(
                            env,
                            symbol_short!("removed"),
                            addr.clone(),
                            m.collateral_usdc,
                            String::from_str(env, "removed - collateral not restored in time"),
                        );
                        env.events()
                            .publish((symbol_short!("removed"), period), addr.clone());
                    }
                }
            } else if m.hf_breach_period != 0 {
                m.hf_breach_period = 0;
                dirty = true;
            }
        }

        if dirty || !has_contributed(env, period, &addr) {
            env.storage()
                .persistent()
                .set(&DataKey::Member(addr.clone()), &m);
        }
    }

    env.storage().persistent().set(&DataKey::Settled(period), &true);
    env.storage().persistent().set(&DataKey::Pot(period), &pot);

    log_history(
        env,
        symbol_short!("settled"),
        config.owner.clone(),
        pot,
        String::from_str(env, "settlement complete - pool finalized"),
    );
    env.events()
        .publish((symbol_short!("settled"), period), (pot, defaults_count));
}

fn remove_pending(env: &Env, applicant: &Address) {
    let pending: Vec<Address> = env
        .storage()
        .instance()
        .get(&DataKey::JoinReqList)
        .unwrap_or(Vec::new(env));
    let mut next = Vec::new(env);
    for a in pending.iter() {
        if &a != applicant {
            next.push_back(a);
        }
    }
    env.storage().instance().set(&DataKey::JoinReqList, &next);
}

fn log_history(env: &Env, kind: Symbol, actor: Address, amount: i128, detail: String) {
    let state = get_state(env);
    let mut history: Vec<HistoryEntry> = env
        .storage()
        .instance()
        .get(&DataKey::History)
        .unwrap_or(Vec::new(env));
    history.push_back(HistoryEntry {
        period: state.current_period,
        timestamp: env.ledger().timestamp(),
        kind,
        actor,
        amount,
        detail,
    });
    while history.len() > MAX_HISTORY {
        history.remove(0);
    }
    env.storage().instance().set(&DataKey::History, &history);
}

fn query_reputation(env: &Env, factory: &Address, addr: &Address) -> u32 {
    let args = vec![env, addr.to_val()];
    env.invoke_contract(factory, &symbol_short!("rep_of"), args)
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
}

fn ceil_div(a: i128, b: i128) -> i128 {
    (a + b - 1) / b
}

fn panic_with(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}

fn resolve_due(env: &Env, config: &GroupConfig, state: &GroupState) -> bool {
    let period_start = config_period_start(config, state, state.current_period);
    let extension: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::AuctionExtension(state.current_period))
        .unwrap_or(0);
    let auction_end = period_start
        + config.contribution_window
        + config.settlement_window
        + config.auction_window
        + extension;
    env.ledger().timestamp() >= auction_end
}

fn catch_up(env: &Env) {
    for _ in 0..MAX_CATCHUP_PER_CALL {
        let state = get_state(env);
        if state.status != GroupStatus::Active {
            return;
        }
        if !resolve_due(env, &get_config(env), &state) {
            return;
        }
        resolve_one(env);
    }
}

fn resolve_one(env: &Env) {
    let config = get_config(env);
    let mut state = get_state(env);
    let period = state.current_period;
    let now = env.ledger().timestamp();

    if !is_settled(env, period) {
        run_settlement(env, &config, period);
    }

    let pot_collected: i128 = env
        .storage()
        .persistent()
        .get(&DataKey::Pot(period))
        .unwrap_or(0);

    let members = get_members(env);
    let mut active: Vec<Address> = Vec::new(env);
    let mut eligible: Vec<Address> = Vec::new(env);
    for addr in members.iter() {
        let m = get_member(env, &addr);
        if m.removed {
            continue;
        }
        active.push_back(addr.clone());
        if !m.has_won {
            eligible.push_back(addr.clone());
        }
    }

    if eligible.is_empty() {
        let n = active.len() as i128;
        if n > 0 {
            let share = pot_collected / n;
            for addr in active.iter() {
                credit(env, &addr, share);
            }
        }
        state.completed_periods += 1;
        state.status = GroupStatus::Completed;
        state.completed_at = now;
        env.storage().instance().set(&DataKey::State, &state);
        env.events()
            .publish((symbol_short!("resolved"), period), pot_collected);
        bump_instance(env);
        return;
    }

    // 1. Determine winner
    let (winner, discount, method) = match env
        .storage()
        .persistent()
        .get::<DataKey, Bid>(&DataKey::Bid(period))
    {
        Some(bid) => (bid.bidder, bid.discount, symbol_short!("auction")),
        None => (eligible.get(0).unwrap(), 0i128, symbol_short!("rotate")),
    };

    // 2. Calculate protocol fee (if configured)
    let protocol_fee = if config.protocol_fee_bps > 0 {
        (pot_collected * (config.protocol_fee_bps as i128)) / BPS_DENOMINATOR
    } else {
        0i128
    };

    if protocol_fee > 0 {
        credit(env, &config.treasury, protocol_fee);
        state.total_fees_collected += protocol_fee;
    }

    // 3. Pay the winner net of discount and protocol fee
    let payout = pot_collected - discount - protocol_fee;
    credit(env, &winner, payout);

    let mut wrec = get_member(env, &winner);
    wrec.has_won = true;
    wrec.won_period = period;
    env.storage()
        .persistent()
        .set(&DataKey::Member(winner.clone()), &wrec);
    state.members_won += 1;
    state.total_volume_distributed += payout;

    // 4. Split discount dividend equally among ALL members (winner included)
    if discount > 0 {
        let n = active.len() as i128;
        let share = discount / n;
        if share > 0 {
            for addr in active.iter() {
                credit(env, &addr, share);
            }
        }
        let dust = discount - share * n;
        if dust > 0 {
            credit(env, &winner, dust);
        }
        state.total_discounts_distributed += discount;
    }

    // 5. Record period summary metrics
    let metrics = PeriodMetrics {
        period,
        pot_collected,
        winner: winner.clone(),
        payout_amount: payout,
        discount_split: discount,
        protocol_fee,
        defaults_count: 0,
        settled_at: now,
        resolved_at: now,
    };
    env.storage().persistent().set(&DataKey::PeriodMetric(period), &metrics);

    // 6. Advance clock or complete cycle
    state.completed_periods += 1;
    log_history(
        env,
        symbol_short!("resolved"),
        winner.clone(),
        payout,
        String::from_str(env, "period resolved and pot distributed"),
    );
    env.events().publish(
        (symbol_short!("resolved"), period),
        (winner, payout, discount, method),
    );

    if eligible.len() <= 1 {
        state.status = GroupStatus::Completed;
        state.completed_at = now;
    } else {
        state.current_period += 1;
    }

    env.storage().instance().set(&DataKey::State, &state);
    bump_instance(env);
}

fn require_factory_admin(env: &Env) {
    let config = get_config(env);
    let admin: Address = env.invoke_contract(&config.factory, &symbol_short!("admin"), vec![env]);
    admin.require_auth();
}
