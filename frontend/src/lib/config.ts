// Network + deployment configuration, sourced from Vite env vars (.env).

export const NETWORK = import.meta.env.VITE_NETWORK ?? "testnet";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
export const FACTORY_ID = import.meta.env.VITE_FACTORY_ID ?? "";
export const USDC_ID = import.meta.env.VITE_USDC_ID ?? "";
export const XLM_ID = import.meta.env.VITE_XLM_ID ?? "";
export const ORACLE_ID = import.meta.env.VITE_ORACLE_ID ?? "";
export const ROUTER_ID = import.meta.env.VITE_ROUTER_ID ?? "";

/**
 * Demo mode: run the whole app against an in-memory store (no Stellar network,
 * no browser wallet). Enable with VITE_DEMO=true in .env.
 */
export const DEMO = import.meta.env.VITE_DEMO === "true";

/** True when reads/writes have a backend available (real factory or demo). */
export const CONFIGURED = DEMO || !!FACTORY_ID;

/** USDC on Stellar uses 7 decimal places. */
export const USDC_DECIMALS = 7;

export function assertConfigured(): void {
  if (!CONFIGURED) {
    throw new Error(
      "VITE_FACTORY_ID is not set. Deploy the contracts (scripts/deploy.sh) and copy .env.example to .env."
    );
  }
}
