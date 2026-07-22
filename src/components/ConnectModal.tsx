import { X, Wallet, Globe } from "lucide-react";

/**
 * First-step wallet chooser. Two pathways:
 * - HashPack via HashConnect: native Hedera transactions, works with every
 *   account key type (ED25519 and ECDSA).
 * - Reown AppKit: EVM wallets (MetaMask, Rainbow, WalletConnect …) over the
 *   JSON-RPC relay — needs an ECDSA account.
 *
 * Rendered by WalletProvider so it works from any openConnect() call site.
 */
export default function ConnectModal({
  open,
  connecting,
  error,
  onHashPack,
  onReown,
  onClose,
}: {
  open: boolean;
  connecting: boolean;
  error: string | null;
  onHashPack: () => void;
  onReown: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={connecting ? undefined : onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-hairline bg-panel p-5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-bright">
            Connect a wallet
          </h2>
          <button
            onClick={onClose}
            disabled={connecting}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-dim transition-colors hover:text-ink-bright disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-dim">
          Choose how you want to connect to Memegraph.
        </p>

        <button
          onClick={onHashPack}
          disabled={connecting}
          className="mb-3 flex w-full items-start gap-3 rounded-xl border border-neon-purple/40 bg-neon-purple/5 p-4 text-left transition-all duration-200 hover:border-neon-purple hover:bg-neon-purple/10 disabled:opacity-60"
        >
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-neon-purple to-neon-pink text-white">
            <Wallet size={17} />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink-bright">
              HashPack — native Hedera
              <span className="ml-2 rounded-full bg-neon-green/15 px-2 py-0.5 text-[10px] font-semibold text-neon-green">
                Recommended
              </span>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-dim">
              {connecting
                ? "Waiting for HashPack… approve the pairing in the wallet."
                : "Signs real Hedera transactions. Works with every HashPack account, including ED25519."}
            </span>
          </span>
        </button>

        <button
          onClick={onReown}
          disabled={connecting}
          className="flex w-full items-start gap-3 rounded-xl border border-hairline bg-surface/60 p-4 text-left transition-all duration-200 hover:border-neon-cyan disabled:opacity-60"
        >
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-surface text-neon-cyan">
            <Globe size={17} />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink-bright">
              Browser &amp; multi-chain wallets
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-dim">
              MetaMask, Rainbow, WalletConnect and other EVM wallets. Requires
              an ECDSA account.
            </span>
          </span>
        </button>

        {error && (
          <p className="mt-3 rounded-xl border border-neon-red/30 bg-neon-red/10 px-3 py-2.5 text-xs leading-relaxed text-neon-red">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
