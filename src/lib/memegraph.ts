import { Contract, formatUnits, type Signer } from "ethers";
import { FACTORY_ABI, POOL_ABI, ERC20_ABI } from "../abi";
import { network } from "../config";
import { readProvider } from "./wallet";

/**
 * Unit model (validated on testnet):
 * - Contract-side HBAR values (msg.value, balances, reserves) are TINYBARS (8 dp)
 * - The JSON-RPC layer expects tx `value` in 18-decimal units
 * - Meme tokens have 8 decimals
 */
export const HBAR_DECIMALS = 8;
export const TOKEN_DECIMALS = 8;

export type MemeInfo = {
  id: number;
  token: string;
  pool: string;
  creator: string;
  memeMemo: string;
  launchedAt: number;
  name?: string;
  symbol?: string;
};

export function factoryRead() {
  return new Contract(network.factoryAddress, FACTORY_ABI, readProvider);
}

export function factoryWrite(signer: Signer) {
  return new Contract(network.factoryAddress, FACTORY_ABI, signer);
}

export function poolRead(pool: string) {
  return new Contract(pool, POOL_ABI, readProvider);
}

export function poolWrite(pool: string, signer: Signer) {
  return new Contract(pool, POOL_ABI, signer);
}

export function tokenRead(token: string) {
  return new Contract(token, ERC20_ABI, readProvider);
}

export function tokenWrite(token: string, signer: Signer) {
  return new Contract(token, ERC20_ABI, signer);
}

export async function fetchMemes(): Promise<MemeInfo[]> {
  const factory = factoryRead();
  const count = Number(await factory.memeCount());
  const memes: MemeInfo[] = [];
  for (let i = count; i >= 1; i--) {
    const m = await factory.getMeme(i);
    memes.push({
      id: i,
      token: m.token,
      pool: m.pool,
      creator: m.creator,
      memeMemo: m.memeMemo,
      launchedAt: Number(m.launchedAt),
    });
  }
  // Token names via mirror node (single call covers name+symbol)
  await Promise.all(
    memes.map(async (m) => {
      try {
        const info = await mirrorToken(m.token);
        m.name = info.name;
        m.symbol = info.symbol;
      } catch {
        /* leave undefined */
      }
    })
  );
  return memes;
}

/** Tinybars → "1.23" HBAR string */
export function fmtHbar(tinybars: bigint, dp = 2): string {
  const s = Number(formatUnits(tinybars, HBAR_DECIMALS));
  return s.toLocaleString(undefined, { maximumFractionDigits: dp });
}

/** Token units (8dp) → display string */
export function fmtTokens(units: bigint, dp = 2): string {
  const s = Number(formatUnits(units, TOKEN_DECIMALS));
  return s.toLocaleString(undefined, { maximumFractionDigits: dp });
}

/** getPrice() 1e18 fixed point → HBAR per whole token */
export function fmtPrice(price: bigint): string {
  const p = Number(price) / 1e18;
  if (p === 0) return "0";
  return p.toLocaleString(undefined, { maximumSignificantDigits: 4 });
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function hashscanTx(hash: string): string {
  return `${network.hashscanUrl}/transaction/${hash}`;
}

export function hashscanAddr(addr: string): string {
  return `${network.hashscanUrl}/address/${addr}`;
}

/** Dollars per HBAR, from the network's own fee-schedule exchange rate. */
export async function fetchHbarUsd(): Promise<number | null> {
  try {
    const res = await fetch(`${network.mirrorNodeUrl}/network/exchangerate`);
    const d = await res.json();
    return d.current_rate.cent_equivalent / d.current_rate.hbar_equivalent / 100;
  } catch {
    return null;
  }
}

/** Compact dollar formatting across the huge range meme prices span. */
export function fmtUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd >= 0.01)
    return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${usd.toPrecision(2).replace(/e-?\d+$/, (m) => `e${m.slice(1)}`)}`;
}

// ---------------------------------------------------------------------------
// Mirror node helpers
// ---------------------------------------------------------------------------

/** Token EVM long-zero address → mirror-node entity id (0.0.x). */
export function tokenEntityId(evmAddress: string): string {
  return `0.0.${BigInt(evmAddress)}`;
}

const accountIdCache = new Map<string, string>();

/**
 * EVM address → native Hedera account id (0.0.x). Long-zero addresses
 * encode the id directly; alias addresses resolve via the mirror node.
 */
export async function hederaAccountId(
  evmAddress: string
): Promise<string | null> {
  const a = evmAddress.toLowerCase();
  const cached = accountIdCache.get(a);
  if (cached) return cached;
  if (/^0x0{24}/.test(a)) {
    const id = `0.0.${BigInt(a)}`;
    accountIdCache.set(a, id);
    return id;
  }
  try {
    const res = await fetch(`${network.mirrorNodeUrl}/accounts/${a}`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.account) accountIdCache.set(a, d.account);
    return d.account ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether `account` (0.0.x or EVM address) is associated with the token.
 * Hedera accounts must be associated before they can receive an HTS token;
 * transfers to unassociated accounts revert.
 */
export async function isAssociated(
  account: string,
  tokenEvm: string
): Promise<boolean> {
  const res = await fetch(
    `${network.mirrorNodeUrl}/accounts/${account}/tokens?token.id=${tokenEntityId(tokenEvm)}`
  );
  if (!res.ok) return false;
  const d = await res.json();
  return (d.tokens?.length ?? 0) > 0;
}

export type MirrorTokenInfo = {
  name: string;
  symbol: string;
  /** Anti-rug facts, straight from the ledger */
  safety: {
    noAdminKey: boolean;
    noFeeScheduleKey: boolean;
    noSupplyKey: boolean;
    noPauseOrFreeze: boolean;
    finiteSupply: boolean;
  };
};

const tokenInfoCache = new Map<string, MirrorTokenInfo>();

export async function mirrorToken(evmAddress: string): Promise<MirrorTokenInfo> {
  const cached = tokenInfoCache.get(evmAddress);
  if (cached) return cached;
  // Token EVM addresses on Hedera encode the entity number
  const tokenNum = BigInt(evmAddress);
  const res = await fetch(`${network.mirrorNodeUrl}/tokens/0.0.${tokenNum}`);
  if (!res.ok) throw new Error(`mirror node ${res.status}`);
  const d = await res.json();
  const info: MirrorTokenInfo = {
    name: d.name as string,
    symbol: d.symbol as string,
    safety: {
      noAdminKey: d.admin_key === null,
      noFeeScheduleKey: d.fee_schedule_key === null,
      noSupplyKey: d.supply_key === null,
      noPauseOrFreeze: d.pause_key === null && d.freeze_key === null && d.wipe_key === null,
      finiteSupply: d.supply_type === "FINITE",
    },
  };
  tokenInfoCache.set(evmAddress, info);
  return info;
}
