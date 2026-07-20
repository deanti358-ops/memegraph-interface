import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { parseUnits } from "ethers";
import { useWallet } from "../lib/wallet";
import {
  factoryRead,
  fetchHbarUsd,
  fmtHbar,
  fmtPrice,
  fmtTokens,
  fmtUsd,
  hashscanAddr,
  poolRead,
  shortAddr,
  tokenRead,
  mirrorToken,
  HBAR_DECIMALS,
  TOKEN_DECIMALS,
  type MemeInfo,
} from "../lib/memegraph";
import { DEFAULT_SLIPPAGE_BPS, network } from "../config";
import PriceChart from "../components/PriceChart";
import TokenAvatar from "../components/TokenAvatar";
import CreatorId from "../components/CreatorId";
import { fetchPriceHistory, type PricePoint } from "../lib/priceHistory";

type Details = MemeInfo & {
  price: bigint;
  hbarReserve: bigint;
  tokenReserve: bigint;
  pending: bigint;
  vestAccrued: bigint;
  vestClaimed: bigint;
  vestClaimable: bigint;
  safety?: import("../lib/memegraph").MirrorTokenInfo["safety"];
};

/** Range presets — window on trailing time, All shows everything. */
const TIMEFRAMES: { label: string; seconds: number | null }[] = [
  { label: "1m", seconds: 60 },
  { label: "2m", seconds: 120 },
  { label: "5m", seconds: 300 },
  { label: "10m", seconds: 600 },
  { label: "20m", seconds: 1200 },
  { label: "1h", seconds: 3600 },
  { label: "All", seconds: null },
];

/** Filters points to a trailing window **anchored to the latest trade**
    (not wall-clock now — on a quiet pool every short window would be empty).
    Carries in the entry price so the line starts at the left edge. */
function ChartWindow({
  points,
  windowSec,
  symbol,
}: {
  points: PricePoint[];
  windowSec: number | null;
  symbol: string;
}) {
  let visible = points;
  if (windowSec !== null && points.length > 0) {
    const anchor = points[points.length - 1].t;
    const from = anchor - windowSec;
    const inside = points.filter((p) => p.t >= from);
    const before = points.filter((p) => p.t < from);
    const carryIn = before.length
      ? [{ ...before[before.length - 1], t: from }]
      : [];
    visible = [...carryIn, ...inside];
  }
  if (visible.length < 2) {
    return (
      <div className="muted small">
        No trades in this window — pick a longer timeframe.
      </div>
    );
  }
  return <PriceChart points={visible} symbol={symbol} />;
}

export default function Token() {
  const { id } = useParams();
  const { adapter, evmAddress, displayAccount } = useWallet();

  const [d, setD] = useState<Details | null>(null);
  const [history, setHistory] = useState<PricePoint[] | null>(null);
  const [timeframe, setTimeframe] = useState<number | null>(null); // seconds
  const [hbarUsd, setHbarUsd] = useState<number | null>(null);

  useEffect(() => {
    fetchHbarUsd().then(setHbarUsd);
  }, []);
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
    const [price, reserves, pending, vesting, claimable, info] =
      await Promise.all([
        pool.getPrice(),
        pool.getReserves(),
        factory.pendingRoyalties(m.token),
        factory.creatorVesting(m.token),
        factory.claimableCreatorRoyalties(m.token),
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
      vestAccrued: vesting.accrued,
      vestClaimed: vesting.claimed,
      vestClaimable: claimable,
      name: info?.name,
      symbol: info?.symbol,
      safety: info?.safety,
    });
    if (evmAddress) {
      setBalance(await tokenRead(m.token).balanceOf(evmAddress));
    } else {
      setBalance(null);
    }

    // Price history from pool events (fire-and-forget; mirror node lags a
    // few seconds behind consensus, so this may trail fresh trades briefly).
    const seed = await factory.poolSeed().catch(() => 500_000_000n);
    const seedPrice = Number(seed) / 1e8 / 1_000_000_000;
    fetchPriceHistory(m.pool, Number(m.launchedAt), seedPrice)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [id, evmAddress]);

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
    if (!adapter || !evmAddress) {
      setError("Connect a wallet first (top right).");
      return;
    }
    if (!amount || Number(amount) <= 0 || quote === null) return;
    setBusy(true);
    try {
      const minOut = (quote * BigInt(10_000 - DEFAULT_SLIPPAGE_BPS)) / 10_000n;
      if (tab === "buy") {
        await adapter.buy(d.token, d.pool, amount, minOut, setStatus);
      } else {
        const units = parseUnits(amount, TOKEN_DECIMALS);
        await adapter.sellWithApproval(
          d.token,
          d.pool,
          units,
          minOut,
          evmAddress,
          setStatus
        );
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
    if (!adapter) {
      setError("Connect a wallet first (top right).");
      return;
    }
    setBusy(true);
    try {
      await adapter.distribute(d.token, setStatus);
      setStatus("Royalties distributed.");
      await refresh();
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage || err.message || String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function onClaimCreator() {
    if (!d) return;
    setError(null);
    if (!adapter) {
      setError("Connect a wallet first (top right).");
      return;
    }
    setBusy(true);
    try {
      await adapter.claimCreator(d.token, setStatus);
      setStatus("Vested royalties sent to the creator.");
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
        <div className="token-cell">
          <TokenAvatar symbol={d.symbol} address={d.token} memo={d.memeMemo} size={56} />
          <div>
            <h1>
              {d.name ?? "…"} <span className="token-symbol big">{d.symbol ?? ""}</span>
            </h1>
            <div className="muted mono">
              token <a href={hashscanAddr(d.token)} target="_blank" rel="noreferrer">{shortAddr(d.token)}</a>
              {" · "}pool <a href={hashscanAddr(d.pool)} target="_blank" rel="noreferrer">{shortAddr(d.pool)}</a>
              {" · "}creator <CreatorId addr={d.creator} />
            </div>
          </div>
        </div>
        <div className="price-tag">
          <div className="price">{fmtPrice(d.price)} ℏ</div>
          <div className="muted">
            {hbarUsd !== null
              ? `${fmtUsd((Number(d.price) / 1e18) * hbarUsd)} per token`
              : "per token"}
          </div>
          {hbarUsd !== null && (
            <div className="muted small">
              mkt cap {fmtUsd((Number(d.price) / 1e18) * 1e9 * hbarUsd)}
            </div>
          )}
        </div>
      </div>

      {d.safety && (
        <div className="safety-row" title="Verified live from the Hedera mirror node — not self-reported">
          {[
            { ok: d.safety.noAdminKey, label: "No admin key" },
            { ok: d.safety.noFeeScheduleKey, label: "Royalty immutable" },
            { ok: d.safety.noSupplyKey && d.safety.finiteSupply, label: "Fixed supply" },
            { ok: d.safety.noPauseOrFreeze, label: "No pause/freeze/wipe" },
            { ok: true, label: "Permanent liquidity" },
          ].map((b) => (
            <span key={b.label} className={b.ok ? "safety-badge ok" : "safety-badge bad"}>
              {b.ok ? "✓" : "✗"} {b.label}
            </span>
          ))}
        </div>
      )}

      <section className="panel chart-panel">
        <h2>Price · ℏ per {d.symbol ?? "token"}</h2>
        <div className="tf-row" role="group" aria-label="Chart timeframe">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              className={timeframe === tf.seconds ? "tf-btn active" : "tf-btn"}
              onClick={() => setTimeframe(tf.seconds)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        {history === null ? (
          <div className="muted small">Loading trade history…</div>
        ) : (
          <ChartWindow
            points={history}
            windowSec={timeframe}
            symbol={d.symbol ?? "token"}
          />
        )}
      </section>

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
              : !displayAccount
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
              <dd className="mono small">
                {d.memeMemo.startsWith("hcs:") ? (
                  <a
                    href={`${network.hashscanUrl}/topic/${d.memeMemo.slice(4).split("/")[0]}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Immutable claim record on the Hedera Consensus Service"
                  >
                    {d.memeMemo}
                  </a>
                ) : (
                  d.memeMemo || "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Launched</dt>
              <dd>{new Date(d.launchedAt * 1000).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Undistributed royalties</dt>
              <dd>
                {fmtTokens(d.pending)} {d.symbol}
              </dd>
            </div>
            <div>
              <dt>Creator vesting</dt>
              <dd>
                {fmtTokens(d.vestAccrued - d.vestClaimed)} {d.symbol} locked ·{" "}
                {fmtTokens(d.vestClaimable)} claimable
              </dd>
            </div>
          </dl>

          <button
            className="btn wide"
            onClick={onDistribute}
            disabled={busy || d.pending === 0n}
            title="Anyone can trigger — protocol and pool pay out now, the creator share starts vesting"
          >
            Distribute royalties
          </button>
          <button
            className="btn wide"
            onClick={onClaimCreator}
            disabled={busy || d.vestClaimable === 0n}
            title="Anyone can trigger — pays the creator everything vested so far"
          >
            Pay creator vested royalties
          </button>

          <p className="muted small">
            1% of every transfer is collected by the network itself. Payouts
            split 0.4% creator / 0.4% protocol / 0.2% pool; the creator share
            vests linearly over 90 days from launch, so dumping early forfeits
            the upside. The token has no admin, supply, pause, or fee keys —
            nothing about it can ever be changed.
          </p>
        </section>
      </div>
    </div>
  );
}
