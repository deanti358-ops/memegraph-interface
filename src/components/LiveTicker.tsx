import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import TokenAvatar from "./TokenAvatar";
import { fmtHbar } from "../lib/memegraph";
import type { RecentTrade } from "../lib/stats";

/**
 * Scrolling marquee of the latest on-chain activity. Every entry is a real
 * Buy/Sell event read from the Hedera mirror node — nothing is simulated.
 * The track is duplicated so the -50% translate loops seamlessly.
 */

function ago(t: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Item({ t }: { t: RecentTrade }) {
  const buy = t.kind === "buy";
  return (
    <Link
      to={`/t/${t.memeId}`}
      className="group flex shrink-0 items-center gap-2 px-4 py-2 no-underline"
    >
      <TokenAvatar
        symbol={t.symbol}
        address={t.token}
        memo={t.memeMemo}
        size={20}
      />
      <span className="font-mono text-xs font-bold text-ink-bright group-hover:text-neon-cyan">
        ${t.symbol ?? "???"}
      </span>
      <span
        className={`font-mono text-[11px] font-bold ${
          buy ? "text-neon-green" : "text-neon-red"
        }`}
      >
        {buy ? "▲ BUY" : "▼ SELL"}
      </span>
      <span className="font-mono text-[11px] text-ink">
        {fmtHbar(t.hbarTinybar, 3)} ℏ
      </span>
      <span className="text-[11px] text-ink-dim">{ago(t.t)}</span>
      <span className="ml-2 text-hairline">•</span>
    </Link>
  );
}

export default function LiveTicker({
  trades,
}: {
  trades: RecentTrade[] | null;
}) {
  const has = trades && trades.length > 0;
  const track = has ? [...trades, ...trades] : [];

  return (
    <div className="relative flex min-w-0 items-center overflow-hidden border-b border-hairline bg-surface/50 backdrop-blur-md">
      <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-hairline bg-panel/80 px-3 py-2 text-[11px] font-bold tracking-wider text-neon-cyan uppercase">
        <Radio size={13} className="animate-pulse-dot" />
        <span className="hidden sm:inline">Live</span>
      </div>

      {has ? (
        <div className="flex min-w-full animate-marquee hover:[animation-play-state:paused]">
          {track.map((t, i) => (
            <Item key={`${t.memeId}-${t.t}-${i}`} t={t} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-2 text-xs text-ink-dim">
          {trades ? "No trades yet." : "Reading pool events…"}
        </div>
      )}

      <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-obsidian to-transparent" />
    </div>
  );
}
