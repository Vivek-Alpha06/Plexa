#![no_std]
//! Plexa Group contract — lightweight ROSCA group implementation.

mod types;
#[cfg(test)]
mod test;

pub use types::*;

use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, BytesN, Env, Symbol, Vec,
};

const MAX_HISTORY: u32 = 50;

#[contract]
pub struct GroupContract;

#[contractimpl]
impl GroupContract {
    pub fn __constructor(env: Env, p: GroupParams) {
        let pot_size = p.contribution_amount * (p.target_members as i128);
        let config = GroupConfig {
            name: p.name,
            description: p.description,
            owner: p.owner.clone(),
            target_members: p.target_members,
            visibility: Visibility::from_u32(p.visibility),
            currency: CollateralAsset::from_u32(p.currency),
            period_length: p.period_length,
            contribution_window: p.contribution_window,
            settlement_window: p.settlement_window,
            auction_window: p.auction_window,
            payout_window: if p.period_length > 60 { p.period_length - 60 } else { 10 },
            contribution_amount: p.contribution_amount,
            pot_size,
            collateral_requirement: pot_size,
            min_reputation: p.min_reputation,
            usdc: p.usdc,
            xlm: p.xlm,
            oracle: p.oracle,
            router: p.router,
            factory: p.factory,
        };

        let state = GroupState {
            status: GroupStatus::Forming,
            start_time: env.ledger().timestamp(),
            current_period: 1,
            members_won: 0,
            completed_periods: 0,
            completed_at: 0,
        };

        let store = env.storage();
        store.instance().set(&DataKey::Config, &config);
        store.instance().set(&DataKey::State, &state);

        let mut members = Vec::<Address>::new(&env);
        members.push_back(p.owner.clone());
        store.instance().set(&DataKey::Members, &members);

        let owner_member = Member {
            addr: p.owner.clone(),
            collateral_asset: CollateralAsset::Usdc,
            collateral_usdc: pot_size,
            collateral_xlm: 0,
            has_won: false,
            in_default: false,
            removed: false,
            hf_breach_period: 0,
            joined_period: 1,
        };
        store.persistent().set(&DataKey::Member(p.owner.clone()), &owner_member);
        store.persistent().set(&DataKey::Approved(p.owner.clone()), &true);
        store.instance().set(&DataKey::JoinReqList, &Vec::<Address>::new(&env));
        store.instance().set(&DataKey::History, &Vec::<HistoryEntry>::new(&env));

        log_history(&env, symbol_short!("started"), p.owner, 0);
    }

    pub fn request_join(env: Env, applicant: Address) {
        applicant.require_auth();
        if is_member(&env, &applicant) {
            panic_with(&env, Error::AlreadyMember);
        }
        if env.storage().persistent().has(&DataKey::JoinReq(applicant.clone())) {
            panic_with(&env, Error::AlreadyRequested);
        }
        let req = JoinRequest {
            applicant: applicant.clone(),
            yes_votes: 0,
            no_votes: 0,
            voters: Vec::new(&env),
            resolved: false,
            approved: false,
            created_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::JoinReq(applicant.clone()), &req);

        let mut pending: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::JoinReqList)
            .unwrap_or(Vec::new(&env));
        pending.push_back(applicant.clone());
        env.storage().instance().set(&DataKey::JoinReqList, &pending);

        log_history(&env, symbol_short!("join_req"), applicant.clone(), 0);
        env.events().publish((symbol_short!("join_req"),), applicant);
    }

    pub fn vote_on_join(env: Env, voter: Address, applicant: Address, approve: bool) {
        voter.require_auth();
        require_member(&env, &voter);

        let mut req: JoinRequest = env
            .storage()
            .persistent()
            .get(&DataKey::JoinReq(applicant.clone()))
            .unwrap_or_else(|| panic_with(&env, Error::NoPendingRequest));
        if req.resolved {
            panic_with(&env, Error::AlreadyResolved);
        }
        if req.voters.contains(&voter) {
            panic_with(&env, Error::AlreadyVoted);
        }
        req.voters.push_back(voter);
        if approve {
            req.yes_votes += 1;
        } else {
            req.no_votes += 1;
        }

        let members = get_members(&env);
        let majority = members.len() / 2 + 1;

        if req.yes_votes >= majority {
            req.resolved = true;
            req.approved = true;
            remove_pending(&env, &applicant);

            // Automatically join member on approval
            if !is_member(&env, &applicant) {
                let config = get_config(&env);
                let mut m_list = get_members(&env);
                m_list.push_back(applicant.clone());
                env.storage().instance().set(&DataKey::Members, &m_list);

                let record = Member {
                    addr: applicant.clone(),
                    collateral_asset: CollateralAsset::Usdc,
                    collateral_usdc: config.collateral_requirement,
                    collateral_xlm: 0,
                    has_won: false,
                    in_default: false,
                    removed: false,
                    hf_breach_period: 0,
                    joined_period: 1,
                };
                env.storage().persistent().set(&DataKey::Member(applicant.clone()), &record);
                env.storage().persistent().set(&DataKey::Approved(applicant.clone()), &true);
            }

            log_history(&env, symbol_short!("join_ok"), applicant.clone(), 0);
            env.events().publish((symbol_short!("join_ok"),), applicant.clone());
        } else if req.no_votes >= majority {
            req.resolved = true;
            req.approved = false;
            remove_pending(&env, &applicant);
            log_history(&env, symbol_short!("join_no"), applicant.clone(), 0);
            env.events().publish((symbol_short!("join_no"),), applicant.clone());
        }
        env.storage().persistent().set(&DataKey::JoinReq(applicant), &req);
    }

    pub fn lock_collateral(env: Env, member: Address, asset: u32) {
        member.require_auth();
        let config = get_config(&env);
        if !is_member(&env, &member) {
            let mut members = get_members(&env);
            members.push_back(member.clone());
            env.storage().instance().set(&DataKey::Members, &members);
        }
        let record = Member {
            addr: member.clone(),
            collateral_asset: CollateralAsset::from_u32(asset),
            collateral_usdc: config.collateral_requirement,
            collateral_xlm: 0,
            has_won: false,
            in_default: false,
            removed: false,
            hf_breach_period: 0,
            joined_period: 1,
        };
        env.storage().persistent().set(&DataKey::Member(member.clone()), &record);
        env.storage().persistent().set(&DataKey::Approved(member.clone()), &true);
        log_history(&env, symbol_short!("joined"), member.clone(), config.collateral_requirement);
        env.events().publish((symbol_short!("joined"),), (member, asset));
    }

    pub fn contribute(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        let config = get_config(&env);
        let state = get_state(&env);
        let period = state.current_period;
        env.storage().persistent().set(&DataKey::Contributed(period, member.clone()), &true);
        log_history(&env, symbol_short!("contrib"), member.clone(), config.contribution_amount);
        env.events().publish((symbol_short!("contrib"), period), (member, config.contribution_amount));
    }

    pub fn top_up(env: Env, member: Address, _asset: u32, amount: i128) {
        member.require_auth();
        require_member(&env, &member);
        log_history(&env, symbol_short!("topup"), member.clone(), amount);
    }

    pub fn settle(env: Env) {
        let state = get_state(&env);
        let period = state.current_period;
        env.storage().persistent().set(&DataKey::Settled(period), &true);
        log_history(&env, symbol_short!("settled"), env.current_contract_address(), 0);
    }

    pub fn place_bid(env: Env, member: Address, discount: i128) {
        member.require_auth();
        require_member(&env, &member);
        let state = get_state(&env);
        let bid = Bid { bidder: member.clone(), discount };
        env.storage().persistent().set(&DataKey::Bid(state.current_period), &bid);
        log_history(&env, symbol_short!("bid"), member.clone(), discount);
        env.events().publish((symbol_short!("bid"), state.current_period), (member, discount));
    }

    pub fn resolve_period(env: Env) {
        let mut state = get_state(&env);
        let members = get_members(&env);
        let period = state.current_period;
        if let Some(winner) = members.get(0) {
            log_history(&env, symbol_short!("resolved"), winner.clone(), 0);
            env.events().publish((symbol_short!("resolved"), period), (winner, 0i128, symbol_short!("rotate")));
        }
        state.completed_periods += 1;
        state.current_period += 1;
        env.storage().instance().set(&DataKey::State, &state);
    }

    pub fn claim_payout(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        log_history(&env, symbol_short!("claim"), member.clone(), 0);
    }

    pub fn withdraw_collateral(env: Env, member: Address) {
        member.require_auth();
        require_member(&env, &member);
        log_history(&env, symbol_short!("withdraw"), member.clone(), 0);
    }

    pub fn propose_upgrade(_env: Env, _new_wasm_hash: BytesN<32>) {}
    pub fn cancel_upgrade(_env: Env) {}
    pub fn pending_upgrade(_env: Env) -> Option<(BytesN<32>, u64)> { None }
    pub fn apply_upgrade(_env: Env) {}

    // --- Views ---
    pub fn get_config(env: Env) -> GroupConfig { get_config(&env) }
    pub fn get_state(env: Env) -> GroupState { get_state(&env) }
    pub fn get_members(env: Env) -> Vec<Member> {
        let mut out = Vec::new(&env);
        for addr in get_members(&env).iter() {
            out.push_back(get_member(&env, &addr));
        }
        out
    }
    pub fn get_phase(_env: Env) -> Phase { Phase::Contribution }
    pub fn get_claimable(_env: Env, _member: Address) -> i128 { 0 }
    pub fn get_current_bid(env: Env) -> Option<Bid> {
        let state = get_state(&env);
        env.storage().persistent().get(&DataKey::Bid(state.current_period))
    }
    pub fn get_join_request(env: Env, applicant: Address) -> Option<JoinRequest> {
        env.storage().persistent().get(&DataKey::JoinReq(applicant))
    }
    pub fn get_pending_joins(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::JoinReqList).unwrap_or(Vec::new(&env))
    }
    pub fn get_history(env: Env) -> Vec<HistoryEntry> {
        env.storage().instance().get(&DataKey::History).unwrap_or(Vec::new(&env))
    }
    pub fn has_won(_env: Env, _member: Address) -> bool { false }
    pub fn is_completed(_env: Env) -> bool { false }
    pub fn get_settled(env: Env, period: u32) -> bool {
        env.storage().persistent().get(&DataKey::Settled(period)).unwrap_or(false)
    }
    pub fn get_pot(env: Env, period: u32) -> i128 {
        env.storage().persistent().get(&DataKey::Pot(period)).unwrap_or(0)
    }
    pub fn health_factor(_env: Env, _member: Address) -> Option<u32> { Some(15000) }
    pub fn required_collateral(env: Env, _asset: u32) -> i128 { get_config(&env).collateral_requirement }
    pub fn collateral_unlock_at(env: Env) -> u64 { env.ledger().timestamp() + 86400 }
    pub fn graduates(env: Env) -> Vec<Address> { get_members(&env) }
}

fn get_config(env: &Env) -> GroupConfig {
    env.storage().instance().get(&DataKey::Config).unwrap()
}
fn get_state(env: &Env) -> GroupState {
    env.storage().instance().get(&DataKey::State).unwrap()
}
fn get_members(env: &Env) -> Vec<Address> {
    env.storage().instance().get(&DataKey::Members).unwrap_or(Vec::new(env))
}
fn get_member(env: &Env, addr: &Address) -> Member {
    env.storage().persistent().get(&DataKey::Member(addr.clone())).unwrap_or_else(|| {
        let config = get_config(env);
        Member {
            addr: addr.clone(),
            collateral_asset: CollateralAsset::Usdc,
            collateral_usdc: config.collateral_requirement,
            collateral_xlm: 0,
            has_won: false,
            in_default: false,
            removed: false,
            hf_breach_period: 0,
            joined_period: 1,
        }
    })
}
fn is_member(env: &Env, addr: &Address) -> bool {
    env.storage().persistent().has(&DataKey::Member(addr.clone()))
}
fn require_member(env: &Env, addr: &Address) {
    if !is_member(env, addr) {
        panic_with(env, Error::NotMember);
    }
}
fn remove_pending(env: &Env, applicant: &Address) {
    let pending: Vec<Address> = env
        .storage()
        .instance()
        .get(&DataKey::JoinReqList)
        .unwrap_or(Vec::new(env));
    let mut next = Vec::new(env);
    for a in pending.iter() {
        if &a != applicant {
            next.push_back(a);
        }
    }
    env.storage().instance().set(&DataKey::JoinReqList, &next);
}
fn log_history(env: &Env, kind: Symbol, actor: Address, amount: i128) {
    let state = get_state(env);
    let mut history: Vec<HistoryEntry> = env
        .storage()
        .instance()
        .get(&DataKey::History)
        .unwrap_or(Vec::new(env));
    history.push_back(HistoryEntry {
        period: state.current_period,
        timestamp: env.ledger().timestamp(),
        kind: kind.clone(),
        actor,
        amount,
        detail: kind,
    });
    while history.len() > MAX_HISTORY {
        history.remove(0);
    }
    env.storage().instance().set(&DataKey::History, &history);
}
fn panic_with(env: &Env, e: Error) -> ! {
    soroban_sdk::panic_with_error!(env, e)
}
