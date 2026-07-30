#![cfg(test)]
use crate::{FactoryContract, FactoryContractClient};
use soroban_sdk::{
    testutils::Ledger as _,
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

/// Repointing the factory at a new Group wasm must not need a redeploy —
/// that was the whole reason a buggy group build stayed live.
#[test]
fn admin_can_repoint_group_wasm() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let old = BytesN::from_array(&env, &[0u8; 32]);
    let new = BytesN::from_array(&env, &[7u8; 32]);

    let id = env.register(
        FactoryContract,
        (
            admin.clone(),
            old.clone(),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ),
    );
    let client = FactoryContractClient::new(&env, &id);

    assert_eq!(client.group_wasm(), old);
    client.propose_group_wasm(&new);

    // The proposal is visible but must not take effect yet — that window is
    // what lets members exit before new logic takes custody of their funds.
    assert_eq!(client.group_wasm(), old);
    let (pending, ready_at) = client.pending_group_wasm().unwrap();
    assert_eq!(pending, new);

    env.ledger().set_timestamp(ready_at);
    client.apply_group_wasm();
    assert_eq!(client.group_wasm(), new);
    assert!(client.pending_group_wasm().is_none());
}

/// The timelock is worthless if it can be skipped, so pin the refusal.
#[test]
#[should_panic(expected = "Error(Contract, #8)")] // TimelockActive
fn group_wasm_cannot_be_applied_early() {
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

    client.propose_group_wasm(&BytesN::from_array(&env, &[7u8; 32]));
    client.apply_group_wasm(); // still inside the delay
}

/// A group deployed outside the factory must not be mistaken for a real one:
/// it can name any factory as its upgrade authority, so registry membership is
/// the only trustworthy signal.
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

/// Admin rotation must take effect, since Group::upgrade reads the admin live
/// from the factory rather than caching it at construction.
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
