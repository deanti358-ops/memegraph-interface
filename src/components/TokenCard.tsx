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

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-ink-dim uppercase">
        <Icon size={11} /> {label}
      </span>
      <span className="font-mono text-sm font-bold text-ink-bright">
        {value}
      </span>
    </div>
  );
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
      className="group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border border-hairline bg-panel/60 p-4 no-underline backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-neon-purple/60 hover:shadow-[0_10px_40px_-16px_var(--color-neon-purple)]"
    >
      {/* hover sheen */}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neon-purple/0 to-neon-pink/0 opacity-0 transition-opacity duration-200 group-hover:from-neon-purple/[0.07] group-hover:to-neon-pink/[0.05] group-hover:opacity-100" />

      {/* head */}
      <div className="relative flex items-start gap-3">
        <span className="overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-110">
          <TokenAvatar
            symbol={t.symbol}
            address={t.token}
            memo={t.memeMemo}
            size={44}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-base font-bold text-ink-bright">
              {t.name ?? "Unnamed"}
            </span>
            <span className="shrink-0 font-mono text-xs font-bold text-neon-cyan">
              ${t.symbol ?? "???"}
            </span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-ink-dim">
            by <CreatorId addr={t.creator} link={false} />
          </div>
        </div>

        <span
          className={`shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-bold ${
            up
              ? "bg-neon-green/10 text-neon-green"
              : "bg-neon-red/10 text-neon-red"
          }`}
        >
          {up ? "+" : ""}
          {(t.changePct ?? 0).toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
          %
        </span>
      </div>

      {/* creator vesting progress — the real "progress to completion" */}
      <div className="relative">
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

      {/* stats */}
      <div className="relative grid grid-cols-2 gap-3">
        <Stat
          icon={ArrowUpRight}
          label="Mkt cap"
          value={mcap !== null ? fmtUsd(mcap) : "—"}
        />
        <Stat
          icon={Droplets}
          label="Volume"
          value={`${fmtHbar(t.volumeTinybar)} ℏ`}
        />
        <Stat icon={Repeat2} label="Trades" value={String(t.trades)} />
        <Stat icon={Clock} label="Created" value={ago(t.launchedAt)} />
      </div>

      {/* CTA */}
      <span className="relative mt-0.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface/60 py-2 text-sm font-bold text-ink transition-all duration-200 group-hover:border-transparent group-hover:bg-gradient-to-r group-hover:from-neon-purple group-hover:to-neon-pink group-hover:text-white">
        Trade <ArrowUpRight size={14} />
      </span>
    </Link>
  );
}
