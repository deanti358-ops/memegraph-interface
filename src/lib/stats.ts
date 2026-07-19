import { Interface } from "ethers";
import { POOL_ABI } from "../abi";
import { network } from "../config";
import { factoryRead, fetchMemes, poolRead, type MemeInfo } from "./memegraph";

/**
 * Dashboard statistics, assembled from two sources:
 * - factory state views (creator vesting ledgers — lifetime earnings)
 * - pool Buy/Sell event logs from the mirror node (trades + HBAR volume)
 *
 * Royalty shares are fixed at 40/40/20, so lifetime creator accrual also
 * determines the protocol and pool shares without extra queries.
 */

const poolInterface = new Interface(POOL_ABI);

export type TokenStats = MemeInfo & {
  creatorAccrued: bigint; // lifetime creator earnings (vesting ledger)
  creatorClaimed: bigint;
  pendingDistribution: bigint;
  trades: number;
  volumeTinybar: bigint; // HBAR traded through the pool
  price: bigint; // getPrice() 1e18 fixed point
  hbarReserve: bigint; // pool liquidity, tinybars
  changePct: number | null; // price change since launch (vs seed price)
};

export type NetworkStats = {
  totalRoyaltiesCollected: bigint; // token units, all tokens (approx: 2.5x creator accrual)
  totalCreatorAccrued: bigint;
  totalCreatorClaimed: bigint;
  totalTrades: number;
  totalVolumeTinybar: bigint;
  /* grant-milestone metrics (30-day window, straight from pool events) */
  trades30d: number;
  activeWallets30d: number;
  tvlTinybar: bigint;
  tokens: TokenStats[];
};

type MirrorLog = { topics: string[]; data: string; timestamp: string };

type PoolTradeStats = {
  trades: number;
  volumeTinybar: bigint;
  trades30d: number;
  wallets30d: Set<string>;
};

async function poolTradeStats(pool: string): Promise<PoolTradeStats> {
  let trades = 0;
  let volume = 0n;
  let trades30d = 0;
  const wallets30d = new Set<string>();
  const cutoff = Date.now() / 1000 - 30 * 24 * 3600;

  let url = `${network.mirrorNodeUrl}/contracts/${pool.toLowerCase()}/results/logs?limit=100&order=asc`;
  for (let page = 0; url && page < 20; page++) {
    const res = await fetch(url);
    if (!res.ok) break;
    const d = await res.json();
    for (const log of (d.logs ?? []) as MirrorLog[]) {
      try {
        const parsed = poolInterface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed?.name !== "Buy" && parsed?.name !== "Sell") continue;
        trades++;
        volume += BigInt(
          parsed.name === "Buy" ? parsed.args.hbarIn : parsed.args.hbarOut
        );
        if (Number(log.timestamp.split(".")[0]) >= cutoff) {
          trades30d++;
          // arg 0 is the indexed buyer/seller address
          wallets30d.add(String(parsed.args[0]).toLowerCase());
        }
      } catch {
        /* unrelated log */
      }
    }
    url = d.links?.next
      ? `${network.mirrorNodeUrl.replace("/api/v1", "")}${d.links.next}`
      : "";
  }
  return { trades, volumeTinybar: volume, trades30d, wallets30d };
}

export type RecentTrade = {
  memeId: number;
  symbol?: string;
  token: string;
  memeMemo: string;
  kind: "buy" | "sell";
  hbarTinybar: bigint;
  t: number; // unix seconds
};

/** Latest trades across all pools, newest first. */
export async function fetchRecentTrades(
  tokens: TokenStats[],
  limit = 12
): Promise<RecentTrade[]> {
  const all: RecentTrade[] = [];
  await Promise.all(
    tokens.map(async (m) => {
      try {
        const res = await fetch(
          `${network.mirrorNodeUrl}/contracts/${m.pool.toLowerCase()}/results/logs?limit=25&order=desc`
        );
        if (!res.ok) return;
        const d = await res.json();
        for (const log of (d.logs ?? []) as MirrorLog[]) {
          try {
            const parsed = poolInterface.parseLog({
              topics: log.topics,
              data: log.data,
            });
            if (parsed?.name !== "Buy" && parsed?.name !== "Sell") continue;
            all.push({
              memeId: m.id,
              symbol: m.symbol,
              token: m.token,
              memeMemo: m.memeMemo,
              kind: parsed.name === "Buy" ? "buy" : "sell",
              hbarTinybar: BigInt(
                parsed.name === "Buy" ? parsed.args.hbarIn : parsed.args.hbarOut
              ),
              t: Number(log.timestamp.split(".")[0]),
            });
          } catch {
            /* unrelated log */
          }
        }
      } catch {
        /* pool unreadable */
      }
    })
  );
  return all.sort((a, b) => b.t - a.t).slice(0, limit);
}

export async function fetchNetworkStats(): Promise<NetworkStats> {
  const memes = await fetchMemes();
  const factory = factoryRead();

  // Seed price is the same for every launch: poolSeed HBAR vs full supply.
  const poolSeed: bigint = await factory.poolSeed().catch(() => 500_000_000n);
  const seedPrice = Number(poolSeed) / 1e8 / 1_000_000_000;

  const emptyTrade = (): PoolTradeStats => ({
    trades: 0,
    volumeTinybar: 0n,
    trades30d: 0,
    wallets30d: new Set<string>(),
  });

  const tradeStats: PoolTradeStats[] = [];
  const tokens: TokenStats[] = await Promise.all(
    memes.map(async (m) => {
      const pool = poolRead(m.pool);
      const [vesting, pending, trade, price, reserves] = await Promise.all([
        factory.creatorVesting(m.token),
        factory.pendingRoyalties(m.token).catch(() => 0n),
        poolTradeStats(m.pool).catch(emptyTrade),
        pool.getPrice().catch(() => 0n),
        pool.getReserves().catch(() => [0n, 0n]),
      ]);
      tradeStats.push(trade);
      const priceNow = Number(price) / 1e18;
      return {
        ...m,
        creatorAccrued: vesting.accrued,
        creatorClaimed: vesting.claimed,
        pendingDistribution: pending,
        trades: trade.trades,
        volumeTinybar: trade.volumeTinybar,
        price,
        hbarReserve: reserves[0],
        changePct:
          priceNow > 0 && seedPrice > 0
            ? (priceNow / seedPrice - 1) * 100
            : null,
      };
    })
  );

  const allWallets = new Set<string>();
  for (const t of tradeStats) for (const w of t.wallets30d) allWallets.add(w);

  const totalCreatorAccrued = tokens.reduce((a, t) => a + t.creatorAccrued, 0n);
  return {
    // creator share is 40% of the 1% royalty → total collected = accrued * 2.5
    totalRoyaltiesCollected: (totalCreatorAccrued * 10_000n) / 4_000n,
    totalCreatorAccrued,
    totalCreatorClaimed: tokens.reduce((a, t) => a + t.creatorClaimed, 0n),
    totalTrades: tokens.reduce((a, t) => a + t.trades, 0),
    totalVolumeTinybar: tokens.reduce((a, t) => a + t.volumeTinybar, 0n),
    trades30d: tradeStats.reduce((a, t) => a + t.trades30d, 0),
    activeWallets30d: allWallets.size,
    tvlTinybar: tokens.reduce((a, t) => a + t.hbarReserve, 0n),
    tokens,
  };
}
