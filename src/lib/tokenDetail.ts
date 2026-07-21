import { Interface } from "ethers";
import { POOL_ABI } from "../abi";
import { network } from "../config";
import { tokenEntityId } from "./memegraph";

const poolInterface = new Interface(POOL_ABI);

// ---------------------------------------------------------------------------
// Trades — every Buy/Sell on the pool, from the mirror node event logs
// ---------------------------------------------------------------------------

export type Trade = {
  t: number; // unix seconds
  price: number; // HBAR per whole token, post-trade
  kind: "buy" | "sell";
  account: string; // EVM address of the trader
  hbarTinybar: bigint; // HBAR moved
};

export async function fetchTrades(pool: string): Promise<Trade[]> {
  const trades: Trade[] = [];
  let url = `${network.mirrorNodeUrl}/contracts/${pool.toLowerCase()}/results/logs?limit=100&order=asc`;
  for (let page = 0; url && page < 30; page++) {
    const res = await fetch(url);
    if (!res.ok) break;
    const d = await res.json();
    for (const log of d.logs ?? []) {
      try {
        const parsed = poolInterface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed?.name !== "Buy" && parsed?.name !== "Sell") continue;
        const hbarReserve = Number(parsed.args[3]);
        const tokenReserve = Number(parsed.args[4]);
        if (tokenReserve === 0) continue;
        trades.push({
          t: Math.floor(Number(log.timestamp.split(".")[0])),
          price: hbarReserve / tokenReserve,
          kind: parsed.name === "Buy" ? "buy" : "sell",
          account: String(parsed.args[0]).toLowerCase(),
          // Buy: hbarIn = args[1]; Sell: hbarOut = args[2]
          hbarTinybar: BigInt(
            parsed.name === "Buy" ? parsed.args[1] : parsed.args[2]
          ),
        });
      } catch {
        /* unrelated log */
      }
    }
    url = d.links?.next
      ? `${network.mirrorNodeUrl.replace("/api/v1", "")}${d.links.next}`
      : "";
  }
  return trades.sort((a, b) => a.t - b.t);
}

// ---------------------------------------------------------------------------
// Candles — OHLC aggregation of price points into fixed-width buckets
// ---------------------------------------------------------------------------

export type Candle = {
  t: number; // bucket start (unix seconds)
  o: number;
  h: number;
  l: number;
  c: number;
};

/**
 * Bucket a price series into OHLC candles of `bucketSec`. `prices` must be
 * ascending in time and include the launch seed as the first point so early
 * candles have an opening reference. Empty buckets are filled forward (a flat
 * candle at the previous close) so the timeline stays continuous.
 */
export function toCandles(
  prices: { t: number; price: number }[],
  bucketSec: number,
  maxCandles = 120
): Candle[] {
  if (prices.length === 0) return [];
  const byBucket = new Map<number, number[]>();
  for (const p of prices) {
    const b = Math.floor(p.t / bucketSec) * bucketSec;
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b)!.push(p.price);
  }
  const firstB = Math.floor(prices[0].t / bucketSec) * bucketSec;
  const lastB = Math.floor(prices[prices.length - 1].t / bucketSec) * bucketSec;

  const candles: Candle[] = [];
  let prevClose = prices[0].price;
  for (let b = firstB; b <= lastB; b += bucketSec) {
    const vals = byBucket.get(b);
    if (vals && vals.length) {
      const o = candles.length === 0 ? vals[0] : prevClose;
      const c = vals[vals.length - 1];
      candles.push({
        t: b,
        o,
        c,
        h: Math.max(o, c, ...vals),
        l: Math.min(o, c, ...vals),
      });
      prevClose = c;
    } else {
      candles.push({ t: b, o: prevClose, c: prevClose, h: prevClose, l: prevClose });
    }
  }
  // keep the most recent maxCandles so the chart stays readable
  return candles.slice(-maxCandles);
}

// ---------------------------------------------------------------------------
// Holders — top token holders from the mirror node balances endpoint
// ---------------------------------------------------------------------------

export type Holder = {
  account: string; // 0.0.x account id
  balance: bigint; // token units (8dp)
  pct: number; // % of total supply
  role: "curve" | "dev" | "wallet";
};

/**
 * Top holders of an HTS token. The pool is tagged "curve" (it holds the
 * unsold curve supply), the creator "dev", everyone else "wallet".
 * poolAccountId / creatorAccountId are 0.0.x ids for tagging.
 */
export async function fetchHolders(
  tokenEvm: string,
  poolAccountId: string | null,
  creatorAccountId: string | null,
  limit = 50
): Promise<{ holders: Holder[]; total: bigint; count: number }> {
  const id = tokenEntityId(tokenEvm);
  const res = await fetch(
    `${network.mirrorNodeUrl}/tokens/${id}/balances?order=desc&limit=${limit}`
  );
  if (!res.ok) return { holders: [], total: 0n, count: 0 };
  const d = await res.json();
  const rows: { account: string; balance: number }[] = d.balances ?? [];

  // total supply for percentages
  let total = 0n;
  try {
    const tRes = await fetch(`${network.mirrorNodeUrl}/tokens/${id}`);
    const tData = await tRes.json();
    total = BigInt(tData.total_supply ?? "0");
  } catch {
    /* fall back to sum below */
  }
  if (total === 0n) total = rows.reduce((a, r) => a + BigInt(r.balance), 0n);

  const holders: Holder[] = rows
    .filter((r) => r.balance > 0)
    .map((r) => {
      const bal = BigInt(r.balance);
      const role: Holder["role"] =
        poolAccountId && r.account === poolAccountId
          ? "curve"
          : creatorAccountId && r.account === creatorAccountId
          ? "dev"
          : "wallet";
      return {
        account: r.account,
        balance: bal,
        pct: total > 0n ? Number((bal * 10000n) / total) / 100 : 0,
        role,
      };
    });

  return { holders, total, count: holders.length };
}
