# Five Soroban bugs that only show up on mainnet

*A technical write-up from building Plexa, a ROSCA (rotating savings circle)
protocol on Stellar Soroban.*

Every one of these passed local unit tests. Every one of them cost real
debugging time on a live network, and four of the five would have silently lost
or frozen user funds. They are written up here because none of them are
Plexa-specific — any Soroban contract that touches an AMM, draws a random
winner, or expects to be upgradable can hit them.

---

## 1. `env.prng()` makes your storage footprint non-deterministic

**Symptom:** a transaction simulates cleanly, then traps on submission with
`scecExceededLimit — trying to access contract data key outside of the
footprint`. Intermittently. It works maybe one time in *N*, where *N* is the
number of candidates.

Plexa's auction picks a winner among eligible members. When nobody bids, the
original code fell back to a random draw:

```rust
let winner = eligible.get(env.prng().gen_range(0..eligible.len())).unwrap();
env.storage().persistent().set(&DataKey::Claimable(winner), &amount);
```

Soroban transactions declare their storage footprint up front. Preflight runs
the contract, sees the draw pick member A, and declares `Claimable(A)`.
Execution runs with a *different* PRNG seed, draws member B, and tries to write
`Claimable(B)` — a key that was never declared. The host traps.

The failure is intermittent, which is what makes it expensive: groups advance
normally for several periods, then wedge permanently.

**Two fixes, and the second is better.**

The mechanical fix is to pre-touch every key the draw could possibly write, so
the footprint covers all outcomes:

```rust
for m in eligible.iter() {
    let _: Option<i128> = env.storage().persistent().get(&DataKey::Claimable(m));
}
```

But there is a second problem the footprint fix does not solve: whoever submits
the transaction can *simulate it first*, see who wins, and only broadcast when
the result favours them. A PRNG that the submitter can preview is not a fair
lottery.

So Plexa removed randomness entirely. The no-bid winner is now fixed rotation —
the earliest joiner who hasn't won yet:

```rust
let winner = eligible.get(0).unwrap();   // deterministic, unpreviewable-because-known
```

**Lesson:** on Soroban, `env.prng()` is not a drop-in `rand`. If a random value
determines *which storage key you write*, it breaks preflight. If it determines
*who gets money*, it is submitter-previewable. Prefer determinism.

---

## 2. AMM routers pull tokens into the *pair*, not the router

Plexa liquidates collateral through Soroswap when a member defaults. The
authorization looked reasonable:

```rust
// WRONG — router is not the recipient
authorize_transfer(from: group, to: router_address, amount);
```

Soroswap's router doesn't hold your tokens. It instructs the *pair* contract to
pull them. The authorization named the wrong recipient, so the transfer failed
auth every time.

**Lesson:** before authorizing a transfer into a DEX, trace which contract
actually calls `transfer_from`. It is usually the pool, not the entry-point
router you called.

---

## 3. Soroban matches auth on *exact* arguments — so quote from the venue

Having fixed the recipient, the next version sized the approval from our own
price oracle:

```rust
let amount_in = oracle_price(...) * needed;   // WRONG source of truth
authorize_transfer(from: group, to: pair, amount_in);
```

Soroban's authorization framework matches on the exact argument values. The AMM
quotes off its own reserves, not off your oracle, so the amount it tried to pull
never equalled the amount we authorized — off by slippage every time.

The fix is to ask the venue what it will take:

```rust
let amounts = router_get_amounts_in(amount_out, path);
authorize_transfer(from: group, to: pair, amounts.get(0).unwrap());
```

**Lesson:** an oracle tells you what something is *worth*. Only the venue can
tell you what it will *charge*. Authorize the second number.

---

## 4. `deadline: 0` means "already expired"

```rust
router.swap_tokens_for_exact_tokens(&amount_out, &max_in, &path, &to, &0);
```

Every swap failed. Soroswap — like Uniswap, whose interface it follows — treats
the deadline as an absolute timestamp and rejects when `now >= deadline`. Zero
is not "no deadline". Zero is the beginning of time, and it is always in the
past.

Worse, our *mock* router in the test suite had a `deadline != 0` escape hatch,
so the entire test suite passed against a contract that would never work
against the real thing.

```rust
let deadline = env.ledger().timestamp() + SWAP_DEADLINE_SECS;
```

**Lesson:** if you write a mock for an external protocol, make the mock
*stricter* than the real thing, never more permissive. A lenient mock is worse
than no mock — it converts an integration bug into a false pass.

---

## 5. A swap venue that can't fill will brick your contract

The first four bugs each caused a failed transaction. This one caused something
worse.

`invoke_contract` traps the whole transaction when the callee panics. Our
liquidation path called the router directly, so when the pool was too thin to
fill the swap, the trap propagated up and killed the enclosing call. Because
settlement runs inside `settle`, and `place_bid` / `resolve_period` both call
`settle`, a dry router meant *no group operation could run at all* — no
settling, no bidding, no resolving, no withdrawing. Unrecoverable, with member
funds inside.

```rust
// Degrade to debt instead of trapping.
match router.try_swap_tokens_for_exact_tokens(...) {
    Ok(Ok(_)) => { /* liquidated */ }
    _ => record_debt(&env, &member, shortfall),
}
```

Now an unfillable swap records the shortfall as member debt and the cycle
continues. Liquidity can return later; frozen funds cannot.

**Lesson:** any cross-contract call to a protocol you don't control is a
liveness dependency. Use `try_invoke_contract` and define what the degraded
state looks like — especially on a path that custodies funds.

---

## Bonus: two build-level traps

**Build for `wasm32v1-none`, not `wasm32-unknown-unknown`.** Rust 1.96+ emits
reference-types and multivalue for the latter, and the network rejects the
upload:

```
WasmVm InvalidAction: "reference-types not enabled" @offset 29230
```

Setting `RUSTFLAGS=-Ctarget-feature=-reference-types,-multivalue` does *not*
fix it. Changing the target does:

```bash
cargo build --target wasm32v1-none --release
```

**Add an upgrade entrypoint before you deploy, not after.** Soroban contracts
are not upgradable by default. A contract without `update_current_contract_wasm`
is frozen forever — including its bugs. If your contract custodies funds, decide
your upgrade authority *and its constraints* (timelock, multisig) before the
first mainnet deploy, because you cannot add them later.

And one subtlety worth stating plainly: if `upgrade` reads its authority from a
self-declared config field, an attacker can deploy your *hash-identical* wasm
with that field pointing at a contract they control, then upgrade it and drain
anyone who joined. Pin the authority in the constructor, and give your factory
an `is_group()` view so the UI can refuse unregistered deployments.

---

## Source

Plexa is open source: **https://github.com/Vivek-Alpha06/Plexa**

The relevant code is in `contracts/group/src/lib.rs` (settlement, auction,
liquidation) and `contracts/oracle/src/lib.rs` (a Reflector price adapter). The
regression tests for bugs 1–5 are in the same crates' `test.rs` files.

*Written by the Plexa team for the Stellar developer community. Corrections and
questions welcome via GitHub issues.*
