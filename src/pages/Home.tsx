import { useEffect, useState } from "react";
import FilterBar, { type TabKey, type SortDir } from "../components/FilterBar";
import TokenGrid from "../components/TokenGrid";
import TrendingRow from "../components/TrendingRow";
import { fetchHbarUsd } from "../lib/memegraph";
import { fetchNetworkStats, type TokenStats } from "../lib/stats";

export default function Home() {
  const [tokens, setTokens] = useState<TokenStats[] | null>(null);
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
      })
      .catch((e) => alive && setError(String(e)));
    fetchHbarUsd().then((v) => alive && setHbarUsd(v));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      {/* Trending by volume — somnia's "Hot" row */}
      <TrendingRow tokens={tokens} hbarUsd={hbarUsd} />

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
