import { useMemo } from "react";
import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import TokenCard from "./TokenCard";
import type { TabKey, SortDir } from "./FilterBar";
import type { TokenStats } from "../lib/stats";

/** Ranking metric per tab — all read from real on-chain state. */
function metric(t: TokenStats, tab: TabKey): number {
  switch (tab) {
    case "hot":
      return Number(t.volumeTinybar);
    case "new":
      return t.launchedAt;
    case "gainers":
      return t.changePct ?? -Infinity;
    case "mcap":
      return Number(t.price);
  }
}

function SkeletonCard() {
  return (
    <div className="h-[248px] animate-pulse rounded-2xl border border-hairline bg-panel/40" />
  );
}

export default function TokenGrid({
  tokens,
  tab,
  query,
  sort,
  hbarUsd,
}: {
  tokens: TokenStats[] | null;
  tab: TabKey;
  query: string;
  sort: SortDir;
  hbarUsd: number | null;
}) {
  const visible = useMemo(() => {
    if (!tokens) return null;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tokens.filter((t) =>
          [t.name, t.symbol, t.token, t.creator]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        )
      : tokens;
    const dir = sort === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => (metric(a, tab) - metric(b, tab)) * dir);
  }, [tokens, tab, query, sort]);

  if (!visible) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-panel/40 px-6 py-16 text-center backdrop-blur-xl">
        <SearchX size={28} className="text-ink-dim" />
        <p className="text-ink">
          {query
            ? `Nothing matches “${query}”.`
            : "No memes launched yet."}
        </p>
        <Link
          to="/launch"
          className="rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink px-4 py-2 text-sm font-bold text-white no-underline transition-transform duration-200 hover:scale-[1.03]"
        >
          Launch the first one
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((t) => (
        <TokenCard key={t.id} t={t} hbarUsd={hbarUsd} />
      ))}
    </div>
  );
}
