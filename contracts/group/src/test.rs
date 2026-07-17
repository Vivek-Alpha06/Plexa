#![cfg(test)]
use crate::{
    CollateralAsset, Error, GroupContract, GroupContractClient, GroupParams, GroupStatus, Phase,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String,
};

const USDC: i128 = 10_000_000; // 1 USDC at 7 decimals
const XLM: i128 = 10_000_000; // 1 XLM at 7 decimals
const CONTRIB: i128 = 10 * USDC;
const PRICE_HALF: i128 = 5_000_000; // 0.50 USDC per XLM

// ------------------------------------------------------------- mock contracts
// Minimal in-crate mirrors of the plexa-oracle / plexa-swap contracts so the
// group's cross-contract calls run against real logic without a crate dep.
// Each lives in its own module so their generated `__constructor` contract-spec
// symbols don't collide.

const SCALE: i128 = 10_000_000;

mod mock_oracle {
    use soroban_sdk::{contract, contractimpl, contracttype, Env};

    #[contracttype]
    #[derive(Clone)]
    pub enum OKey {
        Price,
    }

    #[contract]
    pub struct MockOracle;
    #[contractimpl]
    impl MockOracle {
        pub fn __constructor(env: Env, price: i128) {
            env.storage().instance().set(&OKey::Price, &price);
        }
        pub fn set_price(env: Env, price: i128) {
            env.storage().instance().set(&OKey::Price, &price);
        }
        pub fn price(env: Env) -> i128 {
            env.storage().instance().get(&OKey::Price).unwrap()
        }
    }
}

mod mock_router {
    use super::SCALE;
    use soroban_sdk::{
        contract, contractimpl, contracttype, symbol_short, token, vec, Address, Env, Vec,
    };

    #[contracttype]
    #[derive(Clone)]
    pub enum RKey {
        Oracle,
        Xlm,
        Usdc,
    }

    #[contract]
    pub struct MockRouter;
    #[contractimpl]
    impl MockRouter {
        pub fn __constructor(env: Env, oracle: Address, xlm: Address, usdc: Address) {
            let s = env.storage().instance();
            s.set(&RKey::Oracle, &oracle);
            s.set(&RKey::Xlm, &xlm);
            s.set(&RKey::Usdc, &usdc);
        }
        fn read_price(env: &Env) -> i128 {
            let oracle: Address = env.storage().instance().get(&RKey::Oracle).unwrap();
            env.invoke_contract(&oracle, &symbol_short!("price"), Vec::new(env))
        }
        fn tokens(env: &Env) -> (Address, Address) {
            (
                env.storage().instance().get(&RKey::Xlm).unwrap(),
                env.storage().instance().get(&RKey::Usdc).unwrap(),
            )
        }
        /// The group quotes the router before authorizing its pull, so this must
        /// agree exactly with `swap_tokens_for_exact_tokens` below.
        pub fn router_get_amounts_in(env: Env, amount_out: i128, _path: Vec<Address>) -> Vec<i128> {
            let price = Self::read_price(&env);
            vec![&env, (amount_out * SCALE + price - 1) / price, amount_out]
        }
        /// This mock fills from its own reserve, so it is its own pair.
        pub fn router_pair_for(env: Env, _token_a: Address, _token_b: Address) -> Address {
            env.current_contract_address()
        }
        /// Soroswap's rule: `now >= deadline` is expired. Enforced here so the
        /// tests reject a stale/sentinel deadline exactly like the real router.
        fn check_deadline(env: &Env, deadline: u64) {
            assert!(env.ledger().timestamp() < deadline, "deadline expired");
        }
        pub fn swap_tokens_for_exact_tokens(
            env: Env,
            amount_out: i128,
            amount_in_max: i128,
            _path: Vec<Address>,
            to: Address,
            deadline: u64,
        ) -> Vec<i128> {
            Self::check_deadline(&env, deadline);
            let price = Self::read_price(&env);
            let amount_in = (amount_out * SCALE + price - 1) / price;
            assert!(amount_in <= amount_in_max, "excessive input");
            let (xlm, usdc) = Self::tokens(&env);
            let this = env.current_contract_address();
            token::TokenClient::new(&env, &xlm).transfer(&to, &this, &amount_in);
            token::TokenClient::new(&env, &usdc).transfer(&this, &to, &amount_out);
            vec![&env, amount_in, amount_out]
        }
        pub fn swap_exact_tokens_for_tokens(
            env: Env,
            amount_in: i128,
            amount_out_min: i128,
            _path: Vec<Address>,
            to: Address,
            deadline: u64,
        ) -> Vec<i128> {
            Self::check_deadline(&env, deadline);
            let price = Self::read_price(&env);
            let amount_out = amount_in * price / SCALE;
            assert!(amount_out >= amount_out_min, "insufficient output");
            let (xlm, usdc) = Self::tokens(&env);
            let this = env.current_contract_address();
            token::TokenClient::new(&env, &xlm).transfer(&to, &this, &amount_in);
            token::TokenClient::new(&env, &usdc).transfer(&this, &to, &amount_out);
            vec![&env, amount_in, amount_out]
        }
    }
}

use mock_oracle::{MockOracle, MockOracleClient};
use mock_router::MockRouter;

// -------------------------------------------------------------------- fixture

struct Setup {
    env: Env,
    client: GroupContractClient<'static>,
    usdc: TokenClient<'static>,
    xlm: TokenClient<'static>,
    oracle: Address,
    router: Address,
    members: [Address; 3],
}

/// target=3, period=1000s (contribution 300 / settlement 200 / auction 200 /
/// payout 300 derived), contribution=10 USDC, XLM at 0.50 USDC.
fn setup() -> Setup {
    setup_with_currency(0)
}

/// Same fixture but with the group currency selectable (0 = USDC, 1 = XLM).
fn setup_with_currency(currency: u32) -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let usdc_sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let xlm_sac = env.register_stellar_asset_contract_v2(token_admin);
    let usdc_id = usdc_sac.address();
    let xlm_id = xlm_sac.address();
    let usdc_mint = StellarAssetClient::new(&env, &usdc_id);
    let xlm_mint = StellarAssetClient::new(&env, &xlm_id);

    let oracle = env.register(MockOracle, (PRICE_HALF,));
    let router = env.register(MockRouter, (oracle.clone(), xlm_id.clone(), usdc_id.clone()));
    // Router liquidity so liquidation swaps can be filled.
    usdc_mint.mint(&router, &(10_000 * USDC));

    let owner = Address::generate(&env);
    let m2 = Address::generate(&env);
    let m3 = Address::generate(&env);
    let members = [owner.clone(), m2.clone(), m3.clone()];
    for m in members.iter() {
        usdc_mint.mint(m, &(500 * USDC));
        xlm_mint.mint(m, &(1_000 * XLM));
    }

    let factory = Address::generate(&env);
    let params = GroupParams {
        owner: owner.clone(),
        name: String::from_str(&env, "Test ROSCA"),
        description: String::from_str(&env, "desc"),
        target_members: 3,
        visibility: 0,
        currency,
        period_length: 1000,
        contribution_window: 300,
        settlement_window: 200,
        auction_window: 200,
        contribution_amount: CONTRIB,
        min_reputation: 0,
        usdc: usdc_id.clone(),
        xlm: xlm_id.clone(),
        oracle: oracle.clone(),
        router: router.clone(),
        factory,
    };
    let group_id = env.register(GroupContract, (params,));
    let client = GroupContractClient::new(&env, &group_id);
    let usdc = TokenClient::new(&env, &usdc_id);
    let xlm = TokenClient::new(&env, &xlm_id);
    Setup {
        env,
        client,
        usdc,
        xlm,
        oracle,
        router,
        members,
    }
}

/// Drive a member through approval (if needed), collateral lock (asset 0 =
/// USDC, 1 = XLM) and first contribution.
fn onboard(s: &Setup, idx: usize, asset: u32) {
    let m = &s.members[idx];
    if idx != 0 {
        s.client.request_join(m);
        for i in 0..idx {
            s.client.vote_on_join(&s.members[i], m, &true);
        }
    }
    s.client.lock_collateral(m, &asset);
    s.client.contribute(m);
}

fn at(s: &Setup, t: u64) {
    s.env.ledger().with_mut(|l| l.timestamp = t);
}

// ----------------------------------------------------------------------- tests

#[test]
fn four_phase_clock() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    onboard(&s, 2, 0);
    assert_eq!(s.client.get_state().status, GroupStatus::Active);

    at(&s, 100);
    assert_eq!(s.client.get_phase(), Phase::Contribution);
    at(&s, 350);
    assert_eq!(s.client.get_phase(), Phase::Settlement);
    at(&s, 550);
    assert_eq!(s.client.get_phase(), Phase::Auction);
    at(&s, 750);
    assert_eq!(s.client.get_phase(), Phase::Payout);
}

#[test]
fn full_cycle_discount_split_all_members() {
    let s = setup();
    let collateral = 3 * CONTRIB; // pot = 30 USDC

    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    onboard(&s, 2, 0); // third member completes the group -> auto-start

    // Each member paid collateral (30) + contribution (10) = 40 USDC.
    assert_eq!(
        s.usdc.balance(&s.members[0]),
        500 * USDC - collateral - CONTRIB
    );

    // Settlement window: anyone settles; pot is finalized at 30.
    at(&s, 350);
    s.client.settle();
    assert!(s.client.get_settled(&1));
    assert_eq!(s.client.get_pot(&1), 3 * CONTRIB);

    // Auction window: two competing bids.
    at(&s, 550);
    s.client.place_bid(&s.members[1], &(3 * USDC));
    s.client.place_bid(&s.members[2], &(6 * USDC)); // higher discount leads
    assert_eq!(s.client.get_current_bid().unwrap().bidder, s.members[2]);

    at(&s, 720);
    s.client.resolve_period();

    // Winner m3: payout = pot(30) - discount(6) = 24 USDC.
    // Discount 6 split among ALL THREE members = 2 USDC each (Bug 2 fix):
    // m3 gets 24 + 2 = 26, m1 and m2 get 2 each.
    assert!(s.client.has_won(&s.members[2]));
    assert_eq!(s.client.get_claimable(&s.members[2]), 26 * USDC);
    assert_eq!(s.client.get_claimable(&s.members[0]), 2 * USDC);
    assert_eq!(s.client.get_claimable(&s.members[1]), 2 * USDC);

    let state = s.client.get_state();
    assert_eq!(state.current_period, 2);
    assert_eq!(state.members_won, 1);
}

#[test]
fn winner_cannot_bid_again() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    onboard(&s, 2, 0);

    at(&s, 550);
    s.client.place_bid(&s.members[1], &(2 * USDC));
    at(&s, 720);
    s.client.resolve_period(); // m2 wins period 1

    // Period 2: everyone contributes; the previous winner tries to bid.
    at(&s, 1100);
    for m in s.members.iter() {
        s.client.contribute(m);
    }
    at(&s, 1550); // period 2 auction window
    let res = s.client.try_place_bid(&s.members[1], &(2 * USDC));
    assert_eq!(
        res,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::AlreadyWon as u32
        )))
    );
    // A member who hasn't won can still bid.
    s.client.place_bid(&s.members[0], &(2 * USDC));
}

#[test]
fn no_bid_random_fallback_auto_settles() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    onboard(&s, 2, 0);

    // Nobody calls settle() and nobody bids: resolve runs the settlement
    // safety-net itself and picks a random winner of the full pot.
    at(&s, 720);
    s.client.resolve_period();
    assert!(s.client.get_settled(&1));

    let total: i128 = (0..3).map(|i| s.client.get_claimable(&s.members[i])).sum();
    assert_eq!(total, 3 * CONTRIB);
    assert_eq!(s.client.get_state().members_won, 1);
}

#[test]
fn missed_contribution_covered_from_usdc_collateral() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    onboard(&s, 2, 0);

    at(&s, 720);
    s.client.resolve_period();

    // Period 2: only member 0 pays.
    at(&s, 1100);
    s.client.contribute(&s.members[0]);

    at(&s, 1400); // settlement window of period 2
    s.client.settle();

    // Pot still full: misses covered from USDC collateral.
    assert_eq!(s.client.get_pot(&2), 3 * CONTRIB);
    let members = s.client.get_members();
    let defaulters: soroban_sdk::Vec<crate::Member> = members;
    let mut count = 0;
    for m in defaulters.iter() {
        if m.in_default {
            count += 1;
            assert_eq!(m.collateral_usdc, 3 * CONTRIB - CONTRIB);
        }
    }
    assert_eq!(count, 2);
}

#[test]
fn xlm_collateral_lock_and_liquidation() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    // Member 3 locks XLM: 150% of 30 USDC pot = 45 USDC = 90 XLM at 0.50.
    let m3 = &s.members[2];
    s.client.request_join(m3);
    s.client.vote_on_join(&s.members[0], m3, &true);
    s.client.vote_on_join(&s.members[1], m3, &true);
    assert_eq!(s.client.required_collateral(&1), 90 * XLM);
    s.client.lock_collateral(m3, &1);
    assert_eq!(s.xlm.balance(m3), 1_000 * XLM - 90 * XLM);
    s.client.contribute(m3);
    assert_eq!(s.client.get_state().status, GroupStatus::Active);
    // Healthy at lock: HF == 1.0 (10_000).
    assert_eq!(s.client.health_factor(m3), Some(10_000));
    // USDC members have no HF.
    assert_eq!(s.client.health_factor(&s.members[0]), None);

    at(&s, 720);
    s.client.resolve_period();

    // Period 2: m3 misses the contribution.
    at(&s, 1100);
    s.client.contribute(&s.members[0]);
    s.client.contribute(&s.members[1]);

    at(&s, 1400);
    s.client.settle();

    // 10 USDC needed → 20 XLM swapped. Pot still full.
    assert_eq!(s.client.get_pot(&2), 3 * CONTRIB);
    let m = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == m3)
        .unwrap();
    assert_eq!(m.collateral_asset, CollateralAsset::Xlm);
    assert_eq!(m.collateral_xlm, 70 * XLM);
    assert!(m.in_default);
    // Value dropped to 35 USDC < 45 required → HF breach recorded.
    assert_eq!(m.hf_breach_period, 2);
    assert_eq!(s.client.health_factor(m3), Some(7_777)); // 35/45 = 0.7777…
}

#[test]
fn top_up_restores_health_factor() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    let m3 = &s.members[2];
    s.client.request_join(m3);
    s.client.vote_on_join(&s.members[0], m3, &true);
    s.client.vote_on_join(&s.members[1], m3, &true);
    s.client.lock_collateral(m3, &1);
    s.client.contribute(m3);

    // Price halves: 90 XLM now worth 22.5 USDC vs 45 required.
    MockOracleClient::new(&s.env, &s.oracle).set_price(&(PRICE_HALF / 2));
    assert_eq!(s.client.health_factor(m3), Some(5_000));

    // Settlement flags the breach even though m3 contributed.
    at(&s, 350);
    s.client.settle();
    let rec = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == m3)
        .unwrap();
    assert_eq!(rec.hf_breach_period, 1);

    // Top up with USDC (mixed collateral allowed): need 22.5 more USDC value.
    s.client.top_up(m3, &0, &(23 * USDC));
    let rec = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == m3)
        .unwrap();
    assert_eq!(rec.hf_breach_period, 0); // restored
    assert!(s.client.health_factor(m3).unwrap() >= 10_000);
}

#[test]
fn unhealthy_member_removed_after_one_cycle() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    let m3 = &s.members[2];
    s.client.request_join(m3);
    s.client.vote_on_join(&s.members[0], m3, &true);
    s.client.vote_on_join(&s.members[1], m3, &true);
    s.client.lock_collateral(m3, &1); // 90 XLM
    s.client.contribute(m3);

    // Crash the price; period-1 settlement warns (breach period 1).
    MockOracleClient::new(&s.env, &s.oracle).set_price(&(PRICE_HALF / 2));
    at(&s, 350);
    s.client.settle();
    // Pin the period-1 winner to m3 so the later winner order is deterministic.
    at(&s, 550);
    s.client.place_bid(m3, &USDC);
    at(&s, 720);
    s.client.resolve_period();

    // m3 never tops up. Period 2 settlement removes them and liquidates.
    at(&s, 1100);
    for m in s.members.iter() {
        s.client.contribute(&m);
    }
    at(&s, 1400);
    s.client.settle();

    let rec = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == m3)
        .unwrap();
    assert!(rec.removed);
    assert_eq!(rec.collateral_xlm, 0); // fully liquidated…
    assert!(rec.collateral_usdc > 0); // …into a USDC bucket

    at(&s, 1720);
    s.client.resolve_period(); // period 2: one of m0/m1 wins

    // Removed members cannot contribute or bid.
    at(&s, 2100);
    assert!(s.client.try_contribute(m3).is_err());

    // Their future contributions are auto-funded from the liquidated bucket.
    s.client.contribute(&s.members[0]);
    s.client.contribute(&s.members[1]);
    at(&s, 2400);
    s.client.settle();
    assert_eq!(s.client.get_pot(&3), 3 * CONTRIB);

    // Last eligible member wins period 3 and the cycle completes.
    at(&s, 2720);
    s.client.resolve_period();
    assert_eq!(s.client.get_state().status, GroupStatus::Completed);
}

#[test]
fn completes_and_collateral_withdraw_after_grace() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    onboard(&s, 2, 0);

    // Three periods, no bids → three random winners.
    at(&s, 720);
    s.client.resolve_period();
    at(&s, 1100);
    for m in s.members.iter() {
        s.client.contribute(&m);
    }
    at(&s, 1720);
    s.client.resolve_period();
    at(&s, 2100);
    for m in s.members.iter() {
        s.client.contribute(&m);
    }
    at(&s, 2720);
    s.client.resolve_period();

    let state = s.client.get_state();
    assert_eq!(state.status, GroupStatus::Completed);
    assert_eq!(state.completed_at, 2720);
    // Unlock time is exact and exposed to the UI (Bug 1 fix):
    // completed_at + min(24h, period=1000s) = 2720 + 1000.
    assert_eq!(s.client.collateral_unlock_at(), 3720);

    // Too early → GracePeriodActive.
    let res = s.client.try_withdraw_collateral(&s.members[0]);
    assert_eq!(
        res,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::GracePeriodActive as u32
        )))
    );

    // After the grace: everyone gets their full USDC collateral back.
    at(&s, 3721);
    for m in s.members.iter() {
        let before = s.usdc.balance(&m);
        s.client.withdraw_collateral(&m);
        assert_eq!(s.usdc.balance(&m), before + 3 * CONTRIB);
    }

    // Everyone contributed every period and won once: claims total 90 USDC.
    for m in s.members.iter() {
        s.client.claim_payout(&m);
    }
    // Group is fully drained — no stranded funds.
    assert_eq!(s.usdc.balance(&s.client.address), 0);
}

#[test]
fn xlm_group_full_cycle_in_xlm() {
    let s = setup_with_currency(1);
    let collateral = 3 * CONTRIB; // 100% of pot, in XLM

    // USDC collateral is rejected in an XLM group; requirement is flat 100%.
    let res = s.client.try_lock_collateral(&s.members[0], &0);
    assert_eq!(
        res,
        Err(Ok(soroban_sdk::Error::from_contract_error(
            Error::InvalidAsset as u32
        )))
    );
    assert_eq!(s.client.required_collateral(&1), collateral);

    for i in 0..3 {
        onboard(&s, i, 1);
    }
    assert_eq!(s.client.get_state().status, GroupStatus::Active);
    // Collateral (30 XLM) + contribution (10 XLM) left the XLM balance;
    // USDC was never touched.
    assert_eq!(
        s.xlm.balance(&s.members[0]),
        1_000 * XLM - collateral - CONTRIB
    );
    assert_eq!(s.usdc.balance(&s.members[0]), 500 * USDC);
    // Same-asset collateral: no health factor for anyone.
    assert_eq!(s.client.health_factor(&s.members[0]), None);

    // Period 2: m3 misses — covered straight from XLM collateral, no swap.
    at(&s, 550);
    s.client.place_bid(&s.members[2], &(6 * XLM));
    at(&s, 720);
    s.client.resolve_period();
    at(&s, 1100);
    s.client.contribute(&s.members[0]);
    s.client.contribute(&s.members[1]);
    at(&s, 1400);
    s.client.settle();
    assert_eq!(s.client.get_pot(&2), 3 * CONTRIB);
    let m = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == &s.members[2])
        .unwrap();
    assert!(m.in_default);
    assert_eq!(m.collateral_xlm, collateral - CONTRIB);

    // Finish the cycle and drain: claims + collateral all pay out in XLM.
    at(&s, 1720);
    s.client.resolve_period();
    at(&s, 2100);
    for m in s.members.iter() {
        if !s.client.has_won(&m) || s.client.get_state().status == GroupStatus::Active {
            let _ = s.client.try_contribute(&m);
        }
    }
    at(&s, 2400);
    let _ = s.client.try_settle();
    at(&s, 2720);
    s.client.resolve_period();
    assert_eq!(s.client.get_state().status, GroupStatus::Completed);

    at(&s, 4000);
    for m in s.members.iter() {
        let _ = s.client.try_withdraw_collateral(&m);
        let _ = s.client.try_claim_payout(&m);
    }
    // Group fully drained in XLM — no stranded funds in either token.
    assert_eq!(s.xlm.balance(&s.client.address), 0);
    assert_eq!(s.usdc.balance(&s.client.address), 0);
}

#[test]
fn xlm_member_withdraws_xlm_after_completion() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    let m3 = &s.members[2];
    s.client.request_join(m3);
    s.client.vote_on_join(&s.members[0], m3, &true);
    s.client.vote_on_join(&s.members[1], m3, &true);
    s.client.lock_collateral(m3, &1); // 90 XLM
    s.client.contribute(m3);

    at(&s, 720);
    s.client.resolve_period();
    at(&s, 1100);
    for m in s.members.iter() {
        s.client.contribute(&m);
    }
    at(&s, 1720);
    s.client.resolve_period();
    at(&s, 2100);
    for m in s.members.iter() {
        s.client.contribute(&m);
    }
    at(&s, 2720);
    s.client.resolve_period();
    assert_eq!(s.client.get_state().status, GroupStatus::Completed);

    at(&s, 4000);
    let xlm_before = s.xlm.balance(m3);
    s.client.withdraw_collateral(m3);
    assert_eq!(s.xlm.balance(m3), xlm_before + 90 * XLM);
}

/// A liquidation venue that cannot fill must NOT revert the period.
///
/// Regression test for the mainnet-blocking bug: the router used to trap with
/// InsufficientLiquidity when its reserve was short, and because settlement is
/// auto-run by `place_bid` and `resolve_period`, that trap bricked the entire
/// group — no settle, no bidding, no resolution, no recovery. Settlement must
/// instead cover what it can, book the rest as debt, and let the clock run on.
#[test]
fn dry_router_does_not_brick_settlement() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    // m3 posts XLM collateral, so covering a miss requires the swap venue.
    let m3 = &s.members[2];
    s.client.request_join(m3);
    s.client.vote_on_join(&s.members[0], m3, &true);
    s.client.vote_on_join(&s.members[1], m3, &true);
    s.client.lock_collateral(m3, &1);
    s.client.contribute(m3);

    at(&s, 720);
    s.client.resolve_period();

    // Drain the venue completely: every swap it is asked for will now fail.
    let sink = Address::generate(&s.env);
    s.usdc
        .transfer(&s.router, &sink, &s.usdc.balance(&s.router));
    assert_eq!(s.usdc.balance(&s.router), 0);

    // Period 2: the two USDC members pay, m3 misses.
    at(&s, 1100);
    s.client.contribute(&s.members[0]);
    s.client.contribute(&s.members[1]);

    // The whole point: this used to panic and take the group with it.
    at(&s, 1400);
    s.client.settle();

    // Pot holds only what was actually paid — the miss could not be covered.
    assert_eq!(s.client.get_pot(&2), 2 * CONTRIB);
    assert!(s.client.get_settled(&2));

    // Collateral is untouched: a dead venue must not consume it for nothing.
    let m = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == m3)
        .unwrap();
    assert_eq!(m.collateral_xlm, 90 * XLM);
    assert!(m.in_default);

    // And the group is still alive: the period resolves and the clock advances.
    at(&s, 1720);
    s.client.resolve_period();
    assert_eq!(s.client.get_state().current_period, 3);
    assert_eq!(s.client.get_state().status, GroupStatus::Active);
}

/// Once the venue has liquidity again, the same member's XLM is liquidated
/// normally — the shortfall above was deferred, not lost.
#[test]
fn liquidation_resumes_once_venue_refilled() {
    let s = setup();
    onboard(&s, 0, 0);
    onboard(&s, 1, 0);
    let m3 = &s.members[2];
    s.client.request_join(m3);
    s.client.vote_on_join(&s.members[0], m3, &true);
    s.client.vote_on_join(&s.members[1], m3, &true);
    s.client.lock_collateral(m3, &1);
    s.client.contribute(m3);

    at(&s, 720);
    s.client.resolve_period();

    // Period 2 with a dry venue: miss is uncovered, collateral intact.
    let sink = Address::generate(&s.env);
    let drained = s.usdc.balance(&s.router);
    s.usdc.transfer(&s.router, &sink, &drained);
    at(&s, 1100);
    s.client.contribute(&s.members[0]);
    s.client.contribute(&s.members[1]);
    at(&s, 1400);
    s.client.settle();
    assert_eq!(s.client.get_pot(&2), 2 * CONTRIB);

    at(&s, 1720);
    s.client.resolve_period();

    // Refill the venue, then miss again in period 3: now it liquidates.
    s.usdc.transfer(&sink, &s.router, &drained);
    at(&s, 2100);
    s.client.contribute(&s.members[0]);
    s.client.contribute(&s.members[1]);
    at(&s, 2400);
    s.client.settle();

    // 10 USDC bought with 20 XLM at 0.50 → pot whole again.
    assert_eq!(s.client.get_pot(&3), 3 * CONTRIB);
    let m = s
        .client
        .get_members()
        .iter()
        .find(|m| &m.addr == m3)
        .unwrap();
    assert_eq!(m.collateral_xlm, 70 * XLM);
}
