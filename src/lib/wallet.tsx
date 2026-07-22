/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
import { EthersAdapter, type TxAdapter } from "./tx";
// Side-effect import: runs createAppKit() once so the hooks below have context
// and the "Connect a Wallet" modal web component is mounted.
import "./reown";

/** Read-only provider — works with no wallet connected. */
export const readProvider = new JsonRpcProvider(network.rpcUrl, network.chainId, {
  batchMaxCount: 1, // Hashio doesn't accept JSON-RPC batches
});

type WalletState = {
  /** EVM address of the connected account, or null */
  evmAddress: string | null;
  /** Same as evmAddress; the header resolves it to a 0.0.x id for display */
  displayAccount: string | null;
  connecting: boolean;
  walletError: string | null;
  /** Open the Reown "Connect a Wallet" modal */
  openConnect: () => void;
  disconnect: () => void;
  adapter: TxAdapter | null;
  getSigner: () => Promise<Signer>;
};

const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");
  const { disconnect: appkitDisconnect } = useDisconnect();

  const evmAddress = isConnected && address ? address : null;

  const getSigner = useCallback(async (): Promise<Signer> => {
    if (!walletProvider) throw new Error("Connect a wallet first.");
    const provider = new BrowserProvider(walletProvider, network.chainId);
    return provider.getSigner();
  }, [walletProvider]);

  const adapter = useMemo<TxAdapter | null>(
    () => (evmAddress ? new EthersAdapter(getSigner) : null),
    [evmAddress, getSigner]
  );

  const disconnect = useCallback(() => {
    appkitDisconnect().catch(() => {});
  }, [appkitDisconnect]);

  return (
    <WalletCtx.Provider
      value={{
        evmAddress,
        displayAccount: evmAddress,
        connecting: status === "connecting" || status === "reconnecting",
        walletError: null,
        openConnect: () => open(),
        disconnect,
        adapter,
        getSigner,
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
