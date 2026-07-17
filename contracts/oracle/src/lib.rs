#![no_std]
//! Plexa Price Oracle — a minimal admin-set XLM/USDC price feed for
//! development and testing. Groups read `price()` (USDC per 1 XLM, 7 decimals)
//! to size XLM collateral, compute health factors and drive liquidations.
//!
//! In production this contract is replaced by a real oracle (e.g. Reflector);
//! only the `price()` read needs to be adapted in the group contract.

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env};

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    InvalidPrice = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Price,     // i128: USDC (7dp) per 1 XLM
    UpdatedAt, // u64 unix ts of the last set_price
}

#[contract]
pub struct OracleContract;

#[contractimpl]
impl OracleContract {
    /// `initial_price` is USDC per 1 XLM at 7 decimals (e.g. 0.45 USDC = 4_500_000).
    pub fn __constructor(env: Env, admin: Address, initial_price: i128) {
        if initial_price <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidPrice);
        }
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Price, &initial_price);
        store.set(&DataKey::UpdatedAt, &env.ledger().timestamp());
    }

    /// Admin-only price update (dev/test convenience; a real deployment uses a
    /// decentralized feed instead).
    pub fn set_price(env: Env, price: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if price <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidPrice);
        }
        let store = env.storage().instance();
        store.set(&DataKey::Price, &price);
        store.set(&DataKey::UpdatedAt, &env.ledger().timestamp());
        env.events().publish((symbol_short!("price"),), price);
    }

    /// Current XLM price in USDC units (7 decimals).
    pub fn price(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Price).unwrap()
    }

    pub fn updated_at(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::UpdatedAt).unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}
