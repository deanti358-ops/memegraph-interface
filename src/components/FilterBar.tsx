import { Search, Flame, Sparkles, TrendingUp, Coins, X } from "lucide-react";

export type TabKey = "new" | "hot" | "gainers" | "mcap";
export type SortDir = "desc" | "asc";

export const TABS: {
  key: TabKey;
  label: string;
  icon: typeof Flame;
  hint: string;
}[] = [
  { key: "hot", label: "Hot", icon: Flame, hint: "Most traded volume" },
  { key: "new", label: "New", icon: Sparkles, hint: "Newest launches" },
  {
    key: "gainers",
    label: "Gainers",
    icon: TrendingUp,
    hint: "Biggest move since launch",
  },
  { key: "mcap", label: "Market Cap", icon: Coins, hint: "Largest market cap" },
];

export default function FilterBar({
  tab,
  onTab,
  query,
  onQuery,
  sort,
  onSort,
  count,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  query: string;
  onQuery: (q: string) => void;
  sort: SortDir;
  onSort: (s: SortDir) => void;
  count: number;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      {/* Tabs */}
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 lg:pb-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              title={t.hint}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-bold transition-all duration-200 ${
                active
                  ? "border-neon-purple/60 bg-neon-purple/15 text-ink-bright shadow-[0_0_18px_-8px_var(--color-neon-purple)]"
                  : "border-hairline bg-surface/60 text-ink-dim backdrop-blur-md hover:border-neon-purple/40 hover:text-ink-bright"
              }`}
            >
              <Icon size={14} className={active ? "text-neon-pink" : ""} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 lg:w-72 lg:flex-none">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim"
          />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search name, ticker or address…"
            aria-label="Search tokens"
            className="w-full rounded-xl border border-hairline bg-surface/60 py-2 pl-9 pr-8 text-sm text-ink-bright backdrop-blur-md outline-none transition-all duration-200 placeholder:text-ink-dim focus:border-neon-cyan focus:shadow-[0_0_16px_-6px_var(--color-neon-cyan)]"
          />
          {query && (
            <button
              onClick={() => onQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-dim transition-colors hover:text-ink-bright"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as SortDir)}
          aria-label="Sort direction"
          className="shrink-0 rounded-xl border border-hairline bg-surface/60 px-3 py-2 text-sm font-semibold text-ink backdrop-blur-md outline-none transition-colors duration-200 hover:text-ink-bright focus:border-neon-cyan"
        >
          <option value="desc">High → Low</option>
          <option value="asc">Low → High</option>
        </select>

        <span className="hidden shrink-0 font-mono text-xs text-ink-dim sm:inline">
          {count} token{count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}
