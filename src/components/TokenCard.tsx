import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, Repeat2, Droplets } from "lucide-react";
import TokenAvatar from "./TokenAvatar";
import CreatorId from "./CreatorId";
import { fmtHbar, fmtUsd } from "../lib/memegraph";
import { VESTING_DAYS, TOKEN_SUPPLY } from "../config";
import type { TokenStats } from "../lib/stats";

function ago(t: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function TokenCard({
  t,
  hbarUsd,
}: {
  t: TokenStats;
  hbarUsd: number | null;
}) {
  const priceHbar = Number(t.price) / 1e18;
  const mcap = hbarUsd !== null ? priceHbar * TOKEN_SUPPLY * hbarUsd : null;
  const up = (t.changePct ?? 0) >= 0;

  // Creator royalties vest linearly over VESTING_DAYS from launch. This is
  // the real, on-chain progress bar — Memegraph has no bonding-curve
  // graduation: every pool is permanent.
  const elapsedDays = (Date.now() / 1000 - t.launchedAt) / 86_400;
  const vestPct = Math.max(0, Math.min(100, (elapsedDays / VESTING_DAYS) * 100));

  return (
    <Link
      to={`/t/${t.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-panel/60 no-underline backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-neon-purple/60 hover:shadow-[0_10px_40px_-16px_var(--color-neon-purple)]"
    >
      {/* hero image */}
      <div className="relative aspect-square w-full overflow-hidden bg-surface">
        <TokenAvatar
          symbol={t.symbol}
          address={t.token}
          memo={t.memeMemo}
          rounded={false}
          fill
        />
        <span className="absolute inset-0 rounded-none ring-1 ring-inset ring-white/5" />
        <span
          className={`absolute right-2.5 top-2.5 rounded-lg px-2 py-1 font-mono text-xs font-bold backdrop-blur-md ${
            up
              ? "bg-neon-green/20 text-neon-green"
              : "bg-neon-red/20 text-neon-red"
          }`}
        >
          {up ? "+" : ""}
          {(t.changePct ?? 0).toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
          %
        </span>
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/0 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-base font-bold text-white drop-shadow">
              {t.name ?? "Unnamed"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-neon-cyan drop-shadow">
              ${t.symbol ?? "???"}
            </span>
            <span className="truncate font-mono text-[11px] text-white/70">
              <CreatorId addr={t.creator} link={false} />
            </span>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="font-mono text-xl font-bold text-ink-bright">
            {mcap !== null ? fmtUsd(mcap) : "—"}
          </div>
          <div className="text-[10px] font-semibold tracking-wide text-ink-dim uppercase">
            Market cap
          </div>
        </div>

        {/* creator vesting progress — the real "progress to completion";
            Memegraph has no bonding-curve graduation, every pool is permanent */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold tracking-wide uppercase">
            <span className="text-ink-dim">Creator vesting</span>
            <span className="font-mono text-neon-pink">
              {vestPct.toFixed(0)}% of {VESTING_DAYS}d
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan transition-all duration-500"
              style={{ width: `${Math.max(2, vestPct)}%` }}
            />
          </div>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-2 border-t border-hairline pt-3 text-xs">
          <span className="flex items-center gap-1 text-ink-dim" title="Volume">
            <Droplets size={11} /> {fmtHbar(t.volumeTinybar, 1)}
          </span>
          <span className="flex items-center gap-1 text-ink-dim" title="Trades">
            <Repeat2 size={11} /> {t.trades}
          </span>
          <span className="flex items-center gap-1 text-ink-dim" title="Created">
            <Clock size={11} /> {ago(t.launchedAt)}
          </span>
        </div>

        <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface/60 py-2 text-sm font-bold text-ink transition-all duration-200 group-hover:border-transparent group-hover:bg-gradient-to-r group-hover:from-neon-purple group-hover:to-neon-pink group-hover:text-white">
          Trade <ArrowUpRight size={14} />
        </span>
      </div>
    </Link>
  );
}
