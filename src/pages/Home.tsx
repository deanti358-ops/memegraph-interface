import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchMemes,
  fmtHbar,
  fmtPrice,
  poolRead,
  shortAddr,
  type MemeInfo,
} from "../lib/memegraph";
import { network } from "../config";

type Row = MemeInfo & { price?: bigint; hbarReserve?: bigint };

export default function Home() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [centsPerHbar, setCentsPerHbar] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const memes = await fetchMemes();
        if (!alive) return;
        setRows(memes);
        for (const m of memes) {
          try {
            const pool = poolRead(m.pool);
            const [price, reserves] = await Promise.all([
              pool.getPrice(),
              pool.getReserves(),
            ]);
            if (!alive) return;
            setRows((prev) =>
              prev
                ? prev.map((r) =>
                    r.id === m.id
                      ? { ...r, price, hbarReserve: reserves[0] }
                      : r
                  )
                : prev
            );
          } catch {
            /* pool unreadable; leave blank */
          }
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
    })();
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
    if (!rows) return null;
    let sum = 0n;
    let counted = 0;
    for (const r of rows) {
      if (r.hbarReserve !== undefined) {
        sum += r.hbarReserve;
        counted++;
      }
    }
    return counted > 0 ? sum : null;
  }, [rows]);

  const tvlUsd =
    tvl !== null && centsPerHbar !== null
      ? (Number(tvl) / 1e8) * (centsPerHbar / 100)
      : null;

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
          locked permanently across {rows?.length ?? "…"} meme pool
          {rows && rows.length === 1 ? "" : "s"} — reserves can never be
          withdrawn.
        </div>
      </div>

      {error && <div className="error">Failed to load: {error}</div>}
      {!rows && !error && <div className="muted">Loading tokens…</div>}
      {rows && rows.length === 0 && (
        <div className="empty">
          No memes launched yet. <Link to="/launch">Be the first.</Link>
        </div>
      )}

      <div className="grid">
        {rows?.map((m) => (
          <Link to={`/t/${m.id}`} key={m.id} className="card">
            <div className="card-head">
              <span className="token-symbol">{m.symbol ?? "…"}</span>
              <span className="badge">#{m.id}</span>
            </div>
            <div className="token-name">{m.name ?? "Loading…"}</div>
            <dl className="card-stats">
              <div>
                <dt>Price</dt>
                <dd>{m.price !== undefined ? `${fmtPrice(m.price)} ℏ` : "—"}</dd>
              </div>
              <div>
                <dt>Liquidity</dt>
                <dd>
                  {m.hbarReserve !== undefined
                    ? `${fmtHbar(m.hbarReserve)} ℏ`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Creator</dt>
                <dd className="mono">{shortAddr(m.creator)}</dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>
    </div>
  );
}
