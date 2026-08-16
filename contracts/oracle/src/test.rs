#![cfg(test)]
//! Tests for the Reflector adapter.
//!
//! This contract sizes collateral and drives liquidation decisions, so the
//! cases that matter are the ones where it must *refuse* rather than return a
//! plausible-looking number.

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    testutils::{Address as _, Ledger as _},
    Address, Env, Symbol,
};

use crate::{OracleContract, OracleContractClient};

/// Stand-in for Reflector. Stores a price + timestamp per asset symbol and
/// serves `lastprice`, matching the real feed's shape (14dp, base USD).
mod mock_reflector {
    use super::*;

    #[contracttype]
    #[derive(Clone)]
    pub enum Asset {
        Stellar(Address),
        Other(Symbol),
    }

    #[contracttype]
    #[derive(Clone)]
    pub struct PriceData {
        pub price: i128,
        pub timestamp: u64,
    }

    #[contract]
    pub struct MockReflector;

    #[contractimpl]
    impl MockReflector {
        /// `lastprice` returns None for anything not explicitly set, exactly as
        /// Reflector does for an unlisted asset.
        pub fn set(env: Env, asset: Symbol, price: i128, timestamp: u64) {
            env.storage().instance().set(&asset, &(price, timestamp));
        }

        pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
            let sym = match asset {
                Asset::Other(s) => s,
                Asset::Stellar(_) => return None,
            };
            env.storage()
                .instance()
                .get::<Symbol, (i128, u64)>(&sym)
                .map(|(price, timestamp)| PriceData { price, timestamp })
        }
    }
}

use mock_reflector::{MockReflector, MockReflectorClient};

/// Reflector publishes 14 decimals.
const D14: i128 = 100_000_000_000_000;
const MAX_AGE: u64 = 1800;

struct Setup {
    env: Env,
    oracle: OracleContractClient<'static>,
    feed: MockReflectorClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);

    let admin = Address::generate(&env);
    let feed_id = env.register(MockReflector, ());
    let feed = MockReflectorClient::new(&env, &feed_id);

    let oracle_id = env.register(
        OracleContract,
        (
            admin,
            feed_id.clone(),
            symbol_short!("XLM"),
            symbol_short!("USDC"),
            MAX_AGE,
        ),
    );
    let oracle = OracleContractClient::new(&env, &oracle_id);

    Setup { env, oracle, feed }
}

/// Publish both legs at the current ledger time.
fn publish(s: &Setup, xlm_usd: i128, usdc_usd: i128) {
    let now = s.env.ledger().timestamp();
    s.feed.set(&symbol_short!("XLM"), &xlm_usd, &now);
    s.feed.set(&symbol_short!("USDC"), &usdc_usd, &now);
}

#[test]
fn cross_rate_is_quote_units_per_base() {
    let s = setup();
    // XLM $0.15690779732633, USDC $1.00045957218341 — real mainnet values.
    publish(&s, 15_690_779_732_633, 100_045_957_218_341);

    // 0.15690779… / 1.00045957… = 0.1568357… → 1_568_357 at 7dp.
    assert_eq!(s.oracle.price(), 1_568_357);
}

/// The whole reason both legs are read: a depegged USDC must move the rate. If
/// the quote leg were assumed to be exactly $1, collateral would be mis-sized
/// precisely when the peg breaks and accuracy matters most.
#[test]
fn depegged_quote_changes_the_rate() {
    let s = setup();
    publish(&s, 20 * D14 / 100, D14); // XLM $0.20, USDC $1.00
    assert_eq!(s.oracle.price(), 2_000_000); // 0.20

    publish(&s, 20 * D14 / 100, 90 * D14 / 100); // USDC drops to $0.90
    assert_eq!(s.oracle.price(), 2_222_222); // 0.20 / 0.90 = 0.2222…
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // StalePrice
fn stale_base_leg_is_refused() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.feed
        .set(&symbol_short!("XLM"), &(20 * D14 / 100), &(now - MAX_AGE - 1));
    s.feed.set(&symbol_short!("USDC"), &D14, &now);
    s.oracle.price();
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn stale_quote_leg_is_refused() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.feed.set(&symbol_short!("XLM"), &(20 * D14 / 100), &now);
    s.feed
        .set(&symbol_short!("USDC"), &D14, &(now - MAX_AGE - 1));
    s.oracle.price();
}

#[test]
fn price_exactly_at_max_age_still_serves() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.feed
        .set(&symbol_short!("XLM"), &(20 * D14 / 100), &(now - MAX_AGE));
    s.feed.set(&symbol_short!("USDC"), &D14, &(now - MAX_AGE));
    assert_eq!(s.oracle.price(), 2_000_000);
}

/// A feed timestamp ahead of the ledger must not wrap the u64 subtraction into
/// a huge "age" and read as stale — nor should it be rejected as an error.
#[test]
fn future_timestamp_is_treated_as_fresh() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.feed
        .set(&symbol_short!("XLM"), &(20 * D14 / 100), &(now + 600));
    s.feed.set(&symbol_short!("USDC"), &D14, &(now + 600));
    assert_eq!(s.oracle.price(), 2_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // NoData
fn unlisted_asset_is_refused() {
    let s = setup();
    // Only the quote leg is published; XLM has no record.
    let now = s.env.ledger().timestamp();
    s.feed.set(&symbol_short!("USDC"), &D14, &now);
    s.oracle.price();
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // InvalidPrice
fn non_positive_price_is_refused() {
    let s = setup();
    publish(&s, 0, D14);
    s.oracle.price();
}

/// Rounding must not silently yield zero: a 0 price would size collateral as
/// free. Refuse instead.
#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rate_rounding_to_zero_is_refused() {
    let s = setup();
    // base/quote far below the 7dp representable minimum.
    publish(&s, 1, D14 * 1_000);
    s.oracle.price();
}

#[test]
fn updated_at_reports_the_older_leg() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.feed.set(&symbol_short!("XLM"), &(20 * D14 / 100), &(now - 100));
    s.feed.set(&symbol_short!("USDC"), &D14, &(now - 400));
    assert_eq!(s.oracle.updated_at(), now - 400);
}

// ------------------------------------------------------------------- admin

/// The security property that motivated this contract: the admin can repoint
/// the feed but has no entrypoint that authors a price.
#[test]
fn admin_can_repoint_feed_but_not_author_a_price() {
    let s = setup();
    publish(&s, 20 * D14 / 100, D14);
    assert_eq!(s.oracle.price(), 2_000_000);

    let other_id = s.env.register(MockReflector, ());
    let other = MockReflectorClient::new(&s.env, &other_id);
    let now = s.env.ledger().timestamp();
    other.set(&symbol_short!("XLM"), &(50 * D14 / 100), &now);
    other.set(&symbol_short!("USDC"), &D14, &now);

    s.oracle.set_reflector(&other_id);
    assert_eq!(s.oracle.reflector(), other_id);
    // The number still comes from the feed, never from the admin.
    assert_eq!(s.oracle.price(), 5_000_000);
}

#[test]
fn admin_can_adjust_staleness_bound() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.feed
        .set(&symbol_short!("XLM"), &(20 * D14 / 100), &(now - 3600));
    s.feed.set(&symbol_short!("USDC"), &D14, &(now - 3600));

    s.oracle.set_max_age(&7200);
    assert_eq!(s.oracle.max_age(), 7200);
    assert_eq!(s.oracle.price(), 2_000_000);
}

#[test]
fn admin_rotates() {
    let s = setup();
    let next = Address::generate(&s.env);
    s.oracle.set_admin(&next);
    assert_eq!(s.oracle.admin(), next);
}

#[test]
fn pair_reports_configured_symbols() {
    let s = setup();
    assert_eq!(s.oracle.pair(), (symbol_short!("XLM"), symbol_short!("USDC")));
}

/// A zero staleness bound would make every price stale and brick collateral
/// sizing, so the constructor must refuse it outright.
#[test]
#[should_panic(expected = "Error(Contract, #5)")] // InvalidParams
fn constructor_rejects_zero_max_age() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let feed = env.register(MockReflector, ());
    env.register(
        OracleContract,
        (admin, feed, symbol_short!("XLM"), symbol_short!("USDC"), 0u64),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn set_max_age_rejects_zero() {
    let s = setup();
    s.oracle.set_max_age(&0);
}
