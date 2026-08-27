// Sponsored reserves (CAP-33) — onboard a member who holds nothing at all.
//
// # Why this exists
//
// Fee sponsorship (see relayer.mjs) removes one barrier: the member no longer
// needs XLM to pay transaction fees. But it does not remove the other one.
// Stellar requires every account to hold a **minimum balance** locked forever,
// and every trustline adds to it:
//
//   minimum balance = (2 + numSubEntries) x baseReserve
//                   = (2 + 1 trustline) x 0.5 XLM
//                   = 1.5 XLM
//
// So a person with an empty wallet still cannot exist on the network, let
// alone hold USDC. Telling an unbanked user "first acquire 1.5 XLM from an
// exchange" reintroduces exactly the barrier Plexa exists to remove.
//
// CAP-33 solves this properly. Reserves can be **sponsored**: the ledger entry
// belongs to the member, but the locked XLM is held against the *sponsor's*
// balance. The member's account can hold a zero balance and still be a fully
// functional Stellar account with a USDC trustline.
//
// # The sandwich
//
// Sponsorship is expressed as a sandwich of operations. Everything between
// begin and end has its reserves charged to the sponsor:
//
//   beginSponsoringFutureReserves(sponsoredId = member)   source: sponsor
//     createAccount(destination = member, startingBalance = 0)
//     changeTrust(asset = USDC)                           source: member
//   endSponsoringFutureReserves()                         source: member
//
// Two details that are easy to get wrong and fatal if you do:
//
//  1. `endSponsoringFutureReserves` must be sourced by the **sponsored**
//     account, not the sponsor. An unbalanced sandwich fails the whole
//     transaction.
//  2. `createAccount` with `startingBalance: "0"` is only valid *inside* a
//     sponsorship sandwich. Outside one the network rejects it, because the
//     account could not meet its own minimum balance.
//
// Both accounts must sign: the sponsor is agreeing to lock the reserves, and
// the member is agreeing to the trustline and to ending the sandwich.
//
// # Getting the reserves back
//
// Sponsorship is not a donation — the sponsor's XLM is locked, not spent. When
// a member leaves the circle, `buildReclaimReserves` revokes the sponsorship
// so the locked XLM returns to the sponsor's available balance. A member who
// has since acquired their own XLM can take over their own reserves instead.
import {
  Account, Asset, BASE_FEE, Networks, Operation, TransactionBuilder,
} from "@stellar/stellar-sdk";

/** Stellar's base reserve, in XLM. Every ledger entry costs this much. */
export const BASE_RESERVE_XLM = 0.5;

/**
 * Reserve an account requires: 2 base reserves for the account itself, plus
 * one per subentry (a trustline is one subentry).
 */
export function minimumBalanceXlm(subentries = 0) {
  return (2 + subentries) * BASE_RESERVE_XLM;
}

/**
 * Build the sponsored-onboarding transaction.
 *
 * @param {object}  opts
 * @param {Account} opts.sponsorAccount  Loaded sponsor account (supplies the sequence number).
 * @param {string}  opts.sponsorPublicKey
 * @param {string}  opts.memberPublicKey  The new account being created.
 * @param {Asset}   [opts.asset]          Trustline to open, or null for none.
 * @param {string}  opts.networkPassphrase
 * @param {number}  [opts.timeout]
 * @returns {{tx: Transaction, reservesLockedXlm: number}}
 */
export function buildSponsoredOnboarding({
  sponsorAccount,
  sponsorPublicKey,
  memberPublicKey,
  asset = null,
  networkPassphrase = Networks.PUBLIC,
  timeout = 180,
}) {
  if (!sponsorPublicKey || !memberPublicKey) {
    throw new Error("sponsorPublicKey and memberPublicKey are required");
  }
  if (sponsorPublicKey === memberPublicKey) {
    throw new Error("an account cannot sponsor its own reserves");
  }

  const builder = new TransactionBuilder(sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  // --- open the sandwich: reserves from here on are charged to the sponsor
  builder.addOperation(
    Operation.beginSponsoringFutureReserves({
      sponsoredId: memberPublicKey,
      source: sponsorPublicKey,
    })
  );

  // startingBalance "0" is legal only inside the sandwich.
  builder.addOperation(
    Operation.createAccount({
      destination: memberPublicKey,
      startingBalance: "0",
      source: sponsorPublicKey,
    })
  );

  if (asset) {
    // Sourced by the member: it is their trustline, even though the sponsor
    // pays its reserve.
    builder.addOperation(
      Operation.changeTrust({ asset, source: memberPublicKey })
    );
  }

  // --- close the sandwich. Sourced by the SPONSORED account, not the sponsor.
  builder.addOperation(
    Operation.endSponsoringFutureReserves({ source: memberPublicKey })
  );

  return {
    tx: builder.setTimeout(timeout).build(),
    reservesLockedXlm: minimumBalanceXlm(asset ? 1 : 0),
  };
}

/**
 * Build a transaction returning sponsored reserves to the sponsor.
 *
 * Revoke the trustline sponsorship before the account sponsorship: revoking
 * the account first would leave the member owning a trustline whose reserve
 * they cannot cover, and the network rejects that.
 *
 * @param {object}  opts
 * @param {Account} opts.sponsorAccount
 * @param {string}  opts.sponsorPublicKey
 * @param {string}  opts.memberPublicKey
 * @param {Asset}   [opts.asset]  Trustline whose sponsorship to revoke.
 */
export function buildReclaimReserves({
  sponsorAccount,
  sponsorPublicKey,
  memberPublicKey,
  asset = null,
  networkPassphrase = Networks.PUBLIC,
  timeout = 180,
}) {
  const builder = new TransactionBuilder(sponsorAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  if (asset) {
    builder.addOperation(
      Operation.revokeTrustlineSponsorship({
        account: memberPublicKey,
        asset,
        source: sponsorPublicKey,
      })
    );
  }

  builder.addOperation(
    Operation.revokeAccountSponsorship({
      account: memberPublicKey,
      source: sponsorPublicKey,
    })
  );

  return { tx: builder.setTimeout(timeout).build() };
}

/**
 * What the sponsor must be able to lock to onboard `count` members.
 *
 * The sponsor also needs its own minimum balance on top, which is why this is
 * a floor rather than the full requirement — see `sponsorCapacity`.
 */
export function reservesRequiredFor(count, withTrustline = true) {
  return count * minimumBalanceXlm(withTrustline ? 1 : 0);
}

/**
 * How many members a sponsor with `balanceXlm` can still onboard, after
 * setting aside its own minimum balance and a working buffer for fees.
 */
export function sponsorCapacity(balanceXlm, { feeBufferXlm = 5, subentries = 0 } = {}) {
  const own = minimumBalanceXlm(subentries);
  const available = balanceXlm - own - feeBufferXlm;
  if (available <= 0) return 0;
  return Math.floor(available / minimumBalanceXlm(1));
}
