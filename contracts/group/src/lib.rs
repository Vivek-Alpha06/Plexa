#![no_std]
//! Plexa Group contract — one deployed instance per ROSCA group.
//!
//! Implements the rotating savings mechanic described in the Plexa spec:
//! deposit-triggered auto-start, FOUR-window periods (contribution /
//! settlement / auction / payout), open descending-discount auctions with a
//! rotation no-bid fallback, multi-collateral (USDC at 100% of pot or XLM at
//! 150%, priced by an oracle), health-factor monitoring with a one-cycle
//! top-up grace, automatic liquidation of missed contributions through a
//! Soroswap-compatible router, and post-cycle collateral withdrawal.
//!
//! ## Settlement window
//! Between Contribution and Auction. `settle()` (permissionless; auto-run by
//! `place_bid`/`resolve_period` if nobody called it) verifies contributions,
//! liquidates unpaid members' collateral (swapping XLM→USDC through the
//! router when needed), finalizes the period's pot, recalculates health
//! factors and flags/removes members whose XLM collateral stayed unhealthy
//! for a full cycle. The auction therefore always starts from a full pool.
//!
//! ## Discount distribution
//! The winner's discount is split equally among ALL members — including the
//! winner (integer-division dust goes to the winner).

mod types;
#[cfg(test)]
mod test;

pub use types::*;

use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractimpl, symbol_short, token, vec, Address, BytesN, Env, IntoVal, String, Symbol, Val,
    Vec,
};

/// Max settlement grace after the cycle completes. The effective grace adapts
/// to the group's cadence — min(24h, one period) — so short test groups aren't
/// locked for a day while real groups keep 24h.
const GRACE_PERIOD: u64 = 86_400;
/// Margin added to `now` for the router's swap deadline (see `swap_deadline`).
const SWAP_DEADLINE_WINDOW: u64 = 300;
/// 7-decimal fixed point shared by USDC, XLM and the oracle price.
const SCALE: i128 = 10_000_000;
/// Health factor fixed point: 10_000 = 1.00.
const HF_SCALE: i128 = 10_000;
/// XLM collateral requirement = 150% of pot value.
const XLM_RATIO_NUM: i128 = 3;
const XLM_RATIO_DEN: i128 = 2;

fn effective_grace(config: &GroupConfig) -> u64 {
    if config.period_length < GRACE_PERIOD {
        config.period_length
    } else {
        GRACE_PERIOD
    }
}
/// TTL bump (~30 days of ledgers) applied to long-lived persistent state.
const BUMP_AMOUNT: u32 = 518_400;
const BUMP_THRESHOLD: u32 = 60_480;
/// How many overdue periods a single member action will advance before giving
/// up. Keeps a long keeper outage from making every member action too large to
/// fit in a transaction — the remainder is handled by the next call.
const MAX_CATCHUP_PER_CALL: u32 = 2;
/// Delay between scheduling a code upgrade and being able to apply it. Members
/// must have a window to see the proposal on-chain and exit before new logic
/// takes custody of their funds.
const UPGRADE_DELAY: u64 = 172_800; // 48h
/// Cap on the on-chain history log. Events remain the complete, permanent
/// record; this Vec is a convenience for the UI and previously grew without
/// bound, so a long-running group would eventually be unable to write to it.
const MAX_HISTORY: u32 = 200;

#[contract]
pub struct GroupContract;

#[contractimpl]
impl GroupContract {
    /// Deploy-time constructor. Called by the factory with all params bundled
    /// in `GroupParams`. All amounts are in the group currency (i128, 7dp).
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
        // Payout window is derived, never set directly. The settlement window
        // is creator-configurable for development; production pins it.
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
            period_length: p.period_length,
            contribution_window: p.contribution_window,
            settlement_window: p.settlement_window,
            auction_window: p.auction_window,
            payout_window,
            contribution_amount: p.contribution_amount,
            pot_size,
            collateral_requirement: pot_size, // same-asset option: flat 100% of pot
            min_reputation: p.min_reputation,
            usdc: p.usdc,
            xlm: p.xlm,
            oracle: p.oracle,
            router: p.router,
            factory: p.factory,
        };

        let state = GroupState {
            status: GroupStatus::Forming,
            start_time: 0,
            current_period: 1,
            members_won: 0,
            completed_periods: 0,
            completed_at: 0,
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

        // The owner is auto-approved as the founding member (no governance vote).
        store.persistent().set(&DataKey::Approved(p.owner), &true);
    }

    // ---------------------------------------------------------------- Joining

    /// Request to join an existing group. Opens a governance vote.
    pub fn request_join(env: Env, applicant: Address) {
        applicant.require_auth();
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status == GroupStatus::Completed {
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
        // Reputation gate. 0 disables the check.
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

    /// A confirmed member votes on a pending join request. Majority of confirmed
    /// members approves. Each member votes once.
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
        // Resolve as soon as an outcome is mathematically decided.
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

    /// Lock collateral in the chosen asset. Required before a member is
    /// confirmed and counts toward Target Members.
    /// USDC groups — `asset`: 0 = USDC (100% of pot), 1 = XLM (150% of pot
    /// worth of XLM at the current oracle price — the contract sizes it).
    /// XLM groups — `asset` must be 1 (XLM at 100% of pot, no oracle risk).
    /// The owner may call this directly; everyone else must be approved first.
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
        // XLM groups take same-asset collateral only (no cross-asset option).
        if config.currency == CollateralAsset::Xlm && asset != 1 {
            panic_with(&env, Error::InvalidAsset);
        }
        let chosen = CollateralAsset::from_u32(asset);

        let (usdc_amt, xlm_amt) = if config.currency == CollateralAsset::Xlm {
            // Same-asset: flat 100% of pot, in XLM.
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
            in_default: false,
            removed: false,
            hf_breach_period: 0,
            joined_period: 1,
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

    /// Add collateral at any time before completion. Accepted in either asset
    /// regardless of the original choice — the top-up path XLM-collateral
    /// members use to restore their health factor.
    pub fn top_up(env: Env, member: Address, asset: u32, amount: i128) {
        member.require_auth();
        require_member(&env, &member);
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status == GroupStatus::Completed {
            panic_with(&env, Error::NotActive);
        }
        if amount <= 0 {
            panic_with(&env, Error::InvalidAmount);
        }
        if asset > 1 {
            panic_with(&env, Error::InvalidAsset);
        }
        // XLM groups hold XLM collateral only.
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
        // Restored above water? Clear the breach flag immediately.
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

    /// Pay this period's contribution in the group currency. During Forming this funds period 1
    /// (and is one of the auto-start preconditions). While Active it must land in
    /// the current period's contribution window.
    pub fn contribute(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        // Close out any overdue periods first, so this payment lands in the
        // period that is genuinely open rather than one that already expired.
        catch_up(&env);
        let config = get_config(&env);
        let state = get_state(&env);
        if get_member(&env, &member).removed {
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

    /// Execute the settlement for the current period: verify contributions,
    /// liquidate unpaid members' collateral (USDC bucket first, then swap only
    /// the necessary XLM through the router), finalize the pot, recalculate
    /// health factors and enforce the one-cycle top-up rule. Permissionless —
    /// anyone (a keeper, or the first member online) may call it. Idempotent
    /// per period: second calls panic with `AlreadySettled`.
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

    /// Place an open bid: the discount (in the group currency) the bidder gives up from their
    /// payout to win this period. Highest discount leads. Only members who have
    /// not yet won (and were not removed) may bid, during the auction window.
    pub fn place_bid(env: Env, member: Address, discount: i128) {
        member.require_auth();
        require_member(&env, &member);
        // Overdue periods close before the bid is read, so a bid can never be
        // applied to a period whose auction has already ended.
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
        // The auction may only run on a finalized pool. If nobody called
        // settle() during the settlement window, the first bid triggers it.
        if !is_settled(&env, period) {
            run_settlement(&env, &config, period);
            // Settlement may have removed this very bidder.
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
        let bid = Bid {
            bidder: member.clone(),
            discount,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Bid(period), &bid);

        log_history(
            &env,
            symbol_short!("bid"),
            member.clone(),
            discount,
            String::from_str(&env, "bid placed"),
        );
        env.events()
            .publish((symbol_short!("bid"), period), (member, discount));
    }

    /// Resolve the current period once its auction window has closed: pick the
    /// winner (top bid, else random fallback) from the settled pool, split the
    /// discount equally among ALL members (winner included), advance the clock.
    /// Permissionless — anyone (e.g. a keeper) may call it.
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

    /// Claim accrued payout + bonus balance from the dashboard to the wallet.
    pub fn claim_payout(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        // Any member action advances the group, so a payout that only needs an
        // overdue period closed becomes claimable in this same transaction.
        catch_up(&env);
        let config = get_config(&env);
        let mut amount: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Claimable(member.clone()))
            .unwrap_or(0);
        // Net off any outstanding default debt first.
        amount = settle_debt(&env, &member, amount);
        if amount <= 0 {
            panic_with(&env, Error::NothingToClaim);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Claimable(member.clone()), &0i128);
        token::TokenClient::new(&env, pay_token(&config)).transfer(
            &env.current_contract_address(),
            &member,
            &amount,
        );
        env.events()
            .publish((symbol_short!("claim"),), (member, amount));
    }

    /// Withdraw remaining locked collateral (both buckets) after the cycle
    /// completes and the settlement grace elapses.
    pub fn withdraw_collateral(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        // Critical for the endgame: on the final periods nobody needs to
        // contribute any more, so without this there would be no member action
        // left to advance the group. If the keeper stopped there, the cycle
        // could never reach Completed and everyone's collateral would be locked
        // permanently. Catching up here means members can always release their
        // own funds unaided.
        catch_up(&env);
        let config = get_config(&env);
        let state = get_state(&env);
        if state.status != GroupStatus::Completed {
            panic_with(&env, Error::NotCompleted);
        }
        if env.ledger().timestamp() < state.completed_at + effective_grace(&config) {
            panic_with(&env, Error::GracePeriodActive);
        }
        let mut m = get_member(&env, &member);
        let mut usdc_amt = m.collateral_usdc;
        let mut xlm_amt = m.collateral_xlm;
        // Net outstanding debt from the bucket denominated in the group
        // currency (debt units == group currency units).
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

    // ---------------------------------------------------------------- Internal

    /// Auto-start check: fires when member count == target, all have locked
    /// collateral, and all have paid period 1's contribution.
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

    /// Schedule a code replacement. Takes effect no earlier than
    /// `UPGRADE_DELAY` later, via `apply_upgrade`.
    ///
    /// An upgrade can rewrite the logic guarding member collateral and the pot,
    /// so it must never be instantaneous: members need a window in which they
    /// can see the proposal on-chain and exit before it lands. The delay is the
    /// difference between an upgrade mechanism and a rug.
    pub fn propose_upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        require_factory_admin(&env);
        let ready_at = env.ledger().timestamp() + UPGRADE_DELAY;
        env.storage()
            .instance()
            .set(&DataKey::PendingUpgrade, &(new_wasm_hash.clone(), ready_at));
        env.events()
            .publish((symbol_short!("up_prop"),), (new_wasm_hash, ready_at));
    }

    /// Abandon a scheduled upgrade.
    pub fn cancel_upgrade(env: Env) {
        require_factory_admin(&env);
        env.storage().instance().remove(&DataKey::PendingUpgrade);
        env.events().publish((symbol_short!("up_cancel"),), ());
    }

    /// The scheduled upgrade and the earliest timestamp it may be applied.
    pub fn pending_upgrade(env: Env) -> Option<(BytesN<32>, u64)> {
        env.storage().instance().get(&DataKey::PendingUpgrade)
    }

    /// Apply a previously scheduled upgrade once its timelock has elapsed.
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
    /// Current phase + 1-indexed period (only meaningful while Active).
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
    pub fn has_won(env: Env, member: Address) -> bool {
        get_member(&env, &member).has_won
    }
    pub fn is_completed(env: Env) -> bool {
        get_state(&env).status == GroupStatus::Completed
    }
    /// Whether the given period's settlement has been executed.
    pub fn get_settled(env: Env, period: u32) -> bool {
        is_settled(&env, period)
    }
    /// Finalized contribution pool for a settled period (0 if not settled).
    pub fn get_pot(env: Env, period: u32) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Pot(period))
            .unwrap_or(0)
    }
    /// Health factor for a member, 10_000 = 1.00. `None` when the collateral
    /// matches the group currency (no market risk, HF does not apply) — that
    /// covers USDC collateral in USDC groups and every member of XLM groups.
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
    /// Token amount a joiner must lock right now for the given asset choice.
    /// USDC groups: 0 = USDC (100% of pot), 1 = XLM sized by the live oracle
    /// price (150%). XLM groups: only 1 is valid — flat 100% of pot in XLM.
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
    /// Unix ts collateral becomes withdrawable. While the cycle is still
    /// running this is a best-effort estimate from the nominal schedule; once
    /// Completed it is exact (completed_at + grace). The UI reads THIS instead
    /// of re-deriving the grace rule (Bug 1 fix).
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
    /// Members who finished the cycle without ever defaulting — the input the
    /// factory uses to bump reputation (primitive return keeps the crates decoupled).
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
/// Token contract contributions/payouts/claims flow through — the group currency.
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

/// Net an outgoing amount against any recorded default debt, reducing the debt.
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

/// Live oracle price: USDC (7dp) per 1 XLM.
fn oracle_price(env: &Env, config: &GroupConfig) -> i128 {
    let price: i128 = env.invoke_contract(&config.oracle, &symbol_short!("price"), Vec::new(env));
    if price <= 0 {
        panic_with(env, Error::InvalidParams);
    }
    price
}

/// Oracle read that tolerates the feed being down.
///
/// The oracle deliberately panics on stale or missing data instead of guessing.
/// Anything sizing collateral should propagate that (see `oracle_price`), but
/// settlement must keep closing periods and paying members through a feed
/// outage, so it uses this and skips the advisory risk pass instead.
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

/// USDC value the XLM option must cover: 150% of pot.
fn xlm_required_value(config: &GroupConfig) -> i128 {
    config.pot_size * XLM_RATIO_NUM / XLM_RATIO_DEN
}

/// XLM amount worth 150% of pot at the live oracle price (rounded up).
fn required_xlm(env: &Env, config: &GroupConfig) -> i128 {
    let price = oracle_price(env, config);
    ceil_div(xlm_required_value(config) * SCALE, price)
}

/// USDC value of a member's combined collateral at the given price.
fn collateral_value(m: &Member, price: i128) -> i128 {
    m.collateral_usdc + m.collateral_xlm * price / SCALE
}

/// Health factor (10_000 = 1.00) of a member against their option's requirement.
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

/// Pre-authorize the router's pull of exactly `xlm_in` from this contract.
///
/// Soroban matches authorizations on the *exact* argument list, and a
/// Soroswap-style router moves the input token straight from `to` into the
/// **pair** contract — not into the router itself. So `spender` must be the
/// pair, and `xlm_in` must be the amount the router will actually pull (see
/// `quote_xlm_in`); approving a different amount, even a larger one, does not
/// authorize the transfer.
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

/// Deadline to hand the router. Soroswap rejects `now >= deadline` outright, so
/// a `0` sentinel reads as *already expired* and every swap fails. The swap
/// settles inside this same transaction, so any future stamp does; this is just
/// a safe margin.
fn swap_deadline(env: &Env) -> u64 {
    env.ledger().timestamp() + SWAP_DEADLINE_WINDOW
}

/// The XLM/USDC pair the router pulls the input token into. `None` if the
/// router has no such pair (nothing to liquidate through).
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

/// Ask the router how much XLM it will take for exactly `usdc_out` USDC.
///
/// The price comes from the venue's own reserves, not our oracle — an AMM
/// quotes off `x * y = k` plus its fee, so an oracle-derived guess would not
/// match what it actually pulls. Reserves cannot move inside our transaction,
/// so this quote is exact for the swap that immediately follows it.
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

/// Buy exactly `usdc_out` USDC, spending at most `xlm_max` XLM. Returns the XLM
/// spent, or `None` if the venue cannot fill it (no pair, quote failed, price
/// moved, or `xlm_max` doesn't cover the quote). Never traps: a liquidation
/// venue that is unavailable must not be able to revert the whole period.
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
        return None; // collateral can't cover it — caller sells the bucket instead
    }
    authorize_router_pull(env, config, &pair, xlm_in);
    let path = vec![env, config.xlm.clone(), config.usdc.clone()];
    let args: Vec<Val> = vec![
        env,
        usdc_out.into_val(env),
        // amount_in_max == the amount authorized: the router cannot pull more.
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

/// Sell exactly `xlm_in` XLM for whatever USDC it fetches. Returns the USDC
/// received, or `None` if the venue cannot fill it. Never traps.
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

/// The settlement engine (see `settle`). Runs at most once per period.
fn run_settlement(env: &Env, config: &GroupConfig, period: u32) {
    // XLM groups never touch the oracle or the router: collateral is the same
    // asset as the pot, so defaults are covered by a plain bucket transfer.
    //
    // Read fallibly. The Reflector-backed oracle refuses stale or missing data
    // rather than returning a guess, which is right for collateral sizing but
    // must not be fatal here: settlement moves real funds and closes the
    // period, and the price is only used for the advisory health-factor pass
    // below. A feed outage must delay risk checks, never block members from
    // being paid — the same reasoning as degrading a dry swap venue to debt.
    let price = if config.currency == CollateralAsset::Usdc {
        try_oracle_price(env, config)
    } else {
        None
    };
    let mut pot: i128 = 0;

    for addr in get_members(env).iter() {
        let mut m = get_member(env, &addr);
        let mut dirty = false;

        if has_contributed(env, period, &addr) {
            pot += config.contribution_amount;
        } else {
            // Missed contribution — cover it from collateral automatically.
            let mut need = config.contribution_amount;

            // 1. Same-currency bucket first (no swap required).
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

            // 2. USDC groups only: swap the necessary XLM into USDC through
            //    the router. (XLM groups hold no cross-asset collateral.)
            //    Both calls return None rather than trapping, so a venue that
            //    is dry or missing leaves `need` outstanding — it becomes debt
            //    in step 3 and the period still closes. Settlement must never
            //    be blocked by an external market.
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
                        String::from_str(env, "XLM liquidated to cover contribution"),
                    );
                    env.events().publish(
                        (symbol_short!("liquid"), period),
                        (addr.clone(), xlm_spent, need),
                    );
                    need = 0;
                } else if let Some(out) = swap_exact_xlm_for_usdc(env, config, m.collateral_xlm) {
                    // The bucket couldn't buy the exact amount: sell all of it
                    // for whatever it fetches and let the rest become debt.
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
                // else: venue unavailable — collateral untouched, `need` → debt.
            }

            // 3. Anything still uncovered becomes debt (netted from future
            //    claims). The group continues.
            if need > 0 {
                add_debt(env, &addr, need);
            }
            m.in_default = true;
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

        // Health-factor pass for cross-asset (XLM in a USDC group) collateral
        // members still in the group. Same-asset collateral carries no market
        // risk, so XLM groups skip this entirely.
        // Skipped entirely when the feed is unavailable: with no trustworthy
        // price there is no basis to declare anyone unhealthy, and guessing
        // would liquidate members on bad data.
        if config.currency == CollateralAsset::Usdc
            && !m.removed
            && m.collateral_asset == CollateralAsset::Xlm
            && price.is_some()
        {
            let hf = hf_of(config, &m, price.unwrap());
            if hf < HF_SCALE {
                if m.hf_breach_period == 0 {
                    // First breach: warn. One full contribution cycle to top up.
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
                    // Breach persisted past the top-up cycle: remove the member
                    // and liquidate remaining XLM into USDC. The USDC bucket
                    // keeps funding their future contributions; any leftover is
                    // withdrawable after the cycle completes.
                    //
                    // Only remove once the XLM is actually converted, so
                    // `removed` always implies "liquidated". If the venue is
                    // unavailable the member stays in and we retry next period,
                    // rather than stranding their collateral in the wrong asset.
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
                m.hf_breach_period = 0; // restored (e.g. price recovered)
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
        .publish((symbol_short!("settled"), period), pot);
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
    // Drop the oldest entries past the cap. Unbounded growth would eventually
    // make every state-changing call too large to fit in a transaction, which
    // would brick the group; the emitted events are the durable record and are
    // unaffected.
    while history.len() > MAX_HISTORY {
        history.remove(0);
    }
    env.storage().instance().set(&DataKey::History, &history);
}

/// Cross-contract reputation lookup against the factory registry.
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

/// Is the current period past its auction close, i.e. ready to resolve?
fn resolve_due(env: &Env, config: &GroupConfig, state: &GroupState) -> bool {
    let period_start = config_period_start(config, state, state.current_period);
    let auction_end = period_start
        + config.contribution_window
        + config.settlement_window
        + config.auction_window;
    env.ledger().timestamp() >= auction_end
}

/// Advance any periods whose auction window has already closed.
///
/// This is what keeps the keeper an *optimisation* rather than a dependency.
/// Period advancement is a state change, so somebody must submit a transaction
/// for it; a keeper does that promptly, but if it stops, the group would
/// otherwise freeze and members' funds with it. Folding catch-up into the
/// ordinary member actions means the group always makes progress as soon as
/// anyone touches it, keeper or not.
///
/// Bounded per call: after a long outage the backlog could otherwise exceed the
/// transaction budget and every member action would fail — turning a stalled
/// group into a permanently bricked one. Whatever is left over is picked up by
/// the next caller or the keeper.
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

/// Resolve the current period: settle if needed, pick the winner, pay out,
/// split the discount and advance the clock.
///
/// Callers must confirm the group is Active and the auction window has closed
/// (`resolve_due`) before invoking this — it performs no timing checks itself
/// so `catch_up` can drive it in a loop.
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
        let mut active: Vec<Address> = Vec::new(env); // not removed
        let mut eligible: Vec<Address> = Vec::new(env); // not removed, not yet won
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

        // Degenerate edge: settlement removed the last not-yet-won member(s).
        // Nobody can win this pot — split it equally among remaining members
        // and complete the cycle.
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

        // 1. Determine the winner.
        let (winner, discount, method) = match env
            .storage()
            .persistent()
            .get::<DataKey, Bid>(&DataKey::Bid(period))
        {
            Some(bid) => (bid.bidder, bid.discount, symbol_short!("auction")),
            None => {
                // No-bid fallback: plain rotation — the eligible member who has
                // been waiting longest wins. `eligible` is built by iterating
                // `get_members()`, which preserves join order, so element 0 is
                // the earliest joiner who has not yet won.
                //
                // This used to draw with `env.prng()`, which was wrong twice
                // over. The PRNG is seeded per-transaction, so preflight and
                // execution could pick *different* members; simulation declared
                // only the winner it drew, and execution writing a different
                // key trapped the host — a group could wedge permanently. And
                // because simulation reveals the winner before submission,
                // whoever submits could preview the outcome and only broadcast
                // when it favoured them.
                //
                // Randomness bought nothing here: every member wins exactly
                // once regardless, so the fallback only decides *order*. A fixed
                // rotation is fairer, fully predictable, cheaper, and leaves
                // nothing to manipulate.
                (eligible.get(0).unwrap(), 0i128, symbol_short!("rotate"))
            }
        };

        // 2. Pay the winner (claimable, not auto-transferred).
        let payout = pot_collected - discount;
        credit(env, &winner, payout);
        let mut wrec = get_member(env, &winner);
        wrec.has_won = true;
        env.storage()
            .persistent()
            .set(&DataKey::Member(winner.clone()), &wrec);
        state.members_won += 1;

        // 3. Split the discount equally among ALL members, winner included
        //    (Bug 2 fix). Dust from integer division goes to the winner.
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
        }

        // 4. Advance the clock / finish the cycle.
        state.completed_periods += 1;
        log_history(
            env,
            symbol_short!("resolved"),
            winner.clone(),
            payout,
            String::from_str(env, "period resolved"),
        );
        env.events().publish(
            (symbol_short!("resolved"), period),
            (winner, payout, method),
        );

        // Complete once every remaining (non-removed) member has won.
        if eligible.len() <= 1 {
            state.status = GroupStatus::Completed;
            state.completed_at = now;
        } else {
            state.current_period += 1;
        }
        env.storage().instance().set(&DataKey::State, &state);
        bump_instance(env);
}

/// Authorize against the factory's admin, read live so `Factory::set_admin`
/// rotation takes effect immediately.
///
/// Deliberately not the group owner: a group custodies its members' collateral
/// and pot, so letting whoever created it change the code would let them drain
/// it. Note this trusts `config.factory` — consumers must confirm a group is
/// registered in the official factory (`Factory::is_group`) before treating it
/// as trustworthy, since anyone can deploy this wasm pointing at a factory they
/// control.
fn require_factory_admin(env: &Env) {
    let config = get_config(env);
    let admin: Address = env.invoke_contract(&config.factory, &symbol_short!("admin"), vec![env]);
    admin.require_auth();
}
