import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, Coins, Landmark, Repeat2, Droplets, ExternalLink } from "lucide-react";
import { fmtHbar, fmtTokens, shortAddr, hashscanAddr } from "../lib/memegraph";
import {
  fetchNetworkStats,
  fetchRecentTrades,
  type NetworkStats,
  type RecentTrade,
} from "../lib/stats";
import TokenAvatar from "../components/TokenAvatar";
import CreatorId from "../components/CreatorId";

function timeAgo(t: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Tile({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Coins;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel/50 p-4 backdrop-blur-xl">
      <Icon size={16} className="mb-2 text-neon-purple" />
      <div className="font-mono text-xl font-bold text-ink-bright">{value}</div>
      <div className="mt-0.5 text-xs text-ink-dim">{label}</div>
    </div>
  );
}

export default function Creators() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [recent, setRecent] = useState<RecentTrade[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNetworkStats()
      .then((s) => {
        if (!alive) return;
        setStats(s);
        fetchRecentTrades(s.tokens)
          .then((r) => alive && setRecent(r))
          .catch(() => alive && setRecent([]));
      })
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink-bright">
          Creators get paid
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink">
          0.4% of every transfer of every token, collected by the Hedera network
          itself and vesting to the creator over 90 days. Every number below is
          public, on-chain, and verifiable — this board is the receipts.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-neon-red/40 bg-neon-red/5 px-4 py-3 text-sm text-neon-red">
          {error}
        </div>
      )}
      {!stats && !error && (
        <div className="py-16 text-center text-ink-dim">Reading the ledger…</div>
      )}

      {stats && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={Coins} value={fmtTokens(stats.totalCreatorAccrued)} label="tokens earned by creators" />
            <Tile icon={Landmark} value={fmtTokens(stats.totalRoyaltiesCollected)} label="total royalties collected" />
            <Tile icon={Repeat2} value={String(stats.totalTrades)} label="pool trades" />
            <Tile icon={Droplets} value={`${fmtHbar(stats.totalVolumeTinybar)} ℏ`} label="trade volume" />
          </div>

          <section className="mb-4 rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl">
            <h2 className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold text-ink-bright">
              <Radio size={13} className="animate-pulse-dot text-neon-cyan" /> Live activity
            </h2>
            {!recent && <div className="text-sm text-ink-dim">Reading pool events…</div>}
            {recent && recent.length === 0 && (
              <div className="text-sm text-ink-dim">No trades yet.</div>
            )}
            {recent && recent.length > 0 && (
              <ul className="m-0 flex list-none flex-col p-0">
                {recent.map((r, i) => (
                  <li
                    key={`${r.memeId}-${r.t}-${i}`}
                    className="flex items-center gap-3 border-b border-hairline py-2.5 text-sm last:border-b-0"
                  >
                    <Link
                      to={`/t/${r.memeId}`}
                      className="flex min-w-[120px] items-center gap-2 no-underline"
                    >
                      <TokenAvatar symbol={r.symbol} address={r.token} memo={r.memeMemo} size={24} />
                      <strong className="font-mono text-ink-bright">{r.symbol ?? "?"}</strong>
                    </Link>
                    <span
                      className={`font-mono text-xs font-bold ${
                        r.kind === "buy" ? "text-neon-green" : "text-neon-red"
                      }`}
                    >
                      {r.kind.toUpperCase()}
                    </span>
                    <span className="font-mono text-ink">{fmtHbar(r.hbarTinybar, 3)} ℏ</span>
                    <span className="ml-auto text-xs text-ink-dim">{timeAgo(r.t)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-dim">
              Straight from pool Buy/Sell events on the Hedera mirror node —
              every entry is a real, consensus-timestamped transaction.
            </p>
          </section>

          <div className="overflow-x-auto rounded-2xl border border-hairline bg-panel/50 backdrop-blur-xl">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-hairline">
                  {["Token", "Creator", "Earned", "Paid out", "Trades", "Volume", ""].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold tracking-wide text-ink-dim uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.tokens.map((t) => (
                  <tr key={t.id} className="border-b border-hairline last:border-b-0 hover:bg-surface/40">
                    <td className="px-4 py-3">
                      <Link to={`/t/${t.id}`} className="flex items-center gap-2 no-underline">
                        <TokenAvatar symbol={t.symbol} address={t.token} memo={t.memeMemo} size={26} />
                        <span className="font-mono font-bold text-ink-bright">
                          {t.symbol ?? shortAddr(t.token)}
                        </span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      <CreatorId addr={t.creator} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-ink-bright">
                      {fmtTokens(t.creatorAccrued)} {t.symbol ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-ink-bright">
                      {fmtTokens(t.creatorClaimed)} {t.symbol ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-ink">{t.trades}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-ink">
                      {fmtHbar(t.volumeTinybar)} ℏ
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <a
                        href={hashscanAddr(t.token)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-neon-cyan hover:underline"
                      >
                        HashScan <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-ink-dim">
            Creator earnings come from each token's on-chain vesting ledger;
            trades and volume from pool Buy/Sell events on the Hedera mirror
            node. Nothing here is self-reported.
          </p>
        </>
      )}
    </div>
  );
}
