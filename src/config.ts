/** Network + contract configuration. Addresses filled in after deployment. */

export const NETWORKS = {
  testnet: {
    chainId: 296,
    rpcUrl: "https://testnet.hashio.io/api",
    mirrorNodeUrl: "https://testnet.mirrornode.hedera.com/api/v1",
    hashscanUrl: "https://hashscan.io/testnet",
    factoryAddress: "", // set after `npm run deploy:testnet` in memegraph-contracts
  },
  mainnet: {
    chainId: 295,
    rpcUrl: "https://mainnet.hashio.io/api",
    mirrorNodeUrl: "https://mainnet.mirrornode.hedera.com/api/v1",
    hashscanUrl: "https://hashscan.io/mainnet",
    factoryAddress: "",
  },
} as const;

export const ACTIVE_NETWORK: keyof typeof NETWORKS = "testnet";

export const network = NETWORKS[ACTIVE_NETWORK];
