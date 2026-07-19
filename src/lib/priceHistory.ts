import { Interface } from "ethers";
import { POOL_ABI } from "../abi";
import { network } from "../config";

/**
 * Price history for a pool, reconstructed from its Buy/Sell events on the
 * mirror node: every event carries the post-trade reserves, and price is
 * simply hbarReserve / tokenReserve (both 8-decimal units, so the ratio is
 * HBAR per whole token directly).
 */

const poolInterface = new Interface(POOL_ABI);

export type PricePoint = {
  t: number; // unix seconds
  price: number; // HBAR per whole token
  kind: "launch" | "buy" | "sell";
};

export async function fetchPriceHistory(
  pool: string,
  launchedAt: number,
  seedPrice: number
): Promise<PricePoint[]> {
  const points: PricePoint[] = [
    { t: launchedAt, price: seedPrice, kind: "launch" },
  ];

  let url = `${network.mirrorNodeUrl}/contracts/${pool.toLowerCase()}/results/logs?limit=100&order=asc`;
  for (let page = 0; url && page < 20; page++) {
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
        points.push({
          t: Math.floor(Number(log.timestamp.split(".")[0])),
          price: hbarReserve / tokenReserve,
          kind: parsed.name === "Buy" ? "buy" : "sell",
        });
      } catch {
        /* unrelated log */
      }
    }
    url = d.links?.next
      ? `${network.mirrorNodeUrl.replace("/api/v1", "")}${d.links.next}`
      : "";
  }

  return points.sort((a, b) => a.t - b.t);
}
