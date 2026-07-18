/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcProvider, type Signer } from "ethers";
import { network } from "../config";
import { EthersAdapter, HashPackAdapter, type TxAdapter } from "./tx";
import {
  getHashConnect,
  initHashConnect,
  resetHashConnect,
  accountEvmAddress,
} from "./hashpack";

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

export type WalletKind = "metamask" | "hashpack";

type WalletState = {
  kind: WalletKind | null;
  /** EVM address — used for balance/allowance reads for both wallet kinds */
  evmAddress: string | null;
  /** What to show in the connect button: 0.0.x for HashPack, 0x… for EVM */
  displayAccount: string | null;
  connecting: boolean;
  hasMetaMask: boolean;
  walletError: string | null;
  connectMetaMask: () => Promise<void>;
  connectHashPack: () => Promise<void>;
  disconnect: () => void;
  adapter: TxAdapter | null;
};

const WalletCtx = createContext<WalletState | null>(null);

async function ensureChain(eth: Eip1193) {
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
}

async function evmSigner(): Promise<Signer> {
  if (!window.ethereum) throw new Error("No EVM wallet installed");
  await ensureChain(window.ethereum);
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<WalletKind | null>(null);
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [displayAccount, setDisplayAccount] = useState<string | null>(null);
  const [hederaAccountId, setHederaAccountId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;

  const applyHashPackSession = useCallback(async (accountIds: string[]) => {
    const accountId = accountIds[0];
    if (!accountId) return;
    setKind("hashpack");
    setHederaAccountId(accountId);
    setDisplayAccount(accountId);
    try {
      setEvmAddress(await accountEvmAddress(accountId));
    } catch {
      setEvmAddress(null);
    }
  }, []);

  // Restore an existing HashPack pairing on load.
  useEffect(() => {
    initHashConnect(
      (session) => applyHashPackSession(session.accountIds),
      () => {
        setKind((k) => (k === "hashpack" ? null : k));
        setHederaAccountId(null);
      }
    ).catch(() => {});
  }, [applyHashPackSession]);

  const connectMetaMask = useCallback(async () => {
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
      if (accounts[0]) {
        setKind("metamask");
        setEvmAddress(accounts[0]);
        setDisplayAccount(accounts[0]);
        setHederaAccountId(null);
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const connectHashPack = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      // The WalletConnect relay refuses clients whose clock is skewed and
      // hashconnect then retries forever — don't hang the UI on it.
      await Promise.race([
        initHashConnect(
          (session) => applyHashPackSession(session.accountIds),
          () => {
            setKind((k) => (k === "hashpack" ? null : k));
            setHederaAccountId(null);
          }
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("relay-timeout")), 15_000)
        ),
      ]);
      getHashConnect().openPairingModal();
    } catch (e) {
      // Start the next attempt from scratch rather than reusing a socket
      // that may be stuck retrying with stale state.
      resetHashConnect();
      setWalletError(
        (e as Error).message === "relay-timeout"
          ? "Couldn't reach the WalletConnect relay. Make sure your computer's clock and time zone are set correctly, then try again."
          : `HashPack connection failed: ${(e as Error).message}`
      );
    } finally {
      setConnecting(false);
    }
  }, [applyHashPackSession]);

  const disconnect = useCallback(() => {
    if (kind === "hashpack") {
      getHashConnect()
        .disconnect()
        .catch(() => {});
    }
    setKind(null);
    setEvmAddress(null);
    setDisplayAccount(null);
    setHederaAccountId(null);
  }, [kind]);

  // MetaMask account switches
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setKind((k) => {
        if (k !== "metamask") return k;
        setEvmAddress(accounts[0] ?? null);
        setDisplayAccount(accounts[0] ?? null);
        return accounts[0] ? k : null;
      });
    };
    eth.on("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const adapter = useMemo<TxAdapter | null>(() => {
    if (kind === "metamask") return new EthersAdapter(evmSigner);
    if (kind === "hashpack" && hederaAccountId)
      return new HashPackAdapter(hederaAccountId);
    return null;
  }, [kind, hederaAccountId]);

  return (
    <WalletCtx.Provider
      value={{
        kind,
        evmAddress,
        displayAccount,
        connecting,
        hasMetaMask,
        walletError,
        connectMetaMask,
        connectHashPack,
        disconnect,
        adapter,
      }}
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
