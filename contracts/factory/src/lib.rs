#![no_std]
//! Plexa Factory — ultra-compact registry and group deployer.

mod test;

use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, BytesN, Env, IntoVal, String, Symbol, Val, Vec,
};

#[soroban_sdk::contracttype]
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

#[soroban_sdk::contracttype]
#[derive(Clone)]
pub struct CreateParams {
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

#[soroban_sdk::contracterror]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u32)]
pub enum Error {
    NotAdmin = 1,
    UnknownGroup = 2,
    NotCompleted = 3,
}

#[soroban_sdk::contracttype]
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
}

#[contract]
pub struct FactoryContract;

#[contractimpl]
impl FactoryContract {
    pub fn __constructor(
        env: Env,
        admin: Address,
        wasm_hash: BytesN<32>,
        usdc: Address,
        xlm: Address,
        oracle: Address,
        router: Address,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::WasmHash, &wasm_hash);
        s.set(&DataKey::Usdc, &usdc);
        s.set(&DataKey::Xlm, &xlm);
        s.set(&DataKey::Oracle, &oracle);
        s.set(&DataKey::Router, &router);
        s.set(&DataKey::Counter, &0u32);
        s.set(&DataKey::AllGroups, &Vec::<Address>::new(&env));
        s.set(&DataKey::PublicGroups, &Vec::<Address>::new(&env));
    }

    pub fn create_group(env: Env, p: CreateParams) -> Address {
        p.owner.require_auth();
        let s = env.storage().instance();
        let wasm_hash: BytesN<32> = s.get(&DataKey::WasmHash).unwrap();
        let usdc: Address = s.get(&DataKey::Usdc).unwrap();
        let xlm: Address = s.get(&DataKey::Xlm).unwrap();
        let oracle: Address = s.get(&DataKey::Oracle).unwrap();
        let router: Address = s.get(&DataKey::Router).unwrap();
        let factory = env.current_contract_address();

        let mut counter: u32 = s.get(&DataKey::Counter).unwrap_or(0);
        counter += 1;
        s.set(&DataKey::Counter, &counter);

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
        let mut args: Vec<Val> = Vec::new(&env);
        args.push_back(params.into_val(&env));

        let group = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(wasm_hash, args);

        s.set(&DataKey::IsGroup(group.clone()), &true);
        let mut all: Vec<Address> = s.get(&DataKey::AllGroups).unwrap();
        all.push_back(group.clone());
        s.set(&DataKey::AllGroups, &all);
        if visibility == 0 {
            let mut public: Vec<Address> = s.get(&DataKey::PublicGroups).unwrap();
            public.push_back(group.clone());
            s.set(&DataKey::PublicGroups, &public);
        }

        env.events().publish((symbol_short!("created"),), (owner, group.clone()));
        group
    }

    pub fn sync_reputation(env: Env, group: Address) {
        let s = env.storage().instance();
        let rep: u32 = s.get(&DataKey::Reputation(group)).unwrap_or(0);
        s.set(&DataKey::Reputation(env.current_contract_address()), &(rep + 1));
    }

    pub fn rep_of(env: Env, addr: Address) -> u32 {
        env.storage().instance().get(&DataKey::Reputation(addr)).unwrap_or(0)
    }
    pub fn get_public_groups(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::PublicGroups).unwrap_or(Vec::new(&env))
    }
    pub fn get_all_groups(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::AllGroups).unwrap_or(Vec::new(&env))
    }
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
    pub fn group_wasm(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::WasmHash).unwrap()
    }
    pub fn is_group(env: Env, addr: Address) -> bool {
        env.storage().instance().get(&DataKey::IsGroup(addr)).unwrap_or(false)
    }

    pub fn propose_group_wasm(_env: Env, _new_wasm_hash: BytesN<32>) {}
    pub fn apply_group_wasm(_env: Env) {}
    pub fn propose_upgrade(_env: Env, _new_wasm_hash: BytesN<32>) {}
    pub fn apply_upgrade(_env: Env) {}
    pub fn cancel_pending(_env: Env) {}
    pub fn set_dependencies(_env: Env, _oracle: Address, _router: Address) {}
    pub fn dependencies(env: Env) -> (Address, Address) {
        let s = env.storage().instance();
        (s.get(&DataKey::Oracle).unwrap(), s.get(&DataKey::Router).unwrap())
    }
    pub fn pending_group_wasm(_env: Env) -> Option<(BytesN<32>, u64)> { None }
    pub fn pending_upgrade(_env: Env) -> Option<(BytesN<32>, u64)> { None }
    pub fn set_admin(env: Env, new_admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }
}
