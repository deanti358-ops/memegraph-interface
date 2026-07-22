import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Check,
  Copy,
  LogOut,
  Pencil,
  RefreshCw,
  User,
  Wallet,
} from "lucide-react";
import { useWallet, readProvider } from "../lib/wallet";
import {
  displaySymbol,
  fetchHbarUsd,
  fetchMemes,
  fmtUsd,
  hederaAccountId,
  poolRead,
  tokenEntityId,
  type MemeInfo,
} from "../lib/memegraph";
import { network } from "../config";
import TokenAvatar from "../components/TokenAvatar";

/**
 * Profile — the account home. Local-first identity (display name + picture
 * live in this browser's localStorage; nothing is uploaded anywhere) plus
 * live on-chain facts: connection state, HBAR balance, and every token the
 * connected account holds, with Memegraph tokens shown rich and linked.
 */

const NAME_KEY = "mg-profile-name";
const PIC_KEY = "mg-profile-pic";
/** Header avatar listens for this to stay in sync with edits made here. */
export const PROFILE_EVENT = "mg-profile-updated";

export function loadProfilePic(): string | null {
  try {
    return localStorage.getItem(PIC_KEY);
  } catch {
    return null;
  }
}
export function loadProfileName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

async function fileToAvatarB64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const edge = 192;
  const scale = Math.max(edge / bitmap.width, edge / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // center-crop to a square
  ctx.drawImage(bitmap, (edge - w) / 2, (edge - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

type HeldToken = {
  tokenId: string; // 0.0.x
  balance: bigint; // smallest units
  decimals: number;
  name?: string;
  symbol?: string;
  /** set for Memegraph tokens */
  meme?: MemeInfo;
  /** HBAR value of the holding (Memegraph tokens only) */
  valueHbar?: number;
};

export default function Profile() {
  const { displayAccount, evmAddress, connecting, openConnect, disconnect } =
    useWallet();

  const [name, setName] = useState(loadProfileName());
  const [editingName, setEditingName] = useState(false);
  const [pic, setPic] = useState<string | null>(loadProfilePic());
  const [nativeId, setNativeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hbarBalance, setHbarBalance] = useState<number | null>(null);
  const [hbarUsd, setHbarUsd] = useState<number | null>(null);
  const [held, setHeld] = useState<HeldToken[] | null>(null);
  const [loadingHeld, setLoadingHeld] = useState(false);

  useEffect(() => {
    fetchHbarUsd().then(setHbarUsd);
  }, []);

  // Resolve the native 0.0.x id for whatever account is connected
  useEffect(() => {
    setNativeId(null);
    if (!displayAccount) return;
    if (!displayAccount.startsWith("0x")) {
      setNativeId(displayAccount);
    } else {
      hederaAccountId(displayAccount)
        .then(setNativeId)
        .catch(() => {});
    }
  }, [displayAccount]);

  // HBAR balance
  useEffect(() => {
    setHbarBalance(null);
    if (evmAddress) {
      readProvider
        .getBalance(evmAddress)
        .then((b) => setHbarBalance(Number(b) / 1e18))
        .catch(() => setHbarBalance(null));
    } else if (nativeId) {
      fetch(`${network.mirrorNodeUrl}/accounts/${nativeId}`)
        .then((r) => r.json())
        .then((d) => setHbarBalance(Number(d.balance?.balance ?? 0) / 1e8))
        .catch(() => setHbarBalance(null));
    }
  }, [evmAddress, nativeId]);

  // Tokens held, cross-referenced against the Memegraph factory
  const loadHeld = useCallback(async () => {
    if (!nativeId) return;
    setLoadingHeld(true);
    try {
      const [assoc, memes] = await Promise.all([
        fetch(
          `${network.mirrorNodeUrl}/accounts/${nativeId}/tokens?limit=100`
        ).then((r) => r.json()),
        fetchMemes().catch(() => [] as MemeInfo[]),
      ]);
      const memeByTokenId = new Map(
        memes.map((m) => [tokenEntityId(m.token), m])
      );
      const rows: HeldToken[] = [];
      for (const t of assoc.tokens ?? []) {
        const balance = BigInt(t.balance ?? 0);
        if (balance === 0n) continue;
        const meme = memeByTokenId.get(t.token_id);
        let name: string | undefined = meme?.name;
        let symbol: string | undefined = meme?.symbol;
        let decimals = 8;
        if (!meme) {
          try {
            const info = await fetch(
              `${network.mirrorNodeUrl}/tokens/${t.token_id}`
            ).then((r) => r.json());
            name = info.name;
            symbol = info.symbol;
            decimals = Number(info.decimals ?? 0);
          } catch {
            /* show the id */
          }
        }
        let valueHbar: number | undefined;
        if (meme) {
          try {
            const price = await poolRead(meme.pool).getPrice();
            valueHbar = (Number(balance) / 1e8) * (Number(price) / 1e18);
          } catch {
            /* price unavailable */
          }
        }
        rows.push({
          tokenId: t.token_id,
          balance,
          decimals,
          name,
          symbol,
          meme,
          valueHbar,
        });
      }
      // Memegraph tokens first, biggest holdings first
      rows.sort((a, b) => {
        if (!!a.meme !== !!b.meme) return a.meme ? -1 : 1;
        return (b.valueHbar ?? 0) - (a.valueHbar ?? 0);
      });
      setHeld(rows);
    } catch {
      setHeld([]);
    } finally {
      setLoadingHeld(false);
    }
  }, [nativeId]);

  useEffect(() => {
    setHeld(null);
    if (nativeId) loadHeld();
  }, [nativeId, loadHeld]);

  const saveName = (v: string) => {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(PROFILE_EVENT));
  };

  const onPickPic = async (file: File | null) => {
    if (!file) return;
    try {
      const b64 = await fileToAvatarB64(file);
      setPic(b64);
      localStorage.setItem(PIC_KEY, b64);
      window.dispatchEvent(new Event(PROFILE_EVENT));
    } catch {
      /* unsupported image */
    }
  };

  const usdBalance =
    hbarBalance !== null && hbarUsd !== null ? hbarBalance * hbarUsd : null;
  const portfolioHbar = useMemo(
    () =>
      held?.reduce((acc, t) => acc + (t.valueHbar ?? 0), 0) ?? null,
    [held]
  );

  return (
    <div className="mx-auto max-w-3xl">
      {/* ---------- identity ---------- */}
      <section className="mb-4 rounded-2xl border border-hairline bg-panel/50 p-6 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <label
            className="group relative block h-24 w-24 shrink-0 cursor-pointer"
            title="Change profile picture"
          >
            {pic ? (
              <img
                src={pic}
                alt="Profile"
                className="h-24 w-24 rounded-full border-2 border-hairline object-cover"
              />
            ) : (
              <span className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-pink text-white">
                <User size={40} />
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-hairline bg-surface text-ink transition-colors group-hover:text-neon-cyan">
              <Camera size={14} />
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickPic(e.target.files?.[0] ?? null)}
            />
          </label>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            {editingName ? (
              <form
                className="flex items-center justify-center gap-2 sm:justify-start"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditingName(false);
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={32}
                  onChange={(e) => saveName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  placeholder="Your name"
                  className="w-48 rounded-xl border border-hairline bg-surface/60 px-3 py-1.5 text-lg font-bold text-ink-bright outline-none focus:border-neon-purple"
                />
              </form>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="group inline-flex items-center gap-2"
                title="Edit name"
              >
                <span className="truncate font-display text-2xl font-bold text-ink-bright">
                  {name || "Anonymous memer"}
                </span>
                <Pencil
                  size={14}
                  className="text-ink-dim transition-colors group-hover:text-neon-cyan"
                />
              </button>
            )}

            {displayAccount ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <button
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(nativeId ?? displayAccount)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1200);
                      })
                      .catch(() => {});
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neon-green/40 bg-neon-green/10 px-2.5 py-1 font-mono text-xs font-bold text-neon-green transition-colors hover:border-neon-green"
                  title="Copy account id"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                  {nativeId ?? displayAccount}
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button
                  onClick={openConnect}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface/60 px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:border-neon-cyan hover:text-neon-cyan"
                >
                  <RefreshCw size={12} /> Switch wallet
                </button>
                <button
                  onClick={disconnect}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neon-red/40 bg-neon-red/10 px-2.5 py-1 text-xs font-bold text-neon-red transition-colors hover:bg-neon-red/20"
                >
                  <LogOut size={12} /> Disconnect
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  onClick={openConnect}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_-6px_var(--color-neon-pink)] transition-all duration-200 hover:scale-[1.02] disabled:opacity-60"
                >
                  <Wallet size={15} />
                  {connecting ? "Connecting…" : "Connect Wallet"}
                </button>
                <p className="mt-2 text-xs text-ink-dim">
                  Connect to see your balance and tokens.
                </p>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-dim sm:text-left">
          Name and picture live only in this browser — nothing is uploaded.
        </p>
      </section>

      {/* ---------- balances ---------- */}
      {displayAccount && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl">
            <div className="text-xs text-ink-dim">HBAR balance</div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink-bright">
              {hbarBalance !== null
                ? `${hbarBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ℏ`
                : "—"}
            </div>
            <div className="text-xs text-ink-dim">
              {usdBalance !== null ? fmtUsd(usdBalance) : ""}
            </div>
          </section>
          <section className="rounded-2xl border border-hairline bg-panel/50 p-5 backdrop-blur-xl">
            <div className="text-xs text-ink-dim">Meme portfolio value</div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink-bright">
              {portfolioHbar !== null
                ? `${portfolioHbar.toLocaleString(undefined, { maximumFractionDigits: 2 })} ℏ`
                : "—"}
            </div>
            <div className="text-xs text-ink-dim">
              {portfolioHbar !== null && hbarUsd !== null
                ? fmtUsd(portfolioHbar * hbarUsd)
                : ""}
            </div>
          </section>
        </div>
      )}

      {/* ---------- tokens held ---------- */}
      {displayAccount && (
        <section className="rounded-2xl border border-hairline bg-panel/50 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
            <h2 className="font-display text-sm font-bold text-ink-bright">
              Tokens held
            </h2>
            <span className="font-mono text-xs text-ink-dim">
              {held ? `${held.length} tokens` : "…"}
            </span>
          </div>
          {(held === null || loadingHeld) && (
            <div className="px-5 py-8 text-center text-sm text-ink-dim">
              Loading holdings…
            </div>
          )}
          {held && !loadingHeld && held.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-ink-dim">
              No tokens yet —{" "}
              <Link to="/" className="text-neon-cyan hover:underline">
                browse the market
              </Link>
              .
            </div>
          )}
          {held &&
            !loadingHeld &&
            held.map((t) => {
              const amount = (
                Number(t.balance) /
                10 ** t.decimals
              ).toLocaleString(undefined, { maximumFractionDigits: 2 });
              const row = (
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3 last:border-b-0 hover:bg-surface/40">
                  <div className="flex min-w-0 items-center gap-3">
                    {t.meme ? (
                      <TokenAvatar
                        symbol={t.symbol}
                        address={t.meme.token}
                        memo={t.meme.memeMemo}
                        size={36}
                      />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface text-ink-dim">
                        <User size={15} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-ink-bright">
                        {t.name ?? t.tokenId}
                        {t.meme && (
                          <span className="ml-2 rounded bg-neon-purple/15 px-1.5 py-0.5 text-[10px] font-bold text-neon-purple">
                            Memegraph
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-[11px] text-ink-dim">
                        {t.symbol ? `$${displaySymbol(t.symbol)}` : t.tokenId}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-bold text-ink-bright">
                      {amount}
                    </div>
                    <div className="text-[11px] text-ink-dim">
                      {t.valueHbar !== undefined
                        ? `${t.valueHbar.toLocaleString(undefined, { maximumFractionDigits: 2 })} ℏ${
                            hbarUsd !== null
                              ? ` · ${fmtUsd(t.valueHbar * hbarUsd)}`
                              : ""
                          }`
                        : ""}
                    </div>
                  </div>
                </div>
              );
              return t.meme ? (
                <Link
                  key={t.tokenId}
                  to={`/t/${t.meme.id}`}
                  className="block no-underline"
                >
                  {row}
                </Link>
              ) : (
                <div key={t.tokenId}>{row}</div>
              );
            })}
        </section>
      )}
    </div>
  );
}
