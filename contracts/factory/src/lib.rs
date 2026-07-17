#![no_std]
//! Plexa Factory — deploys Group contract instances and maintains the public
//! discovery registry plus the cross-group reputation ledger.

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    IntoVal, String, Symbol, Val, Vec,
};

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
    pub usdc: Address,
    pub xlm: Address,
    pub oracle: Address,
    pub router: Address,
    pub factory: Address,
}

/// Creation inputs supplied by the user (the factory injects token/oracle/
/// router/factory addresses itself). Travels as one struct because contract
/// functions are capped at 10 arguments.
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
}

#[contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotAdmin = 2,
    UnknownGroup = 3,
    NotCompleted = 4,
    AlreadySynced = 5,
    InvalidParams = 6,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    WasmHash,
    Usdc,
    Xlm,
    Oracle,
    Router,
    Counter,
    AllGroups,
    PublicGroups,
    IsGroup(Address),
    Reputation(Address),
    Synced(Address),
}

#[contract]
pub struct FactoryContract;

#[contractimpl]
impl FactoryContract {
    /// `wasm_hash` is the installed hash of the Group contract wasm. `usdc`/
    /// `xlm` are the token contracts, `oracle` the XLM/USDC price feed and
    /// `router` the Soroswap-compatible swap venue every group deployed by
    /// this factory will use.
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
        store.set(&DataKey::Counter, &0u32);
        store.set(&DataKey::AllGroups, &Vec::<Address>::new(&env));
        store.set(&DataKey::PublicGroups, &Vec::<Address>::new(&env));
    }

    /// Deploy a new ROSCA group and register it.
    /// `p.visibility`: 0 = Public (added to discovery feed), 1 = Private.
    pub fn create_group(env: Env, p: CreateParams) -> Address {
        p.owner.require_auth();
        let store = env.storage().instance();
        let wasm_hash: BytesN<32> = store.get(&DataKey::WasmHash).unwrap();
        let usdc: Address = store.get(&DataKey::Usdc).unwrap();
        let xlm: Address = store.get(&DataKey::Xlm).unwrap();
        let oracle: Address = store.get(&DataKey::Oracle).unwrap();
        let router: Address = store.get(&DataKey::Router).unwrap();
        let factory = env.current_contract_address();

        let mut counter: u32 = store.get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        store.set(&DataKey::Counter, &counter);

        let mut salt_bytes = [0u8; 32];
        salt_bytes[0..4].copy_from_slice(&counter.to_be_bytes());
        let salt = BytesN::from_array(&env, &salt_bytes);

        let visibility = p.visibility;
        let owner = p.owner.clone();
        let params = GroupParams {
            owner: p.owner,
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
            usdc,
            xlm,
            oracle,
            router,
            factory,
        };
        // The Group constructor takes a single GroupParams argument.
        let mut args: Vec<Val> = Vec::new(&env);
        args.push_back(params.into_val(&env));

        let group = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, args);

        store.set(&DataKey::IsGroup(group.clone()), &true);
        let mut all: Vec<Address> = store.get(&DataKey::AllGroups).unwrap();
        all.push_back(group.clone());
        store.set(&DataKey::AllGroups, &all);
        if visibility == 0 {
            let mut public: Vec<Address> = store.get(&DataKey::PublicGroups).unwrap();
            public.push_back(group.clone());
            store.set(&DataKey::PublicGroups, &public);
        }

        env.events()
            .publish((symbol_short!("created"),), (owner, group.clone()));
        group
    }

    /// Pull reputation from a completed group: every graduate (finished without
    /// defaulting) gains +1. Permissionless but idempotent per group.
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
        for addr in graduates.iter() {
            let rep: u32 = store.get(&DataKey::Reputation(addr.clone())).unwrap_or(0);
            store.set(&DataKey::Reputation(addr.clone()), &(rep + 1));
        }
        store.set(&DataKey::Synced(group.clone()), &true);
        env.events()
            .publish((symbol_short!("rep_sync"),), group);
    }

    // ------------------------------------------------------------------- Views

    /// Reputation score for an address (count of cleanly-completed cycles).
    pub fn rep_of(env: Env, addr: Address) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Reputation(addr))
            .unwrap_or(0)
    }
    pub fn get_public_groups(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::PublicGroups)
            .unwrap_or(Vec::new(&env))
    }
    pub fn get_all_groups(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::AllGroups)
            .unwrap_or(Vec::new(&env))
    }
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

fn panic_with(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}
