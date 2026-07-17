#![cfg(test)]
use crate::{FactoryContract, FactoryContractClient};
use soroban_sdk::{
    testutils::Address as _, Address, BytesN, Env,
};

// NOTE: create_group / sync_reputation are exercised end-to-end in the JS
// integration tests against a deployed group wasm, since deploy_v2 needs the
// installed Group wasm hash. These unit tests cover the registry/config surface.

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
        (admin.clone(), wasm_hash, usdc.clone(), xlm, oracle, router),
    );
    let client = FactoryContractClient::new(&env, &id);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.get_public_groups().len(), 0);
    assert_eq!(client.get_all_groups().len(), 0);
    // Unknown address has zero reputation.
    let someone = Address::generate(&env);
    assert_eq!(client.rep_of(&someone), 0);
}
