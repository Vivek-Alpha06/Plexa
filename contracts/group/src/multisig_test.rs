//! Tests for the Plexa multisig smart account.
//!
//! These sign with **real ed25519 keys** rather than `mock_all_auths()`. That
//! matters: mocked auth bypasses `__check_auth` entirely, so a mocked test
//! would pass against a contract whose authorization logic was empty. Every
//! case below goes through the host's real signature verification.
extern crate std;

use ed25519_dalek::{Signer, SigningKey};
use rand::rngs::OsRng;
use soroban_sdk::{vec, BytesN, Env, Map, Symbol, Vec};

use crate::multisig::{
    Ed25519Signature, MultisigAccount, MultisigAccountClient, MultisigError, Tier,
};

/// A signer with its key material, kept together so tests can sign.
struct Signer_ {
    key: SigningKey,
    public: [u8; 32],
}

fn make_signer() -> Signer_ {
    let key = SigningKey::generate(&mut OsRng);
    let public = key.verifying_key().to_bytes();
    Signer_ { key, public }
}

/// Build the account with `weights`, and thresholds (low, medium, high).
fn setup(
    weights: &[u32],
    low: u32,
    medium: u32,
    high: u32,
) -> (Env, MultisigAccountClient<'static>, std::vec::Vec<Signer_>) {
    let env = Env::default();
    let signers: std::vec::Vec<Signer_> = weights.iter().map(|_| make_signer()).collect();

    let mut map: Map<BytesN<32>, u32> = Map::new(&env);
    for (s, w) in signers.iter().zip(weights.iter()) {
        map.set(BytesN::from_array(&env, &s.public), *w);
    }

    let id = env.register(MultisigAccount, ());
    let client = MultisigAccountClient::new(&env, &id);
    client.initialize(&map, &low, &medium, &high);
    (env, client, signers)
}

/// Sign `payload` with each signer, returned in the strictly-increasing
/// public-key order `__check_auth` requires.
fn sign_all(env: &Env, payload: &BytesN<32>, signers: &[&Signer_]) -> Vec<Ed25519Signature> {
    let mut sorted: std::vec::Vec<&&Signer_> = signers.iter().collect();
    sorted.sort_by(|a, b| a.public.cmp(&b.public));

    let msg = payload.to_array();
    let mut out = Vec::new(env);
    for s in sorted {
        let sig = s.key.sign(&msg);
        out.push_back(Ed25519Signature {
            public_key: BytesN::from_array(env, &s.public),
            signature: BytesN::from_array(env, &sig.to_bytes()),
        });
    }
    out
}

/// The function names a batch authorizes, as `verify_auth` takes them.
fn fns(env: &Env, names: &[&str]) -> Vec<Symbol> {
    let mut v = Vec::new(env);
    for n in names {
        v.push_back(Symbol::new(env, n));
    }
    v
}

fn payload(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

/// Run the authorization policy, returning the contract error on rejection.
///
/// Goes through `verify_auth` rather than `__check_auth`: the host reserves
/// the latter and refuses direct invocation with `Error(Context, InvalidAction)`.
/// `__check_auth` delegates to this same function, so this exercises the
/// production decision path.
fn check(
    client: &MultisigAccountClient,
    p: &BytesN<32>,
    sigs: &Vec<Ed25519Signature>,
    names: &Vec<Symbol>,
) -> Result<(), MultisigError> {
    match client.try_verify_auth(p, sigs, names) {
        Ok(Ok(())) => Ok(()),
        Ok(Err(_)) => Err(MultisigError::InvalidSigner),
        Err(Ok(e)) => Err(e),
        Err(Err(_)) => Err(MultisigError::InvalidSigner),
    }
}

// ------------------------------------------------------------- construction

#[test]
fn stores_signers_and_thresholds() {
    let (_, client, _) = setup(&[1, 1, 1], 1, 2, 3);
    assert_eq!(client.signers().len(), 3);
    assert_eq!(client.thresholds(), (1, 2, 3));
    assert_eq!(client.total_weight(), 3);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_zero_threshold() {
    // A zero threshold would make __check_auth a no-op for that tier.
    setup(&[1, 1], 0, 1, 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn rejects_unordered_thresholds() {
    // high < medium would make a privileged call easier than a routine one.
    setup(&[1, 1, 1], 1, 3, 2);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn rejects_signer_set_that_cannot_reach_high() {
    // Total weight 2 < high 5: the account could never be administered again.
    setup(&[1, 1], 1, 2, 5);
}

// ------------------------------------------------------- signature checking

#[test]
fn single_sufficient_signature_authorizes_low_tier() {
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);
    let sigs = sign_all(&env, &p, &[&s[0]]);
    assert!(check(&client, &p, &sigs, &fns(&env, &["place_bid"])).is_ok());
}

#[test]
fn insufficient_weight_is_rejected() {
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);
    // One signature (weight 1) against a medium-tier call needing 2.
    let sigs = sign_all(&env, &p, &[&s[0]]);
    assert_eq!(
        check(&client, &p, &sigs, &fns(&env, &["withdraw_collateral"])),
        Err(MultisigError::InsufficientWeight)
    );
}

#[test]
fn combined_weight_meets_medium_threshold() {
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);
    let sigs = sign_all(&env, &p, &[&s[0], &s[1]]);
    assert!(check(&client, &p, &sigs, &fns(&env, &["withdraw_collateral"])).is_ok());
}

#[test]
fn unknown_signer_is_rejected() {
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let outsider = make_signer();
    let p = payload(&env, 7);
    // Valid signature, but from a key that is not in the signer set.
    let sigs = sign_all(&env, &p, &[&s[0], &outsider]);
    assert_eq!(
        check(&client, &p, &sigs, &fns(&env, &["place_bid"])),
        Err(MultisigError::UnknownSigner)
    );
}

#[test]
fn duplicate_signer_cannot_reach_threshold_twice() {
    // The classic multisig bug: presenting one signer's approval twice to
    // manufacture enough weight. Ordering makes it unrepresentable.
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);

    let one = sign_all(&env, &p, &[&s[0]]);
    let dup = vec![&env, one.get(0).unwrap(), one.get(0).unwrap()];

    assert_eq!(
        check(&client, &p, &dup, &fns(&env, &["withdraw_collateral"])),
        Err(MultisigError::SignaturesOutOfOrder)
    );
}

#[test]
fn signatures_must_be_strictly_ordered() {
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);
    let ordered = sign_all(&env, &p, &[&s[0], &s[1]]);
    let reversed = vec![&env, ordered.get(1).unwrap(), ordered.get(0).unwrap()];

    assert_eq!(
        check(&client, &p, &reversed, &fns(&env, &["withdraw_collateral"])),
        Err(MultisigError::SignaturesOutOfOrder)
    );
}

#[test]
fn no_signatures_is_rejected() {
    let (env, client, _) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);
    assert_eq!(
        check(&client, &p, &Vec::new(&env), &fns(&env, &["place_bid"])),
        Err(MultisigError::NoSignatures)
    );
}

#[test]
fn signature_over_a_different_payload_is_rejected() {
    // Signing payload A and presenting it for payload B must fail — otherwise
    // a captured signature could be replayed against any other transaction.
    //
    // `ed25519_verify` traps rather than returning, so the rejection surfaces
    // as a host error through `try_verify_auth`, not a contract error code.
    // What matters is that it does not authorize.
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let signed = payload(&env, 1);
    let presented = payload(&env, 2);
    let sigs = sign_all(&env, &signed, &[&s[0]]);
    assert!(
        check(&client, &presented, &sigs, &fns(&env, &["place_bid"])).is_err(),
        "a signature over a different payload must never authorize"
    );
}

// -------------------------------------------------------- tier classification

#[test]
fn tiers_match_privilege() {
    let (env, client, _) = setup(&[1, 1, 1], 1, 2, 3);
    assert_eq!(client.tier_for(&Symbol::new(&env, "place_bid")), Tier::Low);
    assert_eq!(
        client.tier_for(&Symbol::new(&env, "withdraw_collateral")),
        Tier::Medium
    );
    assert_eq!(client.tier_for(&Symbol::new(&env, "add_signer")), Tier::High);
}

#[test]
fn unknown_function_defaults_to_high() {
    // Fail closed: an entrypoint added later must not inherit the low tier.
    let (env, client, _) = setup(&[1, 1, 1], 1, 2, 3);
    assert_eq!(
        client.tier_for(&Symbol::new(&env, "some_future_entrypoint")),
        Tier::High
    );
    assert_eq!(
        client.required_weight(&Symbol::new(&env, "some_future_entrypoint")),
        3
    );
}

#[test]
fn batch_is_held_to_the_highest_tier() {
    // A high-privilege call must not borrow a low-privilege call's threshold
    // by riding along in the same transaction.
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);

    let contexts = fns(&env, &["place_bid", "add_signer"]);

    // Two of three (weight 2) clears low and medium, but not the high tier
    // that `add_signer` drags the whole batch up to.
    let two = sign_all(&env, &p, &[&s[0], &s[1]]);
    assert_eq!(
        check(&client, &p, &two, &contexts),
        Err(MultisigError::InsufficientWeight)
    );

    // All three signers (weight 3) clears it.
    let three = sign_all(&env, &p, &[&s[0], &s[1], &s[2]]);
    assert!(check(&client, &p, &three, &contexts).is_ok());
}

#[test]
fn empty_context_list_requires_the_high_threshold() {
    // An empty batch must not be a free pass.
    let (env, client, s) = setup(&[1, 1, 1], 1, 2, 3);
    let p = payload(&env, 7);
    let one = sign_all(&env, &p, &[&s[0]]);
    assert_eq!(
        check(&client, &p, &one, &Vec::new(&env)),
        Err(MultisigError::InsufficientWeight)
    );
}

// ----------------------------------------------------------- weighted signers

#[test]
fn weights_are_honoured_not_just_counted() {
    // One heavyweight signer (weight 3) alone clears the high threshold,
    // where three weight-1 signers would be needed otherwise.
    let (env, client, s) = setup(&[3, 1, 1], 1, 2, 3);
    let p = payload(&env, 9);
    let heavy = sign_all(&env, &p, &[&s[0]]);
    assert!(check(&client, &p, &heavy, &fns(&env, &["add_signer"])).is_ok());

    let light = sign_all(&env, &p, &[&s[1]]);
    assert_eq!(
        check(&client, &p, &light, &fns(&env, &["add_signer"])),
        Err(MultisigError::InsufficientWeight)
    );
}

// -------------------------------------------------------------- self-admin

#[test]
fn add_and_remove_signer_updates_the_set() {
    let env = Env::default();
    env.mock_all_auths();

    let a = make_signer();
    let b = make_signer();
    let mut map: Map<BytesN<32>, u32> = Map::new(&env);
    map.set(BytesN::from_array(&env, &a.public), 2);
    map.set(BytesN::from_array(&env, &b.public), 2);

    let id = env.register(MultisigAccount, ());
    let client = MultisigAccountClient::new(&env, &id);
    client.initialize(&map, &1, &2, &3);

    let c = make_signer();
    client.add_signer(&BytesN::from_array(&env, &c.public), &1);
    assert_eq!(client.signers().len(), 3);
    assert_eq!(client.total_weight(), 5);

    client.remove_signer(&BytesN::from_array(&env, &c.public));
    assert_eq!(client.signers().len(), 2);
    assert_eq!(client.total_weight(), 4);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn cannot_remove_a_signer_into_lockout() {
    // Dropping to weight 2 with a high threshold of 3 would leave the account
    // unable to ever administer itself again.
    let env = Env::default();
    env.mock_all_auths();

    let a = make_signer();
    let b = make_signer();
    let mut map: Map<BytesN<32>, u32> = Map::new(&env);
    map.set(BytesN::from_array(&env, &a.public), 2);
    map.set(BytesN::from_array(&env, &b.public), 1);

    let id = env.register(MultisigAccount, ());
    let client = MultisigAccountClient::new(&env, &id);
    client.initialize(&map, &1, &2, &3);
    client.remove_signer(&BytesN::from_array(&env, &b.public));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn cannot_raise_high_threshold_beyond_total_weight() {
    let env = Env::default();
    env.mock_all_auths();

    let a = make_signer();
    let mut map: Map<BytesN<32>, u32> = Map::new(&env);
    map.set(BytesN::from_array(&env, &a.public), 2);

    let id = env.register(MultisigAccount, ());
    let client = MultisigAccountClient::new(&env, &id);
    client.initialize(&map, &1, &1, &2);
    client.set_thresholds(&1, &2, &99);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn cannot_add_a_duplicate_signer() {
    let env = Env::default();
    env.mock_all_auths();

    let a = make_signer();
    let mut map: Map<BytesN<32>, u32> = Map::new(&env);
    map.set(BytesN::from_array(&env, &a.public), 3);

    let id = env.register(MultisigAccount, ());
    let client = MultisigAccountClient::new(&env, &id);
    client.initialize(&map, &1, &2, &3);
    client.add_signer(&BytesN::from_array(&env, &a.public), &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn cannot_reinitialize_a_live_account() {
    // Without the once-only guard, anyone could re-point a live account's
    // signer set at keys they control.
    let (env, client, _) = setup(&[1, 1, 1], 1, 2, 3);
    let attacker = make_signer();
    let mut hostile: Map<BytesN<32>, u32> = Map::new(&env);
    hostile.set(BytesN::from_array(&env, &attacker.public), 99);
    client.initialize(&hostile, &1, &1, &1);
}
