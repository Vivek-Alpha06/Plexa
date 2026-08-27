//! Plexa Multisig Smart Account — a Soroban custom account (account
//! abstraction) providing M-of-N approval for group actions.
//!
//! # Why this exists
//!
//! Everywhere else in Plexa, an `Address` that calls `require_auth()` is a
//! plain Stellar account: one key, one signature, one point of failure. For a
//! ROSCA that is wrong in both directions — the protocol admin is a single key
//! that can schedule upgrades on contracts holding member collateral, and a
//! savings circle has no way to express "the group agreed", only "one wallet
//! signed".
//!
//! A Soroban *custom account* fixes this. Any contract that implements
//! [`CustomAccountInterface`] can be used as an `Address`, and the host calls
//! its [`__check_auth`] to decide whether a signature set is acceptable. The
//! authorization rule becomes code we control, so `require_auth()` anywhere in
//! the group contract transparently means "M-of-N of this council approved",
//! with no change to the calling code.
//!
//! # Design: Stellar's own threshold model, in a smart contract
//!
//! Rather than a flat "M of N", this ports the model classic Stellar accounts
//! already use, because it is strictly more expressive and it is the mental
//! model Stellar developers already have:
//!
//! - every signer carries a **weight**, not just a vote;
//! - there are **three thresholds** — low, medium, high;
//! - the threshold required depends on **what is being authorized**.
//!
//! The last point is the part a flat multisig cannot express, and it is what
//! makes this practical. Requiring 4-of-7 to place an auction bid would make
//! the product unusable; requiring 1-of-7 to change the signer set would make
//! it insecure. So `__check_auth` inspects the `auth_contexts` the host hands
//! it and classifies the call:
//!
//! | Tier   | Examples                                             |
//! |--------|------------------------------------------------------|
//! | High   | signer/threshold changes, upgrades, dissolution      |
//! | Medium | moving value: contribute, top_up, claim, withdraw    |
//! | Low    | routine participation: bids, join votes              |
//!
//! A transaction authorizing several actions at once is held to the **highest**
//! tier among them, so a high-privilege call cannot be smuggled in alongside a
//! trivial one.
//!
//! # Security properties (each has a test)
//!
//! 1. A signature from a key that is not a signer is rejected.
//! 2. A forged/invalid signature is rejected by `ed25519_verify`.
//! 3. The same signer cannot be counted twice — signatures must be strictly
//!    ordered by public key, which makes duplicates unrepresentable rather
//!    than merely checked for.
//! 4. Weight below the required threshold is rejected.
//! 5. Administering the account requires the **high** threshold, and requires
//!    it *through* `__check_auth` — the account administers itself.
//! 6. The signer set can never be edited into a state whose total weight is
//!    below the high threshold, which would permanently lock the account.
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    panic_with_error, symbol_short, BytesN, Env, Map, Symbol, Vec,
};

#[contract]
pub struct MultisigAccount;

/// One signer's approval of the transaction's signature payload.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ed25519Signature {
    pub public_key: BytesN<32>,
    pub signature: BytesN<64>,
}

/// Which threshold a call must clear.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Low = 0,
    Medium = 1,
    High = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Map of ed25519 public key -> signing weight.
    Signers,
    /// (low, medium, high) thresholds.
    Thresholds,
}

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum MultisigError {
    /// A threshold was zero, which would let anyone authorize anything.
    ZeroThreshold = 1,
    /// Thresholds must satisfy low <= medium <= high.
    ThresholdsNotOrdered = 2,
    /// The signer set was empty, or a weight was zero.
    InvalidSigner = 3,
    /// A signature came from a key that is not in the signer set.
    UnknownSigner = 4,
    /// Signatures were not strictly ordered by public key (see property 3).
    SignaturesOutOfOrder = 5,
    /// Total weight of valid signatures was below the required threshold.
    InsufficientWeight = 6,
    /// No signatures were supplied.
    NoSignatures = 7,
    /// The edit would leave total weight below the high threshold, locking
    /// the account out of its own administration forever.
    WouldLockAccount = 8,
    /// Signer already present / not present.
    SignerExists = 9,
    SignerMissing = 10,
    /// `initialize` was called on an account that already has a signer set.
    AlreadyInitialized = 11,
}

// --------------------------------------------------------------- account API

#[contractimpl]
impl MultisigAccount {
    /// Initialize the account with its signer set and thresholds.
    ///
    /// Validates up front rather than trusting the caller: a zero threshold
    /// would make `__check_auth` a no-op, and thresholds out of order would
    /// make a "high" action easier to authorize than a low one.
    ///
    /// # Why `initialize` and not `__constructor`
    ///
    /// This account shares a crate with `GroupContract` so both live under
    /// `contracts/group/`. A wasm module can export only one `__constructor`
    /// symbol, so a second contract in the same crate cannot declare one.
    /// The guard below gives the same once-only guarantee; when this account
    /// is split into its own crate for deployment, this becomes a real
    /// `__constructor` with no other change to the logic.
    pub fn initialize(env: Env, signers: Map<BytesN<32>, u32>, low: u32, medium: u32, high: u32) {
        // Once-only: without this, anyone could re-point the signer set of a
        // live account at keys they control.
        if env.storage().instance().has(&DataKey::Signers) {
            panic_with_error!(&env, MultisigError::AlreadyInitialized);
        }
        if low == 0 || medium == 0 || high == 0 {
            panic_with_error!(&env, MultisigError::ZeroThreshold);
        }
        if low > medium || medium > high {
            panic_with_error!(&env, MultisigError::ThresholdsNotOrdered);
        }
        if signers.is_empty() {
            panic_with_error!(&env, MultisigError::InvalidSigner);
        }
        let mut total: u32 = 0;
        for (_, weight) in signers.iter() {
            if weight == 0 {
                panic_with_error!(&env, MultisigError::InvalidSigner);
            }
            total += weight;
        }
        // An account whose signers cannot together reach `high` can never be
        // administered again. Refuse to create it rather than brick it.
        if total < high {
            panic_with_error!(&env, MultisigError::WouldLockAccount);
        }

        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage()
            .instance()
            .set(&DataKey::Thresholds, &(low, medium, high));
    }

    /// Add a signer. Requires the high threshold, enforced via `__check_auth`
    /// because the account authorizes its own administration.
    pub fn add_signer(env: Env, public_key: BytesN<32>, weight: u32) {
        env.current_contract_address().require_auth();
        if weight == 0 {
            panic_with_error!(&env, MultisigError::InvalidSigner);
        }
        let mut signers = read_signers(&env);
        if signers.contains_key(public_key.clone()) {
            panic_with_error!(&env, MultisigError::SignerExists);
        }
        signers.set(public_key.clone(), weight);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.events()
            .publish((symbol_short!("sgnr_add"),), (public_key, weight));
    }

    /// Remove a signer, refusing any edit that would lock the account.
    pub fn remove_signer(env: Env, public_key: BytesN<32>) {
        env.current_contract_address().require_auth();
        let mut signers = read_signers(&env);
        if !signers.contains_key(public_key.clone()) {
            panic_with_error!(&env, MultisigError::SignerMissing);
        }
        signers.remove(public_key.clone());
        if signers.is_empty() {
            panic_with_error!(&env, MultisigError::WouldLockAccount);
        }

        let (_, _, high) = read_thresholds(&env);
        let total: u32 = signers.iter().map(|(_, w)| w).sum();
        if total < high {
            panic_with_error!(&env, MultisigError::WouldLockAccount);
        }

        env.storage().instance().set(&DataKey::Signers, &signers);
        env.events()
            .publish((symbol_short!("sgnr_rm"),), public_key);
    }

    /// Retune thresholds, refusing any value the signer set cannot reach.
    pub fn set_thresholds(env: Env, low: u32, medium: u32, high: u32) {
        env.current_contract_address().require_auth();
        if low == 0 || medium == 0 || high == 0 {
            panic_with_error!(&env, MultisigError::ZeroThreshold);
        }
        if low > medium || medium > high {
            panic_with_error!(&env, MultisigError::ThresholdsNotOrdered);
        }
        let signers = read_signers(&env);
        let total: u32 = signers.iter().map(|(_, w)| w).sum();
        if total < high {
            panic_with_error!(&env, MultisigError::WouldLockAccount);
        }
        env.storage()
            .instance()
            .set(&DataKey::Thresholds, &(low, medium, high));
        env.events()
            .publish((symbol_short!("thresh"),), (low, medium, high));
    }

    // ------------------------------------------------------------------ views

    pub fn signers(env: Env) -> Map<BytesN<32>, u32> {
        read_signers(&env)
    }

    pub fn thresholds(env: Env) -> (u32, u32, u32) {
        read_thresholds(&env)
    }

    /// Total weight available across all signers.
    pub fn total_weight(env: Env) -> u32 {
        read_signers(&env).iter().map(|(_, w)| w).sum()
    }

    /// Which tier a given function name falls into.
    ///
    /// Exposed as a view so a UI can tell a member "this needs 4 of 7" before
    /// they start collecting signatures, instead of after the call fails.
    pub fn tier_for(env: Env, fn_name: Symbol) -> Tier {
        classify_fn(&env, &fn_name)
    }

    /// Evaluate the authorization policy: verify signatures and check that
    /// their combined weight clears the threshold demanded by `fn_names`.
    ///
    /// This is the whole decision `__check_auth` makes, exposed as an ordinary
    /// entrypoint. The split exists because the host **reserves**
    /// `__check_auth` for its own use — invoking it directly fails with
    /// `Error(Context, InvalidAction)` — so policy kept only inside it could
    /// never be unit-tested, and untestable authorization logic is how
    /// multisig bugs survive to production. `__check_auth` is a thin wrapper
    /// that maps the host's `Context` list onto this function, so what the
    /// tests exercise is the same code path that runs in production.
    pub fn verify_auth(
        env: Env,
        payload: BytesN<32>,
        signatures: Vec<Ed25519Signature>,
        fn_names: Vec<Symbol>,
    ) -> Result<(), MultisigError> {
        let weight = sum_signature_weight(&env, &payload, &signatures)?;
        let required = threshold_for_fns(&env, &fn_names);
        if weight < required {
            return Err(MultisigError::InsufficientWeight);
        }
        Ok(())
    }

    /// Weight required to authorize a given function.
    pub fn required_weight(env: Env, fn_name: Symbol) -> u32 {
        let (low, medium, high) = read_thresholds(&env);
        match classify_fn(&env, &fn_name) {
            Tier::Low => low,
            Tier::Medium => medium,
            Tier::High => high,
        }
    }
}

// ------------------------------------------------------------ authorization

#[contractimpl]
impl CustomAccountInterface for MultisigAccount {
    type Signature = Vec<Ed25519Signature>;
    type Error = MultisigError;

    /// Decide whether this signature set authorizes these actions.
    ///
    /// The host calls this for every `require_auth()` naming this account. We
    /// verify each signature against the payload, sum the weights of distinct
    /// signers, and compare against the threshold demanded by the most
    /// privileged action in `auth_contexts`.
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signatures: Vec<Ed25519Signature>,
        auth_contexts: Vec<Context>,
    ) -> Result<(), MultisigError> {
        // Map the host's contexts onto function names, then apply exactly the
        // same policy the tests exercise through `verify_auth`.
        let mut fn_names = Vec::new(&env);
        for ctx in auth_contexts.iter() {
            match ctx {
                Context::Contract(c) => fn_names.push_back(c.fn_name),
                // Deploying a contract under this account's authority is as
                // privileged as it gets; name something that classifies High.
                Context::CreateContractHostFn(_) | Context::CreateContractWithCtorHostFn(_) => {
                    fn_names.push_back(Symbol::new(&env, "create_contract"))
                }
            }
        }

        let weight = sum_signature_weight(&env, &signature_payload.into(), &signatures)?;
        let required = threshold_for_fns(&env, &fn_names);
        if weight < required {
            return Err(MultisigError::InsufficientWeight);
        }
        Ok(())
    }
}

// ------------------------------------------------------------------ internals

fn read_signers(env: &Env) -> Map<BytesN<32>, u32> {
    env.storage()
        .instance()
        .get(&DataKey::Signers)
        .unwrap_or_else(|| Map::new(env))
}

fn read_thresholds(env: &Env) -> (u32, u32, u32) {
    env.storage()
        .instance()
        .get(&DataKey::Thresholds)
        .unwrap_or((1, 1, 1))
}

/// Classify a function name into a privilege tier.
///
/// Unknown functions default to **High**, not Low. A new entrypoint added
/// later should fail closed — needing more signatures than necessary is an
/// inconvenience, needing fewer is a vulnerability.
fn classify_fn(env: &Env, fn_name: &Symbol) -> Tier {
    // Administering this account, replacing code, or ending the group.
    if *fn_name == Symbol::new(env, "add_signer")
        || *fn_name == Symbol::new(env, "remove_signer")
        || *fn_name == Symbol::new(env, "set_thresholds")
        || *fn_name == Symbol::new(env, "propose_upgrade")
        || *fn_name == Symbol::new(env, "apply_upgrade")
        || *fn_name == Symbol::new(env, "cancel_upgrade")
        || *fn_name == Symbol::new(env, "set_admin")
        || *fn_name == Symbol::new(env, "transfer_admin")
        || *fn_name == Symbol::new(env, "propose_dissolution")
        || *fn_name == Symbol::new(env, "vote_on_dissolution")
    {
        return Tier::High;
    }

    // Anything that moves value.
    if *fn_name == Symbol::new(env, "contribute")
        || *fn_name == Symbol::new(env, "top_up")
        || *fn_name == Symbol::new(env, "lock_collateral")
        || *fn_name == Symbol::new(env, "claim_payout")
        || *fn_name == Symbol::new(env, "withdraw_collateral")
        || *fn_name == Symbol::new(env, "exit_forming")
    {
        return Tier::Medium;
    }

    // Routine participation: place_bid, request_join, vote_on_join, settle,
    // resolve_period.
    if *fn_name == Symbol::new(env, "place_bid")
        || *fn_name == Symbol::new(env, "request_join")
        || *fn_name == Symbol::new(env, "vote_on_join")
        || *fn_name == Symbol::new(env, "settle")
        || *fn_name == Symbol::new(env, "resolve_period")
    {
        return Tier::Low;
    }

    Tier::High
}

/// Verify every signature and return the combined weight of distinct signers.
///
/// Duplicates are prevented structurally: signatures must arrive in strictly
/// increasing public-key order, so a repeated key is not strictly increasing
/// and is rejected. This is cheaper than a seen-set and impossible to get
/// subtly wrong — the classic "present one approval twice to reach the
/// threshold" attack is unrepresentable rather than merely checked for.
fn sum_signature_weight(
    env: &Env,
    payload: &BytesN<32>,
    signatures: &Vec<Ed25519Signature>,
) -> Result<u32, MultisigError> {
    if signatures.is_empty() {
        return Err(MultisigError::NoSignatures);
    }
    let signers = read_signers(env);

    let mut total: u32 = 0;
    let mut previous: Option<BytesN<32>> = None;

    for sig in signatures.iter() {
        if let Some(prev) = &previous {
            if sig.public_key <= *prev {
                return Err(MultisigError::SignaturesOutOfOrder);
            }
        }
        previous = Some(sig.public_key.clone());

        let weight = signers
            .get(sig.public_key.clone())
            .ok_or(MultisigError::UnknownSigner)?;

        // Panics on a forged signature, aborting the call — the correct
        // outcome for an invalid approval.
        env.crypto()
            .ed25519_verify(&sig.public_key, &payload.clone().into(), &sig.signature);

        total += weight;
    }
    Ok(total)
}

/// Highest threshold demanded by any function in the batch.
///
/// Taking the maximum is what stops a privileged call being smuggled into a
/// transaction alongside a trivial one to borrow its lower threshold.
fn threshold_for_fns(env: &Env, fn_names: &Vec<Symbol>) -> u32 {
    let (low, medium, high) = read_thresholds(env);

    // An empty batch is not a free pass — charge the highest tier.
    if fn_names.is_empty() {
        return high;
    }

    let mut required = low;
    for name in fn_names.iter() {
        let w = match classify_fn(env, &name) {
            Tier::Low => low,
            Tier::Medium => medium,
            Tier::High => high,
        };
        if w > required {
            required = w;
        }
    }
    required
}
