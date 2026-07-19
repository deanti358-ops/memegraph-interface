import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchHbarUsd,
  fmtHbar,
  fmtTokens,
  shortAddr,
  hashscanAddr,
} from "../lib/memegraph";
import { fetchNetworkStats, type NetworkStats } from "../lib/stats";
import TokenAvatar from "../components/TokenAvatar";

/** Hedera grant Milestone 3 targets — one of these must be met. */
const M3 = { tx: 25_000, wallets: 200, tvlUsd: 20_000 };

function MilestoneBar({
  label,
  value,
  target,
  display,
}: {
  label: string;
  value: number;
  target: number;
  display: string;
}) {
  const pct = Math.min(100, (value / target) * 100);
  return (
    <div className="milestone">
      <div className="milestone-head">
        <span>{label}</span>
        <span className="mono">{display}</span>
      </div>
      <div className="milestone-track">
        <div className="milestone-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Creators() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [hbarUsd, setHbarUsd] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNetworkStats()
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(String(e)));
    fetchHbarUsd().then((v) => alive && setHbarUsd(v));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <h1>Creators get paid</h1>
      <p className="sub">
        0.4% of every transfer of every token, collected by the Hedera network
        itself and vesting to the creator over 90 days. Every number below is
        public, on-chain, and verifiable — this board is the receipts.
      </p>

      {error && <div className="error">{error}</div>}
      {!stats && !error && <div className="muted">Reading the ledger…</div>}

      {stats && (
        <>
          <div className="stat-tiles">
            <div className="tile">
              <div className="tile-value">
                {fmtTokens(stats.totalCreatorAccrued)}
              </div>
              <div className="tile-label">tokens earned by creators</div>
            </div>
            <div className="tile">
              <div className="tile-value">
                {fmtTokens(stats.totalRoyaltiesCollected)}
              </div>
              <div className="tile-label">total royalties collected</div>
            </div>
            <div className="tile">
              <div className="tile-value">{stats.totalTrades}</div>
              <div className="tile-label">pool trades</div>
            </div>
            <div className="tile">
              <div className="tile-value">
                {fmtHbar(stats.totalVolumeTinybar)} ℏ
              </div>
              <div className="tile-label">trade volume</div>
            </div>
          </div>

          <section className="panel milestone-panel">
            <h2>Grant milestone progress · last 30 days</h2>
            <MilestoneBar
              label={`Monthly transactions (target ${M3.tx.toLocaleString()})`}
              value={stats.trades30d}
              target={M3.tx}
              display={stats.trades30d.toLocaleString()}
            />
            <MilestoneBar
              label={`Active wallets (target ${M3.wallets})`}
              value={stats.activeWallets30d}
              target={M3.wallets}
              display={stats.activeWallets30d.toLocaleString()}
            />
            <MilestoneBar
              label={`TVL (target $${M3.tvlUsd.toLocaleString()})`}
              value={
                hbarUsd !== null
                  ? (Number(stats.tvlTinybar) / 1e8) * hbarUsd
                  : 0
              }
              target={M3.tvlUsd}
              display={
                hbarUsd !== null
                  ? `$${((Number(stats.tvlTinybar) / 1e8) * hbarUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : `${fmtHbar(stats.tvlTinybar)} ℏ`
              }
            />
            <p className="muted small">
              Counted from on-chain pool events and reserves via the Hedera
              mirror node — the same numbers the grant program verifies.
              Milestone 3 requires any one of the three.
            </p>
          </section>

          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Creator</th>
                <th>Earned</th>
                <th>Paid out</th>
                <th>Trades</th>
                <th>Volume</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.tokens.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/t/${t.id}`} className="token-cell">
                      <TokenAvatar symbol={t.symbol} address={t.token} size={26} />
                      {t.symbol ?? shortAddr(t.token)}
                    </Link>
                  </td>
                  <td className="mono">
                    <a
                      href={hashscanAddr(t.creator)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddr(t.creator)}
                    </a>
                  </td>
                  <td>
                    {fmtTokens(t.creatorAccrued)} {t.symbol ?? ""}
                  </td>
                  <td>
                    {fmtTokens(t.creatorClaimed)} {t.symbol ?? ""}
                  </td>
                  <td>{t.trades}</td>
                  <td>{fmtHbar(t.volumeTinybar)} ℏ</td>
                  <td>
                    <a
                      href={hashscanAddr(t.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="link"
                    >
                      HashScan →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <p className="muted small">
            Creator earnings come from each token's on-chain vesting ledger;
            trades and volume from pool Buy/Sell events on the Hedera mirror
            node. Nothing here is self-reported.
          </p>
        </>
      )}
    </div>
  );
}
