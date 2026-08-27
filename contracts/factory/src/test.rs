#![cfg(test)]
use crate::{FactoryContract, FactoryContractClient, ReputationTier};
use soroban_sdk::{
    testutils::Address as _, testutils::Ledger as _, Address, BytesN, Env,
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
        (admin.clone(), wasm_hash, usdc.clone(), xlm, oracle, router),
    );
    let client = FactoryContractClient::new(&env, &id);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.treasury(), admin);
    assert_eq!(client.protocol_fee_bps(), 0);
    assert!(!client.is_paused());
    assert_eq!(client.get_public_groups().len(), 0);
    assert_eq!(client.get_all_groups().len(), 0);

    let stats = client.get_protocol_stats();
    assert_eq!(stats.total_groups_created, 0);
    assert_eq!(stats.total_volume_locked, 0);

    // Unknown address has zero reputation profile with Newcomer tier
    let someone = Address::generate(&env);
    assert_eq!(client.rep_of(&someone), 0);
    let profile = client.get_reputation_profile(&someone);
    assert_eq!(profile.score, 0);
    assert_eq!(profile.tier, ReputationTier::Newcomer);
}

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

    assert_eq!(client.group_wasm(), old);
    let (pending, ready_at) = client.pending_group_wasm().unwrap();
    assert_eq!(pending, new);

    env.ledger().set_timestamp(ready_at);
    client.apply_group_wasm();
    assert_eq!(client.group_wasm(), new);
    assert!(client.pending_group_wasm().is_none());
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // TimelockActive = 9
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
fn two_step_admin_transfer() {
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

    client.transfer_admin(&next);
    assert_eq!(client.admin(), admin);
    assert_eq!(client.pending_admin(), Some(next.clone()));

    client.accept_admin();
    assert_eq!(client.admin(), next);
    assert_eq!(client.pending_admin(), None);
}

#[test]
fn pause_and_fee_and_blacklist_governance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let bad_actor = Address::generate(&env);

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

    // Pause toggle
    client.set_paused(&true);
    assert!(client.is_paused());
    client.set_paused(&false);
    assert!(!client.is_paused());

    // Treasury & Fee
    client.set_treasury(&treasury);
    assert_eq!(client.treasury(), treasury);

    client.set_protocol_fee_bps(&150); // 1.5%
    assert_eq!(client.protocol_fee_bps(), 150);

    // Blacklist
    assert!(!client.is_blacklisted(&bad_actor));
    client.set_blacklist(&bad_actor, &true);
    assert!(client.is_blacklisted(&bad_actor));
}

