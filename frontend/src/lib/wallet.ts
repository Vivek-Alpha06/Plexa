// Multi-provider wallet layer: Freighter and Albedo.
// The active provider is kept in module state (+ localStorage) so the non-React
// contract layer can sign without prop-drilling.
import {
  requestAccess,
  getAddress,
  signTransaction as freighterSign,
} from "@stellar/freighter-api";
import albedo from "@albedo-link/intent";
import { NETWORK_PASSPHRASE, NETWORK, DEMO } from "./config";
import { DEMO_ADDRESS } from "./demo";

export type Provider = "freighter" | "albedo";

const KEY_PROVIDER = "plexa_wallet_provider";
const KEY_ADDRESS = "plexa_wallet_address";

// Demo selection is per-tab (sessionStorage) so different tabs can act as
// different accounts, while groups/balances stay shared in localStorage.
const SKEY_PROVIDER = "plexa_demo_provider";
const SKEY_ADDRESS = "plexa_demo_address";

let active: Provider | null = DEMO
  ? (sessionStorage.getItem(SKEY_PROVIDER) as Provider | null) ?? null
  : (localStorage.getItem(KEY_PROVIDER) as Provider | null) ?? null;

/** Demo only: connect as a specific account (per-tab). */
export function connectDemoAs(address: string): string {
  active = "freighter";
  sessionStorage.setItem(SKEY_PROVIDER, "freighter");
  sessionStorage.setItem(SKEY_ADDRESS, address);
  return address;
}

export function getActiveProvider(): Provider | null {
  return active;
}

// Albedo wants "public" | "testnet"; map from our network name.
const albedoNetwork = NETWORK === "public" ? "public" : "testnet";

export async function connect(provider: Provider): Promise<string> {
  if (DEMO) {
    // Generic connect defaults to the first account; the demo picker uses
    // connectDemoAs() to choose a specific one.
    active = provider;
    sessionStorage.setItem(SKEY_PROVIDER, provider);
    if (!sessionStorage.getItem(SKEY_ADDRESS))
      sessionStorage.setItem(SKEY_ADDRESS, DEMO_ADDRESS);
    return sessionStorage.getItem(SKEY_ADDRESS) as string;
  }
  let address: string;
  if (provider === "freighter") {
    const res = await requestAccess();
    if ("error" in res && res.error) throw new Error(String(res.error));
    address = (res as { address: string }).address;
  } else {
    const res = await albedo.publicKey({});
    address = res.pubkey;
  }
  if (!address) throw new Error("Wallet did not return an address.");
  active = provider;
  localStorage.setItem(KEY_PROVIDER, provider);
  localStorage.setItem(KEY_ADDRESS, address);
  return address;
}

export async function getConnectedAddress(): Promise<string | null> {
  if (!active) return null;
  if (DEMO) return sessionStorage.getItem(SKEY_ADDRESS);
  if (active === "freighter") {
    try {
      const res = await getAddress();
      if ("error" in res && res.error) return null;
      return (res as { address: string }).address || null;
    } catch {
      return null;
    }
  }
  // Albedo has no silent session; restore the last-known pubkey.
  return localStorage.getItem(KEY_ADDRESS);
}

export function disconnect(): void {
  active = null;
  if (DEMO) {
    sessionStorage.removeItem(SKEY_PROVIDER);
    sessionStorage.removeItem(SKEY_ADDRESS);
    return;
  }
  localStorage.removeItem(KEY_PROVIDER);
  localStorage.removeItem(KEY_ADDRESS);
}

export async function signTx(xdr: string, address: string): Promise<string> {
  if (active === "albedo") {
    const res = await albedo.tx({
      xdr,
      network: albedoNetwork,
      pubkey: address,
    });
    return res.signed_envelope_xdr;
  }
  // default: Freighter.
  // Guard against the #1 cause of `txBadAuth`: the transaction's source account
  // (`address`) differs from whichever account is currently active in Freighter.
  // Freighter would sign with the active account, producing a signature that
  // doesn't match the source -> the network rejects it at submit. Catch it here
  // with an actionable message instead of a cryptic result code.
  const live = await getAddress();
  const activeAddr =
    !("error" in live && live.error) ? (live as { address: string }).address : "";
  if (activeAddr && activeAddr !== address) {
    throw new Error(
      `Freighter's active account (${activeAddr.slice(0, 6)}…${activeAddr.slice(-4)}) ` +
        `does not match this transaction's account (${address.slice(0, 6)}…${address.slice(-4)}). ` +
        `Switch Freighter to ${address.slice(0, 6)}…${address.slice(-4)}, then disconnect and reconnect.`
    );
  }
  const res = await freighterSign(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  if (typeof res === "string") return res;
  if ("error" in res && res.error) throw new Error(String(res.error));
  return (res as { signedTxXdr: string }).signedTxXdr;
}
