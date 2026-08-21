#![cfg(test)]
use crate::{FactoryContract, FactoryContractClient};
use soroban_sdk::{
    testutils::Address as _, Address, BytesN, Env,
};

#[test]
fn init_and_views() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let xlm = Address::generate(&env);
    let oracle = Address::generate(&env);
    let router = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

    let id = env.register(
        FactoryContract,
        (admin.clone(), wasm_hash.clone(), usdc.clone(), xlm, oracle, router),
    );
    let client = FactoryContractClient::new(&env, &id);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.group_wasm(), wasm_hash);
    assert_eq!(client.get_public_groups().len(), 0);
    assert_eq!(client.get_all_groups().len(), 0);
    
    let someone = Address::generate(&env);
    assert_eq!(client.rep_of(&someone), 0);
}

#[test]
fn is_group_only_true_for_registered_groups() {
    let env = Env::default();
    env.mock_all_auths();

    let id = env.register(
        FactoryContract,
        (
            Address::generate(&env),
            BytesN::from_array(&env, &[0u8; 32]),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ),
    );
    let client = FactoryContractClient::new(&env, &id);

    assert!(!client.is_group(&Address::generate(&env)));
}

#[test]
fn admin_can_be_rotated() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let next = Address::generate(&env);

    let id = env.register(
        FactoryContract,
        (
            admin.clone(),
            BytesN::from_array(&env, &[0u8; 32]),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ),
    );
    let client = FactoryContractClient::new(&env, &id);

    client.set_admin(&next);
    assert_eq!(client.admin(), next);
}
