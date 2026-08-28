/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO?: string;

  /** Network this build's flat VITE_* ids describe: testnet | mainnet | public. */
  readonly VITE_NETWORK?: string;
  /** Network a first-time visitor lands on. Defaults to VITE_NETWORK. */
  readonly VITE_DEFAULT_NETWORK?: string;

  // Flat, single-network configuration. Applies to the network named by
  // VITE_NETWORK; the app still offers the other one using its built-in ids.
  readonly VITE_RPC_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_HORIZON_URL?: string;
  readonly VITE_FACTORY_ID?: string;
  readonly VITE_USDC_ID?: string;
  readonly VITE_XLM_ID?: string;
  readonly VITE_ORACLE_ID?: string;
  readonly VITE_ROUTER_ID?: string;
  readonly VITE_SPONSOR_URL?: string;

  // Per-network overrides, for configuring both networks in one build. These
  // take effect regardless of VITE_NETWORK; the flat vars above win over them
  // for the build's own network.
  readonly VITE_TESTNET_RPC_URL?: string;
  readonly VITE_TESTNET_NETWORK_PASSPHRASE?: string;
  readonly VITE_TESTNET_HORIZON_URL?: string;
  readonly VITE_TESTNET_FACTORY_ID?: string;
  readonly VITE_TESTNET_USDC_ID?: string;
  readonly VITE_TESTNET_XLM_ID?: string;
  readonly VITE_TESTNET_ORACLE_ID?: string;
  readonly VITE_TESTNET_ROUTER_ID?: string;
  readonly VITE_TESTNET_SPONSOR_URL?: string;

  readonly VITE_MAINNET_RPC_URL?: string;
  readonly VITE_MAINNET_NETWORK_PASSPHRASE?: string;
  readonly VITE_MAINNET_HORIZON_URL?: string;
  readonly VITE_MAINNET_FACTORY_ID?: string;
  readonly VITE_MAINNET_USDC_ID?: string;
  readonly VITE_MAINNET_XLM_ID?: string;
  readonly VITE_MAINNET_ORACLE_ID?: string;
  readonly VITE_MAINNET_ROUTER_ID?: string;
  readonly VITE_MAINNET_SPONSOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
