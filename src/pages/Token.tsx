import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { parseEther, parseUnits, MaxUint256 } from "ethers";
import { useWallet } from "../lib/wallet";
import {
  factoryRead,
  factoryWrite,
  fmtHbar,
  fmtPrice,
  fmtTokens,
  hashscanAddr,
  poolRead,
  poolWrite,
  shortAddr,
  tokenRead,
  tokenWrite,
  mirrorToken,
  HBAR_DECIMALS,
  TOKEN_DECIMALS,
  type MemeInfo,
} from "../lib/memegraph";
import { DEFAULT_SLIPPAGE_BPS } from "../config";

type Details = MemeInfo & {
  price: bigint;
  hbarReserve: bigint;
  tokenReserve: bigint;
  pending: bigint;
};

export default function Token() {
  const { id } = useParams();
  const { account, connect, getSigner } = useWallet();

  const [d, setD] = useState<Details | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const memeId = Number(id);
    if (!memeId) return;
    const factory = factoryRead();
    const m = await factory.getMeme(memeId);
    const pool = poolRead(m.pool);
    const [price, reserves, pending, info] = await Promise.all([
      pool.getPrice(),
      pool.getReserves(),
      factory.pendingRoyalties(m.token),
      mirrorToken(m.token).catch(() => undefined),
    ]);
    setD({
      id: memeId,
      token: m.token,
      pool: m.pool,
      creator: m.creator,
      memeMemo: m.memeMemo,
      launchedAt: Number(m.launchedAt),
      price,
      hbarReserve: reserves[0],
      tokenReserve: reserves[1],
      pending,
      name: info?.name,
      symbol: info?.symbol,
    });
    if (account) {
      setBalance(await tokenRead(m.token).balanceOf(account));
    }
  }, [id, account]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, [refresh]);

  // Quote on amount change
  useEffect(() => {
    let alive = true;
    setQuote(null);
    if (!d || !amount || Number(amount) <= 0) return;
    const pool = poolRead(d.pool);
    (async () => {
      try {
        const q =
          tab === "buy"
            ? await pool.getTokensOut(parseUnits(amount, HBAR_DECIMALS))
            : await pool.getHbarOut(parseUnits(amount, TOKEN_DECIMALS));
        if (alive) setQuote(q);
      } catch {
        if (alive) setQuote(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [d, amount, tab]);

  async function onTrade() {
    if (!d) return;
    setError(null);
    if (!account) {
      await connect();
      return;
    }
    if (!amount || Number(amount) <= 0 || quote === null) return;
    setBusy(true);
    try {
      const signer = await getSigner();
      const pool = poolWrite(d.pool, signer);
      const minOut = (quote * BigInt(10_000 - DEFAULT_SLIPPAGE_BPS)) / 10_000n;

      if (tab === "buy") {
        setStatus("Confirm the buy in your wallet…");
        const tx = await pool.buy(minOut, {
          value: parseEther(amount),
          gasLimit: 1_500_000,
        });
        setStatus("Buying…");
        await tx.wait();
      } else {
        const units = parseUnits(amount, TOKEN_DECIMALS);
        const token = tokenWrite(d.token, signer);
        const allowance: bigint = await token.allowance(account, d.pool);
        if (allowance < units) {
          setStatus("Approve the pool to spend your tokens…");
          const atx = await token.approve(d.pool, MaxUint256, {
            gasLimit: 1_000_000,
          });
          await atx.wait();
        }
        setStatus("Confirm the sell in your wallet…");
        const tx = await pool.sell(units, minOut, { gasLimit: 1_500_000 });
        setStatus("Selling…");
        await tx.wait();
      }
      setStatus("Done.");
      setAmount("");
      await refresh();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage || err.message || String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function onDistribute() {
    if (!d) return;
    setError(null);
    if (!account) {
      await connect();
      return;
    }
    setBusy(true);
    try {
      const signer = await getSigner();
      setStatus("Confirm the distribution in your wallet…");
      const tx = await factoryWrite(signer).distributeRoyalties(d.token, {
        gasLimit: 1_500_000,
      });
      setStatus("Distributing royalties…");
      await tx.wait();
      setStatus("Royalties paid out.");
      await refresh();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage || err.message || String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  if (!d) {
    return (
      <div className="page">
        {error ? <div className="error">{error}</div> : <div className="muted">Loading…</div>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="token-header">
        <div>
          <h1>
            {d.name ?? "…"} <span className="token-symbol big">{d.symbol ?? ""}</span>
          </h1>
          <div className="muted mono">
            token <a href={hashscanAddr(d.token)} target="_blank" rel="noreferrer">{shortAddr(d.token)}</a>
            {" · "}pool <a href={hashscanAddr(d.pool)} target="_blank" rel="noreferrer">{shortAddr(d.pool)}</a>
            {" · "}creator <a href={hashscanAddr(d.creator)} target="_blank" rel="noreferrer">{shortAddr(d.creator)}</a>
          </div>
        </div>
        <div className="price-tag">
          <div className="price">{fmtPrice(d.price)} ℏ</div>
          <div className="muted">per token</div>
        </div>
      </div>

      <div className="token-layout">
        <section className="panel">
          <h2>Trade</h2>
          <div className="tabs">
            <button
              className={tab === "buy" ? "tab active" : "tab"}
              onClick={() => {
                setTab("buy");
                setAmount("");
              }}
            >
              Buy
            </button>
            <button
              className={tab === "sell" ? "tab active" : "tab"}
              onClick={() => {
                setTab("sell");
                setAmount("");
              }}
            >
              Sell
            </button>
          </div>

          <label className="amount-label">
            {tab === "buy" ? "Spend (HBAR)" : `Sell (${d.symbol ?? "tokens"})`}
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
            />
          </label>

          {tab === "sell" && balance !== null && (
            <div className="muted small">
              Balance: {fmtTokens(balance)} {d.symbol}{" "}
              <button
                className="link"
                onClick={() => setAmount((Number(balance) / 10 ** TOKEN_DECIMALS).toString())}
              >
                max
              </button>
            </div>
          )}

          {quote !== null && (
            <div className="quote">
              ≈ {tab === "buy" ? `${fmtTokens(quote)} ${d.symbol ?? ""}` : `${fmtHbar(quote, 4)} ℏ`}
              <span className="muted small">
                {" "}
                before the 1% network royalty · slippage {DEFAULT_SLIPPAGE_BPS / 100}%
              </span>
            </div>
          )}

          <button className="btn btn-primary wide" onClick={onTrade} disabled={busy}>
            {busy
              ? "Working…"
              : !account
              ? "Connect wallet"
              : tab === "buy"
              ? "Buy"
              : "Sell"}
          </button>

          {status && <div className="status">{status}</div>}
          {error && <div className="error">{error}</div>}
        </section>

        <section className="panel">
          <h2>Token</h2>
          <dl className="stat-list">
            <div>
              <dt>Pool liquidity</dt>
              <dd>
                {fmtHbar(d.hbarReserve)} ℏ / {fmtTokens(d.tokenReserve)} {d.symbol}
              </dd>
            </div>
            <div>
              <dt>Provenance</dt>
              <dd className="mono small">{d.memeMemo || "—"}</dd>
            </div>
            <div>
              <dt>Launched</dt>
              <dd>{new Date(d.launchedAt * 1000).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Pending royalties</dt>
              <dd>
                {fmtTokens(d.pending)} {d.symbol}
              </dd>
            </div>
          </dl>

          <button
            className="btn wide"
            onClick={onDistribute}
            disabled={busy || d.pending === 0n}
            title="Anyone can trigger a payout — 40% creator, 40% protocol, 20% pool"
          >
            Distribute royalties
          </button>

          <p className="muted small">
            1% of every transfer is collected by the network itself. Payouts
            split 0.4% creator / 0.4% protocol / 0.2% pool. The token has no
            admin, supply, pause, or fee keys — nothing about it can ever be
            changed.
          </p>
        </section>
      </div>
    </div>
  );
}
