import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Rocket, ShieldCheck } from "lucide-react";
import FilterBar, { type TabKey, type SortDir } from "../components/FilterBar";
import TokenGrid from "../components/TokenGrid";
import TokenAvatar from "../components/TokenAvatar";
import CreatorId from "../components/CreatorId";
import { fetchHbarUsd, fmtHbar, fmtTokens, fmtUsd } from "../lib/memegraph";
import { fetchNetworkStats, type TokenStats } from "../lib/stats";

export default function Home() {
  const [tokens, setTokens] = useState<TokenStats[] | null>(null);
  const [tvl, setTvl] = useState<bigint | null>(null);
  const [hbarUsd, setHbarUsd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("hot");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortDir>("desc");

  useEffect(() => {
    let alive = true;
    fetchNetworkStats()
      .then((s) => {
        if (!alive) return;
        setTokens(s.tokens);
        setTvl(s.tvlTinybar);
      })
      .catch((e) => alive && setError(String(e)));
    fetchHbarUsd().then((v) => alive && setHbarUsd(v));
    return () => {
      alive = false;
    };
  }, []);

  const topPerformer = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;
    return [...tokens].sort(
      (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity)
    )[0];
  }, [tokens]);

  const tvlUsd =
    tvl !== null && hbarUsd !== null ? (Number(tvl) / 1e8) * hbarUsd : null;

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-hairline bg-panel/50 px-6 py-10 backdrop-blur-xl sm:px-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-neon-purple/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-neon-cyan/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1 text-[11px] font-bold tracking-wide text-neon-cyan uppercase">
              <ShieldCheck size={12} /> Royalties enforced by Hedera
            </span>
            <h1 className="font-display text-4xl leading-[1.1] font-bold text-ink-bright sm:text-5xl">
              Memes that pay
              <br />
              their{" "}
              <span className="bg-gradient-to-r from-neon-pink to-neon-cyan bg-clip-text text-transparent">
                makers
              </span>
            </h1>
            <p className="mt-3 text-base leading-relaxed text-ink">
              Every token pays its creator 0.4% of <em>every</em> transfer —
              forever, enforced by the network itself. No admin keys, no
              fee-schedule key, permanent liquidity.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/launch"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink px-5 py-2.5 text-sm font-bold text-white no-underline shadow-[0_0_24px_-6px_var(--color-neon-pink)] transition-transform duration-200 hover:scale-[1.03]"
              >
                <Rocket size={16} /> Launch Token
              </Link>
              <Link
                to="/creators"
                className="inline-flex items-center rounded-xl border border-hairline bg-surface/60 px-5 py-2.5 text-sm font-bold text-ink no-underline backdrop-blur-md transition-colors duration-200 hover:border-neon-cyan hover:text-neon-cyan"
              >
                Creator earnings
              </Link>
            </div>
          </div>

          {/* TVL */}
          <div className="shrink-0 rounded-2xl border border-hairline bg-surface/60 px-6 py-5 backdrop-blur-xl">
            <div className="text-[11px] font-bold tracking-wider text-ink-dim uppercase">
              Total value locked
            </div>
            <div className="mt-1 font-mono text-3xl font-bold text-ink-bright">
              {tvl !== null ? fmtHbar(tvl) : "—"}
              <span className="ml-1.5 text-sm text-ink-dim">HBAR</span>
            </div>
            <div className="mt-1 text-xs text-ink-dim">
              {tvlUsd !== null
                ? `≈ ${fmtUsd(tvlUsd)} · `
                : ""}
              locked permanently across {tokens?.length ?? "…"} pool
              {tokens && tokens.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- top performer ---------- */}
      {topPerformer && (
        <Link
          to={`/t/${topPerformer.id}`}
          className="group mb-6 flex flex-col gap-4 rounded-2xl border border-neon-pink/30 bg-gradient-to-r from-neon-purple/10 to-neon-pink/5 p-5 no-underline backdrop-blur-xl transition-all duration-200 hover:border-neon-pink/60 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3.5">
            <span className="overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-110">
              <TokenAvatar
                symbol={topPerformer.symbol}
                address={topPerformer.token}
                memo={topPerformer.memeMemo}
                size={52}
              />
            </span>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-neon-pink uppercase">
                <Flame size={12} /> Top performing memecoin
              </div>
              <div className="font-display text-xl font-bold text-ink-bright">
                {topPerformer.name ?? "…"}{" "}
                <span className="font-mono text-sm text-neon-cyan">
                  ${topPerformer.symbol ?? ""}
                </span>
              </div>
              <div className="font-mono text-xs text-ink-dim">
                by <CreatorId addr={topPerformer.creator} link={false} />
              </div>
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              {
                k: "Since launch",
                v: `${(topPerformer.changePct ?? 0) >= 0 ? "+" : ""}${(topPerformer.changePct ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                cls:
                  (topPerformer.changePct ?? 0) >= 0
                    ? "text-neon-green"
                    : "text-neon-red",
              },
              {
                k: "Volume",
                v: `${fmtHbar(topPerformer.volumeTinybar)} ℏ`,
                cls: "text-ink-bright",
              },
              {
                k: "Trades",
                v: String(topPerformer.trades),
                cls: "text-ink-bright",
              },
              {
                k: "Creator earned",
                v: `${fmtTokens(topPerformer.creatorAccrued)} ${topPerformer.symbol ?? ""}`,
                cls: "text-ink-bright",
              },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-[10px] font-semibold tracking-wide text-ink-dim uppercase">
                  {s.k}
                </dt>
                <dd className={`m-0 font-mono text-base font-bold ${s.cls}`}>
                  {s.v}
                </dd>
              </div>
            ))}
          </dl>
        </Link>
      )}

      {/* ---------- market ---------- */}
      {error && (
        <div className="mb-4 rounded-xl border border-neon-red/40 bg-neon-red/5 px-4 py-3 text-sm text-neon-red">
          Failed to load the market: {error}
        </div>
      )}

      <FilterBar
        tab={tab}
        onTab={setTab}
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        count={tokens?.length ?? 0}
      />

      <TokenGrid
        tokens={tokens}
        tab={tab}
        query={query}
        sort={sort}
        hbarUsd={hbarUsd}
      />
    </div>
  );
}
