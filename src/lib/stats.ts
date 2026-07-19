import { Interface } from "ethers";
import { POOL_ABI } from "../abi";
import { network } from "../config";
import { factoryRead, fetchMemes, type MemeInfo } from "./memegraph";

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
};

export type NetworkStats = {
  totalRoyaltiesCollected: bigint; // token units, all tokens (approx: 2.5x creator accrual)
  totalCreatorAccrued: bigint;
  totalCreatorClaimed: bigint;
  totalTrades: number;
  totalVolumeTinybar: bigint;
  tokens: TokenStats[];
};

type MirrorLog = { topics: string[]; data: string };

async function poolTradeStats(
  pool: string
): Promise<{ trades: number; volumeTinybar: bigint }> {
  let trades = 0;
  let volume = 0n;
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
        if (parsed?.name === "Buy") {
          trades++;
          volume += BigInt(parsed.args.hbarIn);
        } else if (parsed?.name === "Sell") {
          trades++;
          volume += BigInt(parsed.args.hbarOut);
        }
      } catch {
        /* unrelated log */
      }
    }
    url = d.links?.next
      ? `${network.mirrorNodeUrl.replace("/api/v1", "")}${d.links.next}`
      : "";
  }
  return { trades, volumeTinybar: volume };
}

export async function fetchNetworkStats(): Promise<NetworkStats> {
  const memes = await fetchMemes();
  const factory = factoryRead();

  const tokens: TokenStats[] = await Promise.all(
    memes.map(async (m) => {
      const [vesting, pending, trade] = await Promise.all([
        factory.creatorVesting(m.token),
        factory.pendingRoyalties(m.token).catch(() => 0n),
        poolTradeStats(m.pool).catch(() => ({ trades: 0, volumeTinybar: 0n })),
      ]);
      return {
        ...m,
        creatorAccrued: vesting.accrued,
        creatorClaimed: vesting.claimed,
        pendingDistribution: pending,
        trades: trade.trades,
        volumeTinybar: trade.volumeTinybar,
      };
    })
  );

  const totalCreatorAccrued = tokens.reduce((a, t) => a + t.creatorAccrued, 0n);
  return {
    // creator share is 40% of the 1% royalty → total collected = accrued * 2.5
    totalRoyaltiesCollected: (totalCreatorAccrued * 10_000n) / 4_000n,
    totalCreatorAccrued,
    totalCreatorClaimed: tokens.reduce((a, t) => a + t.creatorClaimed, 0n),
    totalTrades: tokens.reduce((a, t) => a + t.trades, 0),
    totalVolumeTinybar: tokens.reduce((a, t) => a + t.volumeTinybar, 0n),
    tokens,
  };
}
