#![cfg(test)]
use crate::{
    GroupContract, GroupContractClient, GroupParams, GroupStatus,
};
use soroban_sdk::{
    testutils::Address as _,
    Address, Env, String,
};

#[test]
fn test_group_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let usdc = Address::generate(&env);
    let xlm = Address::generate(&env);
    let oracle = Address::generate(&env);
    let router = Address::generate(&env);
    let factory = Address::generate(&env);

    let params = GroupParams {
        owner: owner.clone(),
        name: String::from_str(&env, "Test Circle"),
        description: String::from_str(&env, "A test ROSCA circle"),
        target_members: 3,
        visibility: 0,
        currency: 0,
        period_length: 3600,
        contribution_window: 1800,
        settlement_window: 900,
        auction_window: 600,
        contribution_amount: 10_000_000,
        min_reputation: 0,
        usdc: usdc.clone(),
        xlm: xlm.clone(),
        oracle: oracle.clone(),
        router: router.clone(),
        factory: factory.clone(),
    };

    let contract_id = env.register(GroupContract, (params,));
    let client = GroupContractClient::new(&env, &contract_id);

    let config = client.get_config();
    assert_eq!(config.owner, owner);
    assert_eq!(config.target_members, 3);

    let state = client.get_state();
    assert_eq!(state.status, GroupStatus::Forming);

    let members = client.get_members();
    assert_eq!(members.len(), 1);

    // Join request
    let applicant = Address::generate(&env);
    client.request_join(&applicant);

    // Vote on join
    client.vote_on_join(&owner, &applicant, &true);

    let members_after = client.get_members();
    assert_eq!(members_after.len(), 2);
}
