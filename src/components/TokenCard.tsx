import { Link } from "react-router-dom";
import TokenAvatar from "./TokenAvatar";
import CreatorId from "./CreatorId";
import { fmtUsd } from "../lib/memegraph";
import { VESTING_DAYS, TOKEN_SUPPLY } from "../config";
import type { TokenStats } from "../lib/stats";

function ago(t: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 2592000)}mo ago`;
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

  // Creator royalties vest linearly over VESTING_DAYS from launch — the real,
  // on-chain progress metric. (Memegraph has no bonding-curve graduation:
  // every pool is permanent, so we show vesting rather than "% to graduation".)
  const elapsedDays = (Date.now() / 1000 - t.launchedAt) / 86_400;
  const vestPct = Math.max(0, Math.min(100, (elapsedDays / VESTING_DAYS) * 100));

  return (
    <Link
      to={`/t/${t.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-hairline bg-panel no-underline transition-all duration-200 hover:border-neon-purple/50 hover:bg-surface"
    >
      {/* hero image */}
      <div className="relative aspect-[7/6] w-full overflow-hidden bg-surface">
        <TokenAvatar
          symbol={t.symbol}
          address={t.token}
          memo={t.memeMemo}
          rounded={false}
          fill
        />
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-[15px] font-bold text-ink-bright">
            {t.name ?? "Unnamed"}
          </h3>
          <span className="shrink-0 text-xs font-semibold text-ink-dim">
            ${t.symbol ?? "???"}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-ink-dim">
          <span className="truncate">
            <CreatorId addr={t.creator} link={false} />
          </span>
          <span className="shrink-0">{ago(t.launchedAt)}</span>
        </div>

        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-lg font-bold tabular-nums text-ink-bright">
            {mcap !== null ? fmtUsd(mcap) : "—"}
          </span>
          <span className="text-[11px] text-ink-dim">Market cap</span>
        </div>

        {/* creator-vesting progress bar (violet), somnia-style */}
        <div className="mt-auto">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-medium text-neon-purple">
              {vestPct.toFixed(1)}% vested
            </span>
            <span className="text-ink-dim">{(100 - vestPct).toFixed(0)}% left</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-neon-purple transition-all duration-500"
              style={{ width: `${Math.max(2, vestPct)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
