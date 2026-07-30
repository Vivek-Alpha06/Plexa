#![no_std]
//! Plexa Price Oracle — a thin, trust-minimised adapter over the Reflector
//! decentralized price feed.
//!
//! Groups read `price()` (quote-asset units per 1 base asset, 7 decimals) to
//! size XLM collateral, compute health factors and decide liquidations. That
//! ABI is unchanged from the previous admin-set oracle, so the group contract
//! consumes this without modification.
//!
//! ## Why this replaces the admin-set feed
//! The previous version stored a price an admin key could set to any value.
//! Because that number drives collateral sizing and health factors, whoever
//! held the key could mark every XLM-collateral member unhealthy and liquidate
//! them at will. Acceptable for a local dev stub; unacceptable with real money.
//!
//! **No key can set a price here.** The admin may only repoint the feed or
//! adjust the staleness bound; the number itself always comes from Reflector.
//!
//! ## Cross rate, not an assumption
//! Reflector quotes against USD. We read *both* legs — base/USD and quote/USD —
//! and divide, so an off-peg USDC is priced correctly rather than silently
//! treated as exactly $1.
//!
//! ## Staleness
//! A price older than `max_age` is refused rather than returned. Reflector
//! publishes on a fixed resolution (300s on current feeds), so `max_age` must
//! sit comfortably above that or reads fail routinely between updates.
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, vec, Address, Env, IntoVal,
    Symbol,
    Val, Vec,
};

/// Plexa's fixed-point scale for prices (7 decimals, matching token amounts).
const SCALE: i128 = 10_000_000;

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    InvalidPrice = 2,
    /// Reflector has no record for one of the configured assets.
    NoData = 3,
    /// The newest price is older than `max_age`.
    StalePrice = 4,
    InvalidParams = 5,
}

/// Mirror of Reflector's `Asset`. `#[contracttype]` enums serialize by variant
/// name, so this matches on the wire without depending on their crate.
#[contracttype]
#[derive(Clone)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

/// Mirror of Reflector's `PriceData` (serializes by field name).
#[contracttype]
#[derive(Clone)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Reflector,
    /// Symbol of the asset being priced, e.g. XLM.
    Base,
    /// Symbol the price is denominated in, e.g. USDC.
    Quote,
    /// Max age in seconds before a Reflector price is refused.
    MaxAge,
}

#[contract]
pub struct OracleContract;

#[contractimpl]
impl OracleContract {
    /// `reflector` is the Reflector oracle contract for this network.
    /// `base`/`quote` are Reflector asset symbols (e.g. XLM / USDC).
    /// `max_age` seconds — keep well above Reflector's `resolution()`.
    pub fn __constructor(
        env: Env,
        admin: Address,
        reflector: Address,
        base: Symbol,
        quote: Symbol,
        max_age: u64,
    ) {
        if max_age == 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidParams);
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Reflector, &reflector);
        s.set(&DataKey::Base, &base);
        s.set(&DataKey::Quote, &quote);
        s.set(&DataKey::MaxAge, &max_age);
    }

    /// Price of 1 base asset in quote units, 7 decimals.
    ///
    /// Panics on missing or stale data rather than returning a wrong number —
    /// a caller sizing collateral must never act on a guess. Callers for whom
    /// the price is merely informational should invoke this fallibly instead.
    pub fn price(env: Env) -> i128 {
        let s = env.storage().instance();
        let reflector: Address = s.get(&DataKey::Reflector).unwrap();
        let base: Symbol = s.get(&DataKey::Base).unwrap();
        let quote: Symbol = s.get(&DataKey::Quote).unwrap();
        let max_age: u64 = s.get(&DataKey::MaxAge).unwrap();

        let b = read_price(&env, &reflector, base);
        let q = read_price(&env, &reflector, quote);

        let now = env.ledger().timestamp();
        if is_stale(now, b.timestamp, max_age) || is_stale(now, q.timestamp, max_age) {
            soroban_sdk::panic_with_error!(env, Error::StalePrice);
        }
        if b.price <= 0 || q.price <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidPrice);
        }

        // Both legs share Reflector's decimals, so the exponent cancels and we
        // only reintroduce Plexa's scale.
        let out = b.price * SCALE / q.price;
        if out <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidPrice);
        }
        out
    }

    /// Timestamp of the older leg — how fresh `price()` actually is.
    pub fn updated_at(env: Env) -> u64 {
        let s = env.storage().instance();
        let reflector: Address = s.get(&DataKey::Reflector).unwrap();
        let b = read_price(&env, &reflector, s.get(&DataKey::Base).unwrap());
        let q = read_price(&env, &reflector, s.get(&DataKey::Quote).unwrap());
        if b.timestamp < q.timestamp {
            b.timestamp
        } else {
            q.timestamp
        }
    }

    // ----------------------------------------------------------------- admin
    // The admin can repoint the feed but can never author a price.

    /// Repoint at a different Reflector deployment (network move, or Reflector
    /// migrating contracts). Cannot fabricate a price.
    pub fn set_reflector(env: Env, reflector: Address) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Reflector, &reflector);
        env.events().publish((symbol_short!("feed_set"),), reflector);
    }

    pub fn set_max_age(env: Env, max_age: u64) {
        require_admin(&env);
        if max_age == 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidParams);
        }
        env.storage().instance().set(&DataKey::MaxAge, &max_age);
        env.events().publish((symbol_short!("age_set"),), max_age);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events().publish((symbol_short!("admin_set"),), new_admin);
    }

    // ----------------------------------------------------------------- views
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
    pub fn reflector(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Reflector).unwrap()
    }
    pub fn max_age(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::MaxAge).unwrap()
    }
    pub fn pair(env: Env) -> (Symbol, Symbol) {
        let s = env.storage().instance();
        (
            s.get(&DataKey::Base).unwrap(),
            s.get(&DataKey::Quote).unwrap(),
        )
    }
}

fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}

/// Guard against a feed timestamp ahead of the ledger: `now - ts` would
/// underflow on u64 and wrap to a huge value, which a naive comparison would
/// read as "fresh". Treat anything in the future as fresh, never as stale.
fn is_stale(now: u64, ts: u64, max_age: u64) -> bool {
    now > ts && now - ts > max_age
}

fn read_price(env: &Env, reflector: &Address, asset: Symbol) -> PriceData {
    let args: Vec<Val> = vec![env, Asset::Other(asset).into_val(env)];
    let res: Option<PriceData> = env.invoke_contract(reflector, &symbol_short!("lastprice"), args);
    match res {
        Some(p) => p,
        None => soroban_sdk::panic_with_error!(env, Error::NoData),
    }
}
