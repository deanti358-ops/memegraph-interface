import { useEffect, useState } from "react";
import { Copy, Check, ExternalLink, User } from "lucide-react";
import {
  fmtHbar,
  fmtTokens,
  fmtUsd,
  shortAddr,
  hashscanAddr,
  hederaAccountId,
} from "../lib/memegraph";
import type { Trade, Holder } from "../lib/tokenDetail";

function timeAgo(t: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 2592000)}mo ago`;
}

// ---------------------------------------------------------------------------
// Address card (Contract / Creator) with copy + HashScan link
// ---------------------------------------------------------------------------
export function AddressCard({
  label,
  address,
  badge,
}: {
  label: string;
  address: string;
  badge?: string;
}) {
  const [copied, setCopied] = useState(false);
  // Long-zero EVM addresses read as "0x0000…D6a2" — resolve and lead with
  // the native 0.0.x id, which is what Hedera users recognize.
  const [nativeId, setNativeId] = useState<string | null>(null);
  useEffect(() => {
    setNativeId(null);
    hederaAccountId(address)
      .then(setNativeId)
      .catch(() => {});
  }, [address]);

  return (
    <div className="rounded-2xl border border-hairline bg-panel/50 p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-dim">{label}</span>
        {badge && (
          <span className="rounded bg-neon-purple/15 px-1.5 py-0.5 text-[10px] font-bold text-neon-purple">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <a
          href={hashscanAddr(address)}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 no-underline"
          title={address}
        >
          <span className="block truncate font-mono text-base font-bold text-ink-bright hover:text-neon-cyan">
            {nativeId ?? shortAddr(address)}
          </span>
          {nativeId && (
            <span className="block truncate font-mono text-[11px] text-ink-dim">
              {shortAddr(address)}
            </span>
          )}
        </a>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={hashscanAddr(address)}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-surface/60 text-ink transition-colors hover:border-neon-cyan hover:text-neon-cyan"
            title="View on HashScan"
          >
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => {
              navigator.clipboard
                ?.writeText(nativeId ?? address)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                })
                .catch(() => {});
            }}
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-surface/60 text-ink transition-colors hover:border-neon-purple hover:text-ink-bright"
            title="Copy address"
          >
            {copied ? <Check size={16} className="text-neon-green" /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transactions panel
// ---------------------------------------------------------------------------
export function TransactionsPanel({
  trades,
  hbarUsd,
}: {
  trades: Trade[] | null;
  hbarUsd: number | null;
}) {
  const rows = trades ? [...trades].reverse() : null; // newest first
  return (
    <section className="rounded-2xl border border-hairline bg-panel/50">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="font-display text-sm font-bold text-ink-bright">Transactions</h2>
        <span className="font-mono text-xs text-ink-dim">
          {rows ? `${rows.length} trades` : "…"}
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {!rows && <div className="px-4 py-6 text-sm text-ink-dim">Loading…</div>}
        {rows && rows.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-dim">No trades yet.</div>
        )}
        {rows?.map((t, i) => {
          const usd =
            hbarUsd !== null ? (Number(t.hbarTinybar) / 1e8) * hbarUsd : null;
          return (
            <div
              key={i}
              className="flex items-center justify-between border-b border-hairline px-4 py-2.5 last:border-b-0"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-surface text-ink-dim">
                  <User size={13} />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={hashscanAddr(t.account)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-bold text-ink-bright hover:text-neon-cyan"
                    >
                      {shortAddr(t.account)}
                    </a>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        t.kind === "buy"
                          ? "bg-neon-green/15 text-neon-green"
                          : "bg-neon-red/15 text-neon-red"
                      }`}
                    >
                      {t.kind.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-dim">{timeAgo(t.t)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-ink-bright">
                  {fmtHbar(t.hbarTinybar, 3)} ℏ
                </div>
                <div className="text-[11px] text-ink-dim">
                  {usd !== null ? fmtUsd(usd) : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Holders panel
// ---------------------------------------------------------------------------
const ROLE_BADGE: Record<Holder["role"], { label: string; cls: string }> = {
  curve: { label: "Curve", cls: "bg-neon-purple/15 text-neon-purple" },
  dev: { label: "Dev", cls: "bg-amber-500/15 text-amber-400" },
  wallet: { label: "Wallet", cls: "bg-neon-green/10 text-neon-green" },
};

export function HoldersPanel({
  holders,
  count,
  symbol,
}: {
  holders: Holder[] | null;
  count: number;
  symbol?: string;
}) {
  return (
    <section className="rounded-2xl border border-hairline bg-panel/50">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="font-display text-sm font-bold text-ink-bright">Holders</h2>
        <span className="font-mono text-xs text-ink-dim">
          {holders ? `${count} holders` : "…"}
        </span>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {!holders && <div className="px-4 py-6 text-sm text-ink-dim">Loading…</div>}
        {holders && holders.length === 0 && (
          <div className="px-4 py-6 text-sm text-ink-dim">No holders yet.</div>
        )}
        {holders?.map((h, i) => {
          const badge = ROLE_BADGE[h.role];
          return (
            <div
              key={h.account}
              className="flex items-center justify-between border-b border-hairline px-4 py-2.5 last:border-b-0"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-dim">
                  #{i + 1}
                </span>
                <a
                  href={hashscanAddr(h.account)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs font-bold text-ink-bright hover:text-neon-cyan"
                >
                  {h.account}
                </a>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-ink-bright">
                  {fmtTokens(h.balance, 0)} {symbol ?? ""}
                </div>
                <div className="text-[11px] text-ink-dim">
                  {h.pct.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
