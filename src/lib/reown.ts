import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { defineChain } from "@reown/appkit/networks";
import { network, ACTIVE_NETWORK, WALLETCONNECT_PROJECT_ID } from "../config";

/**
 * Reown AppKit (formerly WalletConnect Web3Modal) — this renders the
 * "Connect a Wallet" modal and manages the EVM connection. It replaces the
 * previous hashconnect/HashPack integration; HashPack, MetaMask, Rainbow,
 * WalletConnect, etc. all connect through this one modal.
 *
 * Hedera's EVM is exposed as a standard eip155 chain via the Hashio JSON-RPC
 * relay, so the ethers adapter works unchanged.
 */

const hederaChain = defineChain({
  id: network.chainId,
  caipNetworkId: `eip155:${network.chainId}`,
  chainNamespace: "eip155",
  name: network.chainName,
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: { default: { http: [network.rpcUrl] } },
  blockExplorers: {
    default: { name: "HashScan", url: network.hashscanUrl },
  },
  testnet: ACTIVE_NETWORK === "testnet",
});

export const appkitModal = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [hederaChain],
  defaultNetwork: hederaChain,
  projectId: WALLETCONNECT_PROJECT_ID,
  metadata: {
    name: "Memegraph",
    description:
      "Meme launchpad on Hedera — creators earn a network-enforced royalty on every transfer.",
    url: "https://memegraph-interface.vercel.app",
    icons: ["https://memegraph-interface.vercel.app/favicon.svg"],
  },
  // Wallets only — no email/social login (matches the reference modal)
  features: {
    analytics: false,
    email: false,
    socials: [],
  },
});
