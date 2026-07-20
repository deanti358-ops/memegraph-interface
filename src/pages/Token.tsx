import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatEther, parseUnits } from "ethers";
import { ShieldCheck, ShieldX, ExternalLink, Droplets, FileText, Clock, Coins, Lock } from "lucide-react";
import { useWallet, readProvider } from "../lib/wallet";
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
      <div className="py-8 text-center text-sm text-ink-dim">
        No trades in this window — pick a longer timeframe.
      </div>
    );
  }
  return <PriceChart points={visible} symbol={symbol} />;
}

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline py-2.5 last:border-b-0">
      <dt className="text-xs font-semibold text-ink-dim">{label}</dt>
      <dd className="m-0 text-right font-mono text-sm font-bold text-ink-bright">
        {children}
      </dd>
    </div>
  );
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
  const [hbarBalance, setHbarBalance] = useState<number | null>(null);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<bigint | null>(null);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
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
      readProvider
        .getBalance(evmAddress)
        .then((b) => setHbarBalance(Number(formatEther(b))))
        .catch(() => setHbarBalance(null));
    } else {
      setBalance(null);
      setHbarBalance(null);
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
      const minOut = (quote * BigInt(10_000 - slippageBps)) / 10_000n;
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
      <div className="py-16 text-center">
        {error ? (
          <div className="mx-auto max-w-md rounded-xl border border-neon-red/40 bg-neon-red/5 px-4 py-3 text-sm text-neon-red">
            {error}
          </div>
        ) : (
          <div className="text-ink-dim">Loading…</div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* ---------- header ---------- */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <TokenAvatar symbol={d.symbol} address={d.token} memo={d.memeMemo} size={56} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold text-ink-bright">
              {d.name ?? "…"}{" "}
              <span className="font-mono text-base font-bold text-neon-cyan">
                ${d.symbol ?? ""}
              </span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-ink-dim">
              <a href={hashscanAddr(d.token)} target="_blank" rel="noreferrer" className="hover:text-neon-cyan">
                token {shortAddr(d.token)}
              </a>
              <span>·</span>
              <a href={hashscanAddr(d.pool)} target="_blank" rel="noreferrer" className="hover:text-neon-cyan">
                pool {shortAddr(d.pool)}
              </a>
              <span>·</span>
              <span>
                creator <CreatorId addr={d.creator} />
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-2xl font-bold text-ink-bright">
            {fmtPrice(d.price)} <span className="text-base text-ink-dim">ℏ</span>
          </div>
          <div className="text-xs text-ink-dim">
            {hbarUsd !== null
              ? `${fmtUsd((Number(d.price) / 1e18) * hbarUsd)} per token`
              : "per token"}
          </div>
          {hbarUsd !== null && (
            <div className="text-xs text-ink-dim">
              mkt cap {fmtUsd((Number(d.price) / 1e18) * 1e9 * hbarUsd)}
            </div>
          )}
        </div>
      </div>

      {/* ---------- safety badges ---------- */}
      {d.safety && (
        <div
          className="mb-4 flex flex-wrap gap-2"
          title="Verified live from the Hedera mirror node — not self-reported"
        >
          {[
            { ok: d.safety.noAdminKey, label: "No admin key" },
            { ok: d.safety.noFeeScheduleKey, label: "Royalty immutable" },
            { ok: d.safety.noSupplyKey && d.safety.finiteSupply, label: "Fixed supply" },
            { ok: d.safety.noPauseOrFreeze, label: "No pause/freeze/wipe" },
            { ok: true, label: "Permanent liquidity" },
          ].map((b) => (
            <span
              key={b.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md ${
                b.ok
                  ? "border-neon-green/30 bg-neon-green/10 text-neon-green"
                  : "border-neon-red/30 bg-neon-red/10 text-neon-red"
              }`}
            >
              {b.ok ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
              {b.label}
            </span>
          ))}
        </div>
      )}

      {/* ---------- chart ---------- */}
      <section className="mb-4 rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-ink-bright">
            Price · ℏ per {d.symbol ?? "token"}
          </h2>
          <div
            className="flex gap-1 overflow-x-auto rounded-xl border border-hairline bg-surface/60 p-1"
            role="group"
            aria-label="Chart timeframe"
          >
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.label}
                onClick={() => setTimeframe(tf.seconds)}
                className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-xs font-bold transition-all duration-200 ${
                  timeframe === tf.seconds
                    ? "bg-gradient-to-r from-neon-purple to-neon-pink text-white"
                    : "text-ink-dim hover:text-ink-bright"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        {history === null ? (
          <div className="py-8 text-center text-sm text-ink-dim">Loading trade history…</div>
        ) : (
          <ChartWindow points={history} windowSec={timeframe} symbol={d.symbol ?? "token"} />
        )}
      </section>

      {/* ---------- trade + stats ---------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl">
          <h2 className="mb-3 font-display text-sm font-bold text-ink-bright">Trade</h2>

          <div className="mb-3 flex gap-1 rounded-xl border border-hairline bg-surface/60 p-1">
            {(["buy", "sell"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setTab(k);
                  setAmount("");
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold capitalize transition-all duration-200 ${
                  tab === k
                    ? k === "buy"
                      ? "bg-neon-green/15 text-neon-green"
                      : "bg-neon-red/15 text-neon-red"
                    : "text-ink-dim hover:text-ink-bright"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs font-semibold text-ink-dim">
            {tab === "buy" ? "Amount (HBAR)" : `Amount (${d.symbol ?? "tokens"})`}
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full rounded-xl border border-hairline bg-surface/60 px-3.5 py-2.5 pr-14 font-mono text-base text-ink-bright outline-none transition-all duration-200 placeholder:text-ink-dim focus:border-neon-cyan focus:shadow-[0_0_16px_-6px_var(--color-neon-cyan)]"
            />
            <button
              onClick={() => {
                if (tab === "buy") {
                  if (hbarBalance === null) return;
                  setAmount(Math.max(0, hbarBalance - 0.5).toFixed(4));
                } else if (balance !== null) {
                  setAmount((Number(balance) / 10 ** TOKEN_DECIMALS).toString());
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-hairline px-2 py-1 text-[11px] font-bold text-ink-bright transition-colors duration-200 hover:bg-neon-purple/30"
            >
              MAX
            </button>
          </div>

          {/* percentage quick-picks */}
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {[10, 25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  if (tab === "buy") {
                    if (hbarBalance === null) return;
                    const spendable = Math.max(0, hbarBalance - 0.5);
                    setAmount(((spendable * pct) / 100).toFixed(4));
                  } else if (balance !== null) {
                    const bal = Number(balance) / 10 ** TOKEN_DECIMALS;
                    setAmount(((bal * pct) / 100).toString());
                  }
                }}
                className="rounded-lg border border-hairline bg-surface/40 py-1.5 font-mono text-[11px] font-bold text-ink transition-all duration-200 hover:border-neon-purple hover:text-ink-bright"
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* slippage tolerance */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-dim">Slippage</span>
            <div className="flex gap-1">
              {[50, 100, 200, 300].map((bps) => (
                <button
                  key={bps}
                  onClick={() => setSlippageBps(bps)}
                  className={`rounded-lg px-2 py-1 font-mono text-[11px] font-bold transition-all duration-200 ${
                    slippageBps === bps
                      ? "bg-gradient-to-r from-neon-purple to-neon-pink text-white"
                      : "border border-hairline bg-surface/40 text-ink-dim hover:text-ink-bright"
                  }`}
                >
                  {(bps / 100).toFixed(1)}%
                </button>
              ))}
            </div>
          </div>

          {/* balance + estimated receive */}
          <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-hairline bg-surface/40 px-3.5 py-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-dim">Balance</span>
              <span className="font-mono text-ink-bright">
                {tab === "buy"
                  ? hbarBalance !== null
                    ? `${hbarBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} ℏ`
                    : "—"
                  : balance !== null
                  ? `${fmtTokens(balance)} ${d.symbol ?? ""}`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-dim">You receive</span>
              <span className="font-mono font-bold text-ink-bright">
                {quote !== null
                  ? tab === "buy"
                    ? `~${fmtTokens(quote)} ${d.symbol ?? ""}`
                    : `~${fmtHbar(quote, 4)} ℏ`
                  : "—"}
              </span>
            </div>
            <div className="text-[11px] text-ink-dim">
              before the 1% network royalty
            </div>
          </div>

          <button
            onClick={onTrade}
            disabled={busy}
            className={`mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 ${
              tab === "buy"
                ? "bg-gradient-to-r from-neon-green to-neon-cyan shadow-[0_0_20px_-8px_var(--color-neon-green)] hover:scale-[1.02]"
                : "bg-gradient-to-r from-neon-red to-neon-pink shadow-[0_0_20px_-8px_var(--color-neon-red)] hover:scale-[1.02]"
            }`}
          >
            {busy ? "Working…" : !displayAccount ? "Connect wallet" : tab === "buy" ? "Buy" : "Sell"}
          </button>

          {status && <div className="mt-3 text-sm font-semibold text-neon-green">{status}</div>}
          {error && <div className="mt-3 text-sm text-neon-red">{error}</div>}
        </section>

        <section className="rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl">
          <h2 className="mb-2 font-display text-sm font-bold text-ink-bright">Token</h2>
          <dl className="m-0">
            <StatRow label="Pool liquidity">
              <span className="inline-flex items-center gap-1.5">
                <Droplets size={13} className="text-neon-cyan" />
                {fmtHbar(d.hbarReserve)} ℏ / {fmtTokens(d.tokenReserve)} {d.symbol}
              </span>
            </StatRow>
            <StatRow label="Provenance">
              {d.memeMemo.startsWith("hcs:") ? (
                <a
                  href={`${network.hashscanUrl}/topic/${d.memeMemo.slice(4).split("/")[0]}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Immutable claim record on the Hedera Consensus Service"
                  className="inline-flex items-center gap-1.5 text-neon-cyan hover:underline"
                >
                  <FileText size={13} />
                  {d.memeMemo}
                  <ExternalLink size={11} />
                </a>
              ) : (
                d.memeMemo || "—"
              )}
            </StatRow>
            <StatRow label="Launched">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} className="text-ink-dim" />
                {new Date(d.launchedAt * 1000).toLocaleString()}
              </span>
            </StatRow>
            <StatRow label="Undistributed royalties">
              <span className="inline-flex items-center gap-1.5">
                <Coins size={13} className="text-neon-purple" />
                {fmtTokens(d.pending)} {d.symbol}
              </span>
            </StatRow>
            <StatRow label="Creator vesting">
              <span className="inline-flex items-center gap-1.5">
                <Lock size={13} className="text-neon-pink" />
                {fmtTokens(d.vestAccrued - d.vestClaimed)} locked · {fmtTokens(d.vestClaimable)} claimable
              </span>
            </StatRow>
          </dl>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={onDistribute}
              disabled={busy || d.pending === 0n}
              title="Anyone can trigger — protocol and pool pay out now, the creator share starts vesting"
              className="w-full rounded-xl border border-hairline bg-surface/60 py-2.5 text-sm font-bold text-ink transition-all duration-200 hover:border-neon-purple hover:text-ink-bright disabled:cursor-default disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-ink"
            >
              Distribute royalties
            </button>
            <button
              onClick={onClaimCreator}
              disabled={busy || d.vestClaimable === 0n}
              title="Anyone can trigger — pays the creator everything vested so far"
              className="w-full rounded-xl border border-hairline bg-surface/60 py-2.5 text-sm font-bold text-ink transition-all duration-200 hover:border-neon-pink hover:text-ink-bright disabled:cursor-default disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-ink"
            >
              Pay creator vested royalties
            </button>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-ink-dim">
            1% of every transfer is collected by the network itself. Payouts split
            0.4% creator / 0.4% protocol / 0.2% pool; the creator share vests
            linearly over 90 days from launch, so dumping early forfeits the
            upside. The token has no admin, supply, pause, or fee keys — nothing
            about it can ever be changed.
          </p>
        </section>
      </div>
    </div>
  );
}
