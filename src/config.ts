/** Network + contract configuration. */

export const NETWORKS = {
  testnet: {
    chainId: 296,
    chainIdHex: "0x128",
    chainName: "Hedera Testnet",
    rpcUrl: "https://testnet.hashio.io/api",
    mirrorNodeUrl: "https://testnet.mirrornode.hedera.com/api/v1",
    hashscanUrl: "https://hashscan.io/testnet",
    factoryAddress: "0xeB14C2953f2D84b010aFAeA3bcFF7702003BED52",
  },
  mainnet: {
    chainId: 295,
    chainIdHex: "0x127",
    chainName: "Hedera Mainnet",
    rpcUrl: "https://mainnet.hashio.io/api",
    mirrorNodeUrl: "https://mainnet.mirrornode.hedera.com/api/v1",
    hashscanUrl: "https://hashscan.io/mainnet",
    factoryAddress: "",
  },
} as const;

export const ACTIVE_NETWORK: keyof typeof NETWORKS = "testnet";

export const network = NETWORKS[ACTIVE_NETWORK];

/** HBAR to send with a launch: covers pool seed (5) + HTS creation fee (~$2). */
export const LAUNCH_VALUE_HBAR = "50";

/** Default slippage tolerance (bps) — generous because of the 1% network royalty. */
export const DEFAULT_SLIPPAGE_BPS = 300;

/** HCS topic holding meme provenance claims (see api/claim.ts). */
export const CLAIMS_TOPIC_ID = "0.0.9638085";

/** WalletConnect Cloud project id (public — ships in the bundle either way). */
export const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ??
  "7b393fedd31f4d3ec6c6fafc963b5c44";
