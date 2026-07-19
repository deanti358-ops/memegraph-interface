import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  factoryRead,
  fetchMemes,
  fmtTokens,
  shortAddr,
  hashscanAddr,
  type MemeInfo,
} from "../lib/memegraph";

type Row = MemeInfo & { pending?: bigint };

export default function Creators() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const memes = await fetchMemes();
        if (!alive) return;
        setRows(memes);
        const factory = factoryRead();
        for (const m of memes) {
          try {
            const pending: bigint = await factory.pendingRoyalties(m.token);
            if (!alive) return;
            setRows((prev) =>
              prev ? prev.map((r) => (r.id === m.id ? { ...r, pending } : r)) : prev
            );
          } catch {
            /* skip */
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
      <h1>Creators get paid</h1>
      <p className="sub">
        0.4% of every transfer of every token, collected by the Hedera network
        and claimable by anyone hitting “distribute”. This board is the
        receipts.
      </p>

      {error && <div className="error">{error}</div>}
      {!rows && !error && <div className="muted">Loading…</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Creator</th>
            <th>Undistributed royalties</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((m) => (
            <tr key={m.id}>
              <td>
                <Link to={`/t/${m.id}`}>
                  {m.symbol ?? shortAddr(m.token)}
                </Link>
              </td>
              <td className="mono">
                <a href={hashscanAddr(m.creator)} target="_blank" rel="noreferrer">
                  {shortAddr(m.creator)}
                </a>
              </td>
              <td>
                {m.pending !== undefined
                  ? `${fmtTokens(m.pending)} ${m.symbol ?? ""}`
                  : "…"}
              </td>
              <td>
                <Link to={`/t/${m.id}`} className="link">
                  trade →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
