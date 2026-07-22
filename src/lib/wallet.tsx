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
import {
  BrowserProvider,
  JsonRpcProvider,
  type Eip1193Provider,
  type Signer,
} from "ethers";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
} from "@reown/appkit/react";
import { network } from "../config";
import { EthersAdapter, HashPackAdapter, type TxAdapter } from "./tx";
import {
  getHashConnect,
  initHashConnect,
  resetHashConnect,
  accountEvmAddress,
} from "./hashpack";
import ConnectModal from "../components/ConnectModal";
// Side-effect import: runs createAppKit() once so the hooks below have context
// and the Reown modal web component is mounted.
import "./reown";

/** Read-only provider — works with no wallet connected. */
export const readProvider = new JsonRpcProvider(network.rpcUrl, network.chainId, {
  batchMaxCount: 1, // Hashio doesn't accept JSON-RPC batches
});

export type WalletKind = "hashpack" | "reown";

/** Marks which pathway owns the persisted session, so a page load doesn't
 *  spin up a second WalletConnect core it doesn't need. */
const KIND_KEY = "mg-wallet-kind";

type WalletState = {
  kind: WalletKind | null;
  /** EVM address — used for balance/allowance reads for both pathways */
  evmAddress: string | null;
  /** What to show in the connect button: 0.0.x for HashPack, 0x… for EVM
   *  (the header resolves 0x… to its 0.0.x id for display) */
  displayAccount: string | null;
  connecting: boolean;
  walletError: string | null;
  /** Open the wallet chooser (HashPack native vs Reown EVM) */
  openConnect: () => void;
  disconnect: () => void;
  adapter: TxAdapter | null;
  getSigner: () => Promise<Signer>;
};

const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");
  const { disconnect: appkitDisconnect } = useDisconnect();

  const [chooserOpen, setChooserOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [hederaAccountId, setHederaAccountId] = useState<string | null>(null);
  const [hpEvmAddress, setHpEvmAddress] = useState<string | null>(null);

  // A live HashPack pairing takes precedence; otherwise any Reown session.
  const kind: WalletKind | null = hederaAccountId
    ? "hashpack"
    : isConnected && address
      ? "reown"
      : null;

  const applyHashPackSession = useCallback(async (accountIds: string[]) => {
    const accountId = accountIds[0];
    if (!accountId) return;
    setHederaAccountId(accountId);
    setChooserOpen(false);
    setWalletError(null);
    localStorage.setItem(KIND_KEY, "hashpack");
    try {
      setHpEvmAddress(await accountEvmAddress(accountId));
    } catch {
      setHpEvmAddress(null);
    }
  }, []);

  const clearHashPack = useCallback(() => {
    setHederaAccountId(null);
    setHpEvmAddress(null);
    if (localStorage.getItem(KIND_KEY) === "hashpack") {
      localStorage.removeItem(KIND_KEY);
    }
  }, []);

  // Restore an existing HashPack pairing on load — but only when the last
  // session used HashPack, so Reown-only visitors don't pay for a second
  // WalletConnect core.
  useEffect(() => {
    if (localStorage.getItem(KIND_KEY) !== "hashpack") return;
    initHashConnect(
      (session) => applyHashPackSession(session.accountIds),
      clearHashPack
    ).catch(() => {});
  }, [applyHashPackSession, clearHashPack]);

  const connectHashPack = useCallback(async () => {
    setConnecting(true);
    setWalletError(null);
    try {
      // The WalletConnect relay refuses clients whose clock is skewed and
      // hashconnect then retries forever — don't hang the UI on it.
      await Promise.race([
        initHashConnect(
          (session) => applyHashPackSession(session.accountIds),
          clearHashPack
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
          ? "Couldn't reach the WalletConnect relay (relay.walletconnect.com). Usual causes: a wrong system clock/time zone, or a DNS/network problem resolving that domain — switching DNS to 1.1.1.1 or 8.8.8.8 often fixes it."
          : `HashPack connection failed: ${(e as Error).message}`
      );
    } finally {
      setConnecting(false);
    }
  }, [applyHashPackSession, clearHashPack]);

  const connectReown = useCallback(() => {
    setChooserOpen(false);
    localStorage.setItem(KIND_KEY, "reown");
    open();
  }, [open]);

  const getSigner = useCallback(async (): Promise<Signer> => {
    if (!walletProvider) throw new Error("Connect a wallet first.");
    const provider = new BrowserProvider(walletProvider, network.chainId);
    return provider.getSigner();
  }, [walletProvider]);

  const evmAddress =
    kind === "hashpack" ? hpEvmAddress : kind === "reown" ? address! : null;
  const displayAccount =
    kind === "hashpack" ? hederaAccountId : kind === "reown" ? address! : null;

  const adapter = useMemo<TxAdapter | null>(() => {
    if (kind === "hashpack" && hederaAccountId)
      return new HashPackAdapter(hederaAccountId);
    if (kind === "reown") return new EthersAdapter(getSigner);
    return null;
  }, [kind, hederaAccountId, getSigner]);

  const disconnect = useCallback(() => {
    if (kind === "hashpack") {
      getHashConnect()
        .disconnect()
        .catch(() => {});
      clearHashPack();
    } else {
      appkitDisconnect().catch(() => {});
      if (localStorage.getItem(KIND_KEY) === "reown") {
        localStorage.removeItem(KIND_KEY);
      }
    }
  }, [kind, clearHashPack, appkitDisconnect]);

  return (
    <WalletCtx.Provider
      value={{
        kind,
        evmAddress,
        displayAccount,
        connecting,
        walletError,
        openConnect: () => {
          setWalletError(null);
          setChooserOpen(true);
        },
        disconnect,
        adapter,
        getSigner,
      }}
    >
      {children}
      <ConnectModal
        open={chooserOpen}
        connecting={connecting}
        error={walletError}
        onHashPack={connectHashPack}
        onReown={connectReown}
        onClose={() => setChooserOpen(false)}
      />
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
