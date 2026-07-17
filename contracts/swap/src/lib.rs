#![no_std]
//! Plexa Swap — a Soroswap-router-compatible XLM→USDC swap venue for testnet.
//!
//! The group contract liquidates XLM collateral through the two standard
//! Soroswap `Router` entrypoints (`swap_tokens_for_exact_tokens` /
//! `swap_exact_tokens_for_tokens`), so on mainnet the group can point straight
//! at the real Soroswap router without code changes. This mock fills orders
//! from its own USDC reserve at the oracle price (no fee, no slippage), which
//! keeps testnet liquidations deterministic.
//!
//! Anyone can `deposit` USDC liquidity (e.g. from the Circle testnet faucet);
//! the admin can sweep accumulated XLM / leftover USDC out via `withdraw`.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, vec, Address, Env,
    Symbol, Vec,
};

const SCALE: i128 = 10_000_000; // 7dp, shared by XLM, USDC and the oracle price

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    InvalidPath = 2,
    ExcessiveInput = 3,
    InsufficientOutput = 4,
    InsufficientLiquidity = 5,
    Expired = 6,
    InvalidAmount = 7,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Oracle,
    Xlm,
    Usdc,
}

#[contract]
pub struct SwapContract;

#[contractimpl]
impl SwapContract {
    pub fn __constructor(env: Env, admin: Address, oracle: Address, xlm: Address, usdc: Address) {
        let store = env.storage().instance();
        store.set(&DataKey::Admin, &admin);
        store.set(&DataKey::Oracle, &oracle);
        store.set(&DataKey::Xlm, &xlm);
        store.set(&DataKey::Usdc, &usdc);
    }

    /// Soroswap-compatible exact-output swap: deliver exactly `amount_out` of
    /// the last token in `path` to `to`, pulling at most `amount_in_max` of the
    /// first token from `to`. Returns `[amount_in, amount_out]`.
    pub fn swap_tokens_for_exact_tokens(
        env: Env,
        amount_out: i128,
        amount_in_max: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128> {
        check_deadline(&env, deadline);
        let (xlm, usdc) = check_path(&env, &path);
        if amount_out <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidAmount);
        }
        let price = read_price(&env);
        // XLM needed to produce amount_out USDC, rounded up so the pool never loses.
        let amount_in = ceil_div(amount_out * SCALE, price);
        if amount_in > amount_in_max {
            soroban_sdk::panic_with_error!(env, Error::ExcessiveInput);
        }
        execute(&env, &xlm, &usdc, &to, amount_in, amount_out);
        vec![&env, amount_in, amount_out]
    }

    /// Soroswap-compatible exact-input swap: sell exactly `amount_in` of the
    /// first token in `path`, requiring at least `amount_out_min` of the last.
    /// Returns `[amount_in, amount_out]`.
    pub fn swap_exact_tokens_for_tokens(
        env: Env,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        to: Address,
        deadline: u64,
    ) -> Vec<i128> {
        check_deadline(&env, deadline);
        let (xlm, usdc) = check_path(&env, &path);
        if amount_in <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidAmount);
        }
        let price = read_price(&env);
        let amount_out = amount_in * price / SCALE;
        if amount_out < amount_out_min {
            soroban_sdk::panic_with_error!(env, Error::InsufficientOutput);
        }
        execute(&env, &xlm, &usdc, &to, amount_in, amount_out);
        vec![&env, amount_in, amount_out]
    }

    /// Soroswap-compatible quote: XLM needed to buy exactly `amount_out` USDC.
    /// The group authorizes the router's pull against this number, so it must
    /// agree exactly with what `swap_tokens_for_exact_tokens` goes on to take.
    pub fn router_get_amounts_in(env: Env, amount_out: i128, path: Vec<Address>) -> Vec<i128> {
        check_path(&env, &path);
        if amount_out <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidAmount);
        }
        let price = read_price(&env);
        vec![&env, ceil_div(amount_out * SCALE, price), amount_out]
    }

    /// Soroswap-compatible pair lookup. A real router pulls the input token
    /// into the pair contract; this mock fills orders from its own reserve, so
    /// it *is* the pair — the caller's authorization then names this address.
    pub fn router_pair_for(env: Env, _token_a: Address, _token_b: Address) -> Address {
        env.current_contract_address()
    }

    /// Add USDC liquidity so swaps can be filled. Open to anyone.
    pub fn deposit(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            soroban_sdk::panic_with_error!(env, Error::InvalidAmount);
        }
        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        token::TokenClient::new(&env, &usdc).transfer(
            &from,
            &env.current_contract_address(),
            &amount,
        );
        env.events().publish((symbol_short!("deposit"),), (from, amount));
    }

    /// Admin sweep of any token held by the pool.
    pub fn withdraw(env: Env, token_addr: Address, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        token::TokenClient::new(&env, &token_addr).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
    }

    pub fn usdc_liquidity(env: Env) -> i128 {
        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        token::TokenClient::new(&env, &usdc).balance(&env.current_contract_address())
    }
}

// ===================================================================== helpers

/// Mirrors Soroswap's rule exactly: `now >= deadline` is expired. Note there is
/// deliberately no "0 means no deadline" escape hatch — this mock being lenient
/// where the real router is strict is precisely how a deadline bug reaches
/// mainnet unnoticed.
fn check_deadline(env: &Env, deadline: u64) {
    if env.ledger().timestamp() >= deadline {
        soroban_sdk::panic_with_error!(env, Error::Expired);
    }
}

/// Only the XLM→USDC direction is supported (that's the liquidation path).
fn check_path(env: &Env, path: &Vec<Address>) -> (Address, Address) {
    let xlm: Address = env.storage().instance().get(&DataKey::Xlm).unwrap();
    let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
    if path.len() != 2 || path.get(0) != Some(xlm.clone()) || path.get(1) != Some(usdc.clone()) {
        soroban_sdk::panic_with_error!(env, Error::InvalidPath);
    }
    (xlm, usdc)
}

fn read_price(env: &Env) -> i128 {
    let oracle: Address = env.storage().instance().get(&DataKey::Oracle).unwrap();
    env.invoke_contract(&oracle, &symbol_short!("price"), Vec::new(env))
}

fn execute(env: &Env, xlm: &Address, usdc: &Address, to: &Address, amount_in: i128, amount_out: i128) {
    let this = env.current_contract_address();
    let usdc_client = token::TokenClient::new(env, usdc);
    if usdc_client.balance(&this) < amount_out {
        soroban_sdk::panic_with_error!(env, Error::InsufficientLiquidity);
    }
    // `to` is the direct invoker (the group contract), so its transfer
    // authorization is satisfied by invoker auth.
    token::TokenClient::new(env, xlm).transfer(to, &this, &amount_in);
    usdc_client.transfer(&this, to, &amount_out);
    env.events().publish(
        (Symbol::new(env, "swap"),),
        (to.clone(), amount_in, amount_out),
    );
}

fn ceil_div(a: i128, b: i128) -> i128 {
    (a + b - 1) / b
}
