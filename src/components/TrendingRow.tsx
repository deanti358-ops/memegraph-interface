import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import TokenAvatar from "./TokenAvatar";
import { fmtHbar, fmtUsd } from "../lib/memegraph";
import { TOKEN_SUPPLY } from "../config";
import type { TokenStats } from "../lib/stats";

/**
 * "Trending by volume" — a horizontal carousel of the highest-volume tokens,
 * mirroring the Hot row on somnia.meme. Compact cards: image, name, symbol,
 * market cap, volume.
 */
export default function TrendingRow({
  tokens,
  hbarUsd,
}: {
  tokens: TokenStats[] | null;
  hbarUsd: number | null;
}) {
  if (!tokens) return null;
  const top = [...tokens]
    .sort((a, b) => Number(b.volumeTinybar - a.volumeTinybar))
    .slice(0, 8);
  if (top.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-neon-purple/15 text-neon-purple">
          <Flame size={14} />
        </span>
        <h2 className="text-sm font-bold text-ink-bright">Hot</h2>
        <span className="text-xs text-ink-dim">Trending by volume</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {top.map((t) => {
          const priceHbar = Number(t.price) / 1e18;
          const mcap = hbarUsd !== null ? priceHbar * TOKEN_SUPPLY * hbarUsd : null;
          return (
            <Link
              key={t.id}
              to={`/t/${t.id}`}
              className="group flex w-[164px] shrink-0 flex-col overflow-hidden rounded-lg border border-hairline bg-panel no-underline transition-all duration-200 hover:border-neon-purple/50 hover:bg-surface"
            >
              <div className="aspect-square w-full overflow-hidden bg-surface">
                <TokenAvatar
                  symbol={t.symbol}
                  address={t.token}
                  memo={t.memeMemo}
                  rounded={false}
                  fill
                />
              </div>
              <div className="flex flex-col gap-1.5 p-2.5">
                <div className="flex items-baseline justify-between gap-1.5">
                  <h3 className="min-w-0 truncate text-[13px] font-bold text-ink-bright">
                    {t.name ?? "Unnamed"}
                  </h3>
                  <span className="shrink-0 text-[11px] font-semibold text-ink-dim">
                    ${t.symbol ?? "???"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-ink-dim">
                    MCap{" "}
                    <span className="font-semibold tabular-nums text-ink-bright">
                      {mcap !== null ? fmtUsd(mcap) : "—"}
                    </span>
                  </span>
                  <span className="text-ink-dim">
                    Vol{" "}
                    <span className="font-semibold tabular-nums text-ink-bright">
                      {fmtHbar(t.volumeTinybar, 1)}ℏ
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
