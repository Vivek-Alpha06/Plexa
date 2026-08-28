// Network + deployment configuration.
//
// Both Stellar networks are described here, not just the one the build was
// configured for, so a visitor can switch between them from the UI without a
// rebuild (see `setNetwork`). The choice is persisted in localStorage and
// resolved once at module load — which is why everything below stays a plain
// constant and switching networks reloads the page rather than re-threading
// state through the contract layer.

// `import.meta.env` is typed with named keys; we index it by computed prefix.
const env = import.meta.env as unknown as Record<string, string | undefined>;

export type NetworkId = "testnet" | "mainnet";

export interface NetworkConfig {
  id: NetworkId;
  label: string;
  rpcUrl: string;
  passphrase: string;
  horizonUrl: string;
  /** Path segment used by stellar.expert and Stellar Lab. */
  explorer: "public" | "testnet";
  factoryId: string;
  usdcId: string;
  xlmId: string;
  oracleId: string;
  routerId: string;
  sponsorUrl: string;
}

const STORAGE_KEY = "plexa_network_v1";

/** `public` is the Stellar CLI / SDK name for the network we call mainnet. */
export function normalizeNetworkId(v: string | null | undefined): NetworkId | null {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "mainnet" || s === "public" || s === "pubnet") return "mainnet";
  if (s === "testnet" || s === "test") return "testnet";
  return null;
}

/**
 * Live, public deployment of each network. These are contract ids, not
 * secrets, and compiling both sets in is precisely what lets the toggle work
 * on a build whose .env names only one network. Env vars still win — see
 * `resolve` below.
 */
const DEFAULTS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    id: "testnet",
    label: "Testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    explorer: "testnet",
    // Plexa v8 testnet deployment.
    factoryId: "CDOYIGNCIR4QTUTAUYEFSW7IJVS6ZMOFV6CW574VFGHQ5ZDCQCJZ4GDZ",
    usdcId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    xlmId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    oracleId: "CADEJYCKYSWL7V5HKMPV5ZYGLU7G6PCZ4WPASQT26FIGVSRIP3ZZ7DE5",
    // Mock Soroswap-compatible venue (contracts/swap): fills from its own reserve.
    routerId: "CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD",
    sponsorUrl: "",
  },
  mainnet: {
    id: "mainnet",
    label: "Mainnet",
    rpcUrl: "https://mainnet.sorobanrpc.com",
    passphrase: "Public Global Stellar Network ; September 2015",
    horizonUrl: "https://horizon.stellar.org",
    explorer: "public",
    factoryId: "CAOW3VCOWVX4VOM4IRG4QKFP7K5AQDXUPKTLSUMY3BINI64VFBELJTFO",
    // Circle USDC SAC.
    usdcId: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    // Native XLM SAC.
    xlmId: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    // Reflector CEX/DEX feed.
    oracleId: "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN",
    // Real Soroswap router (soroswap/core public/mainnet.contracts.json).
    routerId: "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
    sponsorUrl: "",
  },
};

/** Field -> env-var suffix, so one table drives every prefix we accept. */
const ENV_KEYS: Record<string, keyof NetworkConfig> = {
  RPC_URL: "rpcUrl",
  NETWORK_PASSPHRASE: "passphrase",
  HORIZON_URL: "horizonUrl",
  FACTORY_ID: "factoryId",
  USDC_ID: "usdcId",
  XLM_ID: "xlmId",
  ORACLE_ID: "oracleId",
  ROUTER_ID: "routerId",
  SPONSOR_URL: "sponsorUrl",
};

function overlay(cfg: NetworkConfig, prefix: string): NetworkConfig {
  const out = { ...cfg };
  for (const [suffix, field] of Object.entries(ENV_KEYS)) {
    const v = env[prefix + suffix];
    // An empty value counts as "not set" for ids and urls alike, so a
    // half-filled .env falls back to the built-in address rather than blanking
    // it and silently pointing the app at nothing.
    if (v !== undefined && v.trim() !== "") {
      (out as unknown as Record<string, string>)[field] = v.trim();
    }
  }
  return out;
}

/** Network this build's .env was written for. */
export const BUILD_NETWORK: NetworkId = normalizeNetworkId(env.VITE_NETWORK) ?? "testnet";

/** Network a first-time visitor lands on. */
export const DEFAULT_NETWORK: NetworkId =
  normalizeNetworkId(env.VITE_DEFAULT_NETWORK) ?? BUILD_NETWORK;

function resolve(id: NetworkId): NetworkConfig {
  let cfg = overlay(DEFAULTS[id], id === "mainnet" ? "VITE_MAINNET_" : "VITE_TESTNET_");
  // The flat, single-network vars (VITE_FACTORY_ID, …) describe whichever
  // network VITE_NETWORK names, so an existing .env keeps working untouched.
  if (BUILD_NETWORK === id) cfg = overlay(cfg, "VITE_");
  return cfg;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: resolve("testnet"),
  mainnet: resolve("mainnet"),
};

function readStored(): NetworkId | null {
  try {
    return normalizeNetworkId(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // private mode / storage disabled
  }
}

/** The network this page load is talking to. */
export const ACTIVE_NETWORK: NetworkId = readStored() ?? DEFAULT_NETWORK;

/** Full config for the active network. */
export const NET: NetworkConfig = NETWORKS[ACTIVE_NETWORK];

export const IS_MAINNET = ACTIVE_NETWORK === "mainnet";

/**
 * Switch networks and reload. The reload is deliberate: the RPC client,
 * contract ids and the wallet's network passphrase are all captured at module
 * load, so starting over is the only way to guarantee no request goes out
 * against the network the user just left.
 */
export function setNetwork(id: NetworkId): void {
  if (id === ACTIVE_NETWORK) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage unavailable — nothing to persist, but still reload below so the
    // user sees a consistent failure rather than a half-switched app.
  }
  window.location.reload();
}

/** Forget the stored choice and fall back to the build's default network. */
export function resetNetwork(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (ACTIVE_NETWORK !== DEFAULT_NETWORK) window.location.reload();
}

// ----------------------------------------------------- active-network exports
// Kept under the flat names the rest of the app already imports.
export const NETWORK: NetworkId = ACTIVE_NETWORK;
export const RPC_URL = NET.rpcUrl;
export const NETWORK_PASSPHRASE = NET.passphrase;
export const HORIZON_URL = NET.horizonUrl;
export const EXPLORER_NETWORK = NET.explorer;
export const FACTORY_ID = NET.factoryId;
export const USDC_ID = NET.usdcId;
export const XLM_ID = NET.xlmId;
export const ORACLE_ID = NET.oracleId;
export const ROUTER_ID = NET.routerId;

/**
 * Fee-sponsorship relayer (keeper/relayer.mjs). When set, member transactions
 * are wrapped in a fee bump and the relayer pays the network fee, so someone
 * holding no XLM can still join and contribute. Leave empty to disable —
 * members then pay their own fees, which is the normal Stellar behaviour.
 * Per-network, because a relayer is funded on one network only.
 */
export const SPONSOR_URL = NET.sponsorUrl.replace(/\/$/, "");

/**
 * Demo mode: run the whole app against an in-memory store (no Stellar network,
 * no browser wallet). Enable with VITE_DEMO=true in .env.
 */
export const DEMO = env.VITE_DEMO === "true";

/** True when reads/writes have a backend available (real factory or demo). */
export const CONFIGURED = DEMO || !!FACTORY_ID;

/** USDC on Stellar uses 7 decimal places. */
export const USDC_DECIMALS = 7;

/** Shared 7dp base-unit scale for XLM, USDC and oracle prices. */
export const UNIT_SCALE = 10_000_000n;

export function assertConfigured(): void {
  if (!CONFIGURED) {
    throw new Error(
      "VITE_FACTORY_ID is not set. Deploy the contracts (scripts/deploy.sh) and copy .env.example to .env."
    );
  }
}
