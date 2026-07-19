import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fmtHbar,
  fmtTokens,
  shortAddr,
  hashscanAddr,
} from "../lib/memegraph";
import { fetchNetworkStats, type NetworkStats } from "../lib/stats";
import TokenAvatar from "../components/TokenAvatar";

export default function Creators() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNetworkStats()
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(String(e)));
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
