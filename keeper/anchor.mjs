// Anchor integration — SEP-1 discovery, SEP-10 auth, SEP-24 deposits and
// withdrawals, SEP-31 cross-border payments.
//
// # Why a ROSCA needs anchors
//
// Sponsored reserves and fee sponsorship get a member onto Stellar holding
// nothing. They do not get *money* in. A savings circle whose members cannot
// convert local cash into the asset they save in is a demo, not a product —
// and the people ROSCAs actually serve are precisely the ones without a card
// or an exchange account.
//
// Anchors are Stellar's answer: regulated businesses that bridge fiat and the
// network. A member deposits cash at an agent in their own city and USDC
// appears in their wallet; when their circle pays out, they withdraw the same
// way. That is the whole product loop, and it is why these SEPs matter more to
// Plexa than any on-chain feature.
//
//   SEP-1   stellar.toml — discover what an anchor supports
//   SEP-10  Web authentication — prove wallet ownership, get a JWT
//   SEP-24  Interactive deposit / withdrawal — fiat on and off ramp
//   SEP-31  Cross-border payments — remittance between two anchors
//
// # A note on SEP-10 and why it is handled carefully here
//
// SEP-10 is the security boundary for every other SEP: the JWT it issues is
// what authorizes deposits and withdrawals against a member's account. The
// flow is that the anchor hands you a "challenge" transaction and you sign it
// to prove you hold the key.
//
// The dangerous half is the half people skip. A challenge is an unsubmitted
// transaction that you are about to sign blind, so a hostile or spoofed server
// can hand you something that is not a challenge at all and harvest a
// signature. `validateChallenge` below therefore verifies the server's
// signature, the home domain, the web auth domain, and the sequence number
// **before** the key ever touches it. Signature checking is delegated to the
// SDK's `WebAuth` helpers rather than reimplemented.
import { Networks, StellarToml, WebAuth } from "@stellar/stellar-sdk";

/** Anchors must answer SEP-1 discovery within a sane time. */
const DEFAULT_TIMEOUT_MS = 15_000;

async function getJson(url, { method = "GET", headers = {}, body, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...headers },
    body,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${url} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(json.error || `${url} failed with ${res.status}`);
  }
  return json;
}

// ------------------------------------------------------------------- SEP-1

/**
 * Discover an anchor's capabilities from its `stellar.toml`.
 *
 * Returns only the endpoints Plexa uses, and says plainly which SEPs the
 * anchor actually supports rather than assuming.
 */
export async function discoverAnchor(homeDomain) {
  const toml = await StellarToml.Resolver.resolve(homeDomain, {
    timeout: DEFAULT_TIMEOUT_MS,
  });

  return {
    homeDomain,
    webAuthEndpoint: toml.WEB_AUTH_ENDPOINT ?? null,
    signingKey: toml.SIGNING_KEY ?? null,
    transferServerSep24: toml.TRANSFER_SERVER_SEP0024 ?? null,
    directPaymentServer: toml.DIRECT_PAYMENT_SERVER ?? null,
    kycServer: toml.KYC_SERVER ?? null,
    currencies: (toml.CURRENCIES ?? []).map((c) => ({
      code: c.code,
      issuer: c.issuer,
    })),
    supports: {
      sep10: Boolean(toml.WEB_AUTH_ENDPOINT && toml.SIGNING_KEY),
      sep24: Boolean(toml.TRANSFER_SERVER_SEP0024),
      sep31: Boolean(toml.DIRECT_PAYMENT_SERVER),
    },
  };
}

// ------------------------------------------------------------------ SEP-10

/**
 * Validate a SEP-10 challenge **before signing it**.
 *
 * This is the security-critical step. Checks, in order:
 *
 *  1. The server signed it with the `SIGNING_KEY` from its own stellar.toml —
 *     so a spoofed endpoint cannot mint challenges.
 *  2. Sequence number is 0, which is what makes a challenge unsubmittable. A
 *     non-zero sequence means you are being asked to sign a *real*
 *     transaction — the classic SEP-10 phishing vector.
 *  3. The `home_domain` matches the anchor we meant to talk to, so a
 *     signature obtained here cannot be replayed against a different anchor.
 *  4. The `web_auth_domain`, when present, matches the endpoint host.
 *
 * Throws with a specific reason rather than returning false, because every
 * failure here means "do not sign this".
 */
export function validateChallenge({
  challengeXdr,
  serverSigningKey,
  clientPublicKey,
  homeDomain,
  webAuthDomain,
  networkPassphrase = Networks.PUBLIC,
}) {
  if (!challengeXdr) throw new Error("anchor returned no challenge transaction");
  if (!serverSigningKey) throw new Error("anchor stellar.toml has no SIGNING_KEY");

  // readChallengeTx verifies the server signature and the SEP-10 shape, and
  // throws InvalidChallengeError otherwise.
  const { tx, clientAccountID, matchedHomeDomain } = WebAuth.readChallengeTx(
    challengeXdr,
    serverSigningKey,
    networkPassphrase,
    homeDomain,
    webAuthDomain ?? homeDomain
  );

  // Belt and braces: readChallengeTx enforces this, but a zero sequence is the
  // single property that makes the challenge unsubmittable, so assert it here
  // too rather than trusting a library detail to never regress.
  if (tx.sequence !== "0") {
    throw new Error(
      `challenge has sequence ${tx.sequence}, expected 0 — refusing to sign a submittable transaction`
    );
  }

  if (clientAccountID !== clientPublicKey) {
    throw new Error(
      `challenge is addressed to ${clientAccountID}, not ${clientPublicKey}`
    );
  }

  if (matchedHomeDomain !== homeDomain) {
    throw new Error(
      `challenge home_domain is ${matchedHomeDomain}, expected ${homeDomain}`
    );
  }

  return { tx, clientAccountID, matchedHomeDomain };
}

/**
 * Complete the SEP-10 flow and return a JWT.
 *
 * `signChallenge` is a callback so the member's secret key never has to reach
 * this module — a browser wallet or the relayer can supply the signature.
 */
export async function authenticate({
  anchor,
  clientPublicKey,
  signChallenge,
  networkPassphrase = Networks.PUBLIC,
}) {
  if (!anchor.supports.sep10) {
    throw new Error(`${anchor.homeDomain} does not support SEP-10`);
  }

  const url = new URL(anchor.webAuthEndpoint);
  url.searchParams.set("account", clientPublicKey);
  url.searchParams.set("home_domain", anchor.homeDomain);

  const { transaction, network_passphrase } = await getJson(url.toString());

  if (network_passphrase && network_passphrase !== networkPassphrase) {
    throw new Error(
      `anchor is on a different network: ${network_passphrase}`
    );
  }

  // Validate before signing. Never reorder these two lines.
  validateChallenge({
    challengeXdr: transaction,
    serverSigningKey: anchor.signingKey,
    clientPublicKey,
    homeDomain: anchor.homeDomain,
    webAuthDomain: new URL(anchor.webAuthEndpoint).host,
    networkPassphrase,
  });

  const signedXdr = await signChallenge(transaction);

  const { token } = await getJson(anchor.webAuthEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });

  if (!token) throw new Error("anchor did not return a SEP-10 token");
  return token;
}

// ------------------------------------------------------------------ SEP-24

/**
 * Start an interactive deposit: member pays fiat, receives the asset on chain.
 *
 * SEP-24 is deliberately *interactive* — the anchor owns KYC and payment
 * collection and hands back a URL to open. That is the point: Plexa never sees
 * identity documents or card details, which keeps a savings-circle app out of
 * scope for the compliance burden that would otherwise sink it.
 */
export async function startDeposit({
  anchor, token, assetCode, account, extra = {},
}) {
  if (!anchor.supports.sep24) {
    throw new Error(`${anchor.homeDomain} does not support SEP-24`);
  }
  const res = await getJson(
    `${anchor.transferServerSep24}/transactions/deposit/interactive`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ asset_code: assetCode, account, ...extra }),
    }
  );
  return { url: res.url, id: res.id, type: res.type };
}

/** Start an interactive withdrawal: member redeems the asset for fiat. */
export async function startWithdrawal({
  anchor, token, assetCode, account, extra = {},
}) {
  if (!anchor.supports.sep24) {
    throw new Error(`${anchor.homeDomain} does not support SEP-24`);
  }
  const res = await getJson(
    `${anchor.transferServerSep24}/transactions/withdraw/interactive`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ asset_code: assetCode, account, ...extra }),
    }
  );
  return { url: res.url, id: res.id, type: res.type };
}

/** Poll a SEP-24 transaction until it settles or fails. */
export async function getTransaction({ anchor, token, id }) {
  const url = new URL(`${anchor.transferServerSep24}/transaction`);
  url.searchParams.set("id", id);
  const { transaction } = await getJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return transaction;
}

/** SEP-24 statuses that mean the flow is over, one way or the other. */
export const TERMINAL_STATUSES = new Set([
  "completed",
  "refunded",
  "expired",
  "error",
  "no_market",
  "too_small",
  "too_large",
]);

export function isTerminal(status) {
  return TERMINAL_STATUSES.has(status);
}

// ------------------------------------------------------------------ SEP-31

/**
 * What a receiving anchor supports, and what KYC fields it demands.
 *
 * Always call this before building a payment: required fields differ by
 * corridor and by asset, and guessing them produces a rejected transaction
 * after the member has already committed funds.
 */
export async function getSep31Info({ anchor, token }) {
  if (!anchor.supports.sep31) {
    throw new Error(`${anchor.homeDomain} does not support SEP-31`);
  }
  return getJson(`${anchor.directPaymentServer}/info`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * Open a SEP-31 cross-border payment.
 *
 * SEP-31 is anchor-to-anchor: a sending business hands off to a receiving one,
 * which pays out in local currency. For Plexa this is the remittance corridor —
 * a member abroad funds a circle whose payouts land in the recipients' home
 * currency, without either side touching an exchange.
 */
export async function createSep31Payment({
  anchor, token, assetCode, amount, senderId, receiverId, fields = {},
}) {
  if (!anchor.supports.sep31) {
    throw new Error(`${anchor.homeDomain} does not support SEP-31`);
  }
  if (!(Number(amount) > 0)) {
    throw new Error("amount must be positive");
  }

  const res = await getJson(`${anchor.directPaymentServer}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: String(amount),
      asset_code: assetCode,
      sender_id: senderId,
      receiver_id: receiverId,
      fields,
    }),
  });

  return {
    id: res.id,
    // Where the sending side must deliver the asset.
    destination: res.stellar_account_id,
    memo: res.stellar_memo,
    memoType: res.stellar_memo_type,
  };
}

/**
 * Validate a payment against the anchor's declared requirements *before*
 * sending money, so a missing KYC field is a local error rather than a
 * stranded transfer.
 */
export function validateSep31Fields(info, assetCode, fields) {
  const asset = info?.receive?.[assetCode];
  if (!asset) {
    throw new Error(`anchor does not receive ${assetCode}`);
  }
  if (asset.enabled === false) {
    throw new Error(`${assetCode} is currently disabled at this anchor`);
  }

  const required = [];
  for (const [group, defs] of Object.entries(asset.fields ?? {})) {
    for (const [name, def] of Object.entries(defs ?? {})) {
      if (def?.optional) continue;
      if (fields?.[group]?.[name] === undefined) {
        required.push(`${group}.${name}`);
      }
    }
  }
  if (required.length) {
    throw new Error(`missing required field(s): ${required.join(", ")}`);
  }

  const amountMin = asset.min_amount;
  const amountMax = asset.max_amount;
  return { ok: true, amountMin, amountMax };
}
