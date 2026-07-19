import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchMemes,
  fmtHbar,
  fmtPrice,
  poolRead,
  shortAddr,
  type MemeInfo,
} from "../lib/memegraph";

type Row = MemeInfo & { price?: bigint; hbarReserve?: bigint };

export default function Home() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const memes = await fetchMemes();
        if (!alive) return;
        setRows(memes);
        // hydrate prices in the background
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
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <div className="hero-strip">
        <div>
          <h1>The meme board</h1>
          <p className="sub">
            Every token pays its creator 0.4% of <em>every</em> transfer,
            forever — enforced by Hedera itself, not by a promise.
          </p>
        </div>
        <Link to="/launch" className="btn btn-primary">
          Launch a meme
        </Link>
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
