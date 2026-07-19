/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcProvider, type Signer } from "ethers";
import { network } from "../config";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

/** Read-only provider — works with no wallet installed. */
export const readProvider = new JsonRpcProvider(network.rpcUrl, network.chainId, {
  batchMaxCount: 1, // Hashio doesn't accept JSON-RPC batches
});

type WalletState = {
  account: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  getSigner: () => Promise<Signer>;
  hasWallet: boolean;
};

const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const hasWallet = typeof window !== "undefined" && !!window.ethereum;

  const ensureChain = useCallback(async (eth: Eip1193) => {
    const chainId = (await eth.request({ method: "eth_chainId" })) as string;
    if (parseInt(chainId, 16) === network.chainId) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: network.chainIdHex }],
      });
    } catch {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: network.chainIdHex,
            chainName: network.chainName,
            nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
            rpcUrls: [network.rpcUrl],
            blockExplorerUrls: [network.hashscanUrl],
          },
        ],
      });
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }
    setConnecting(true);
    try {
      await ensureChain(window.ethereum);
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAccount(accounts[0] ?? null);
    } finally {
      setConnecting(false);
    }
  }, [ensureChain]);

  const getSigner = useCallback(async (): Promise<Signer> => {
    if (!window.ethereum) throw new Error("No wallet installed");
    await ensureChain(window.ethereum);
    const provider = new BrowserProvider(window.ethereum);
    return provider.getSigner();
  }, [ensureChain]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts[0] ?? null);
    };
    eth.on("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  return (
    <WalletCtx.Provider
      value={{ account, connecting, connect, getSigner, hasWallet }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
