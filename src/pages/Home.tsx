import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtHbar, fmtPrice, fmtTokens, fmtUsd, shortAddr } from "../lib/memegraph";
import { fetchNetworkStats, type TokenStats } from "../lib/stats";
import { network } from "../config";
import TokenAvatar from "../components/TokenAvatar";

type SortKey = "price" | "changePct" | "hbarReserve" | "volumeTinybar" | "trades";

function fmtChange(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export default function Home() {
  const [tokens, setTokens] = useState<TokenStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [centsPerHbar, setCentsPerHbar] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("volumeTinybar");
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchNetworkStats()
      .then((s) => alive && setTokens(s.tokens))
      .catch((e) => alive && setError(String(e)));
    // Live HBAR/USD rate from the network's own fee schedule
    fetch(`${network.mirrorNodeUrl}/network/exchangerate`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.current_rate) {
          setCentsPerHbar(
            d.current_rate.cent_equivalent / d.current_rate.hbar_equivalent
          );
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const tvl = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;
    return tokens.reduce((a, t) => a + t.hbarReserve, 0n);
  }, [tokens]);

  const tvlUsd =
    tvl !== null && centsPerHbar !== null
      ? (Number(tvl) / 1e8) * (centsPerHbar / 100)
      : null;

  const topPerformer = useMemo(() => {
    if (!tokens || tokens.length === 0) return null;
    return [...tokens].sort(
      (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity)
    )[0];
  }, [tokens]);

  const sorted = useMemo(() => {
    if (!tokens) return null;
    const dir = sortDesc ? -1 : 1;
    return [...tokens].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return av === bv ? 0 : (av < bv ? -1 : 1) * -dir * -1;
    });
  }, [tokens, sortKey, sortDesc]);

  function onSort(key: SortKey) {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      className={sortKey === k ? "sorted" : ""}
      onClick={() => onSort(k)}
      title="Sort"
    >
      {children} {sortKey === k ? (sortDesc ? "↓" : "↑") : ""}
    </th>
  );

  return (
    <div className="page">
      <div className="hero-strip">
        <div>
          <h1>Memes that pay their makers</h1>
          <p className="sub" style={{ marginBottom: 0 }}>
            Every token pays its creator 0.4% of <em>every</em> transfer,
            forever — enforced by the Hedera network itself, not by a promise.
          </p>
        </div>
        <Link to="/launch" className="btn btn-primary">
          Launch a meme
        </Link>
      </div>

      <div className="stat-hero">
        <div className="stat-label">Total value locked</div>
        <div className="stat-value">
          {tvl !== null ? fmtHbar(tvl) : "—"}
          <span className="unit">HBAR</span>
        </div>
        <div className="stat-sub">
          {tvlUsd !== null
            ? `≈ $${tvlUsd.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })} USD · `
            : ""}
          locked permanently across {tokens?.length ?? "…"} meme pool
          {tokens && tokens.length === 1 ? "" : "s"} — reserves can never be
          withdrawn.
        </div>
      </div>

      {topPerformer && (
        <Link to={`/t/${topPerformer.id}`} className="top-performer">
          <div className="token-cell">
            <TokenAvatar
              symbol={topPerformer.symbol}
              address={topPerformer.token}
              size={52}
            />
            <div>
              <div className="tp-label">🔥 Top performing memecoin</div>
              <div className="tp-name">
                {topPerformer.name ?? "…"}{" "}
                <span className="token-symbol">{topPerformer.symbol ?? ""}</span>
              </div>
              <div className="muted small mono">
                by {shortAddr(topPerformer.creator)}
              </div>
            </div>
          </div>
          <dl className="tp-stats">
            <div>
              <dt>Since launch</dt>
              <dd
                className={
                  (topPerformer.changePct ?? 0) >= 0 ? "delta-up" : "delta-down"
                }
              >
                {fmtChange(topPerformer.changePct)}
              </dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{fmtPrice(topPerformer.price)} ℏ</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd>{fmtHbar(topPerformer.volumeTinybar)} ℏ</dd>
            </div>
            <div>
              <dt>Creator earned</dt>
              <dd>
                {fmtTokens(topPerformer.creatorAccrued)}{" "}
                {topPerformer.symbol ?? ""}
              </dd>
            </div>
          </dl>
        </Link>
      )}

      {error && <div className="error">Failed to load: {error}</div>}
      {!tokens && !error && <div className="muted">Loading the market…</div>}
      {tokens && tokens.length === 0 && (
        <div className="empty">
          No memes launched yet. <Link to="/launch">Be the first.</Link>
        </div>
      )}

      {sorted && sorted.length > 0 && (
        <div className="table-wrap">
        <table className="table market-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Token</th>
              <Th k="price">Price</Th>
              <Th k="changePct">Since launch</Th>
              <Th k="price">Mkt cap</Th>
              <Th k="hbarReserve">Liquidity</Th>
              <Th k="volumeTinybar">Volume</Th>
              <Th k="trades">Trades</Th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td className="muted">{t.id}</td>
                <td>
                  <Link to={`/t/${t.id}`} className="token-cell">
                    <TokenAvatar symbol={t.symbol} address={t.token} size={30} />
                    <span>
                      <strong>{t.symbol ?? shortAddr(t.token)}</strong>{" "}
                      <span className="muted small">{t.name ?? ""}</span>
                    </span>
                  </Link>
                </td>
                <td className="mono">
                  {fmtPrice(t.price)} ℏ
                  {centsPerHbar !== null && (
                    <div className="muted small">
                      {fmtUsd((Number(t.price) / 1e18) * (centsPerHbar / 100))}
                    </div>
                  )}
                </td>
                <td
                  className={
                    (t.changePct ?? 0) >= 0
                      ? "mono delta-up"
                      : "mono delta-down"
                  }
                >
                  {fmtChange(t.changePct)}
                </td>
                <td className="mono">
                  {centsPerHbar !== null
                    ? fmtUsd(
                        (Number(t.price) / 1e18) * 1e9 * (centsPerHbar / 100)
                      )
                    : "—"}
                </td>
                <td className="mono">{fmtHbar(t.hbarReserve)} ℏ</td>
                <td className="mono">{fmtHbar(t.volumeTinybar)} ℏ</td>
                <td className="mono">{t.trades}</td>
                <td>
                  <Link to={`/t/${t.id}`} className="link">
                    Trade →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
