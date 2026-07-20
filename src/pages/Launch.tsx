import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, Upload, ShieldCheck, AlertTriangle, Gavel } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { factoryRead, fetchMemes } from "../lib/memegraph";
import { LAUNCH_VALUE_HBAR } from "../config";
import {
  downscaleToB64,
  hashHasImage,
  invalidateTopicCache,
} from "../lib/memeImage";

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const PROMISES = [
  "No admin key",
  "No fee-schedule key",
  "Fixed supply",
  "Permanent liquidity",
];

export default function Launch() {
  const { adapter, displayAccount, evmAddress } = useWallet();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** sha256 of a meme someone else already claimed — offers a challenge */
  const [challengeable, setChallengeable] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function onChallenge(hash: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "challenge",
          hash,
          challenger: displayAccount ?? evmAddress ?? "anonymous",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "challenge failed");
      setStatus(
        `Challenge recorded on HCS (message #${d.sequenceNumber}). Disputes are arbitrated before mainnet launches.`
      );
      setChallengeable(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setChallengeable(null);
    if (!adapter) {
      setError("Connect a wallet first (top right).");
      return;
    }
    setBusy(true);
    try {
      // 1. Provenance claim: hash the meme and record it on HCS. The claim
      //    reference is baked into the token's immutable memo. First claim
      //    wins; launching is only permitted after the challenge window.
      let memo = "";
      if (file) {
        setStatus("Hashing your meme…");
        const hash = await sha256Hex(file);

        setStatus("Checking existing claims…");
        const check = await fetch(`/api/claim?hash=${hash}`).then((r) =>
          r.json()
        );
        const me = (displayAccount ?? evmAddress ?? "").toLowerCase();
        const now = Math.floor(Date.now() / 1000);

        if (check.claimed && check.claim.creator?.toLowerCase() !== me) {
          setChallengeable(hash);
          throw new Error(
            `This meme was already claimed by ${check.claim?.creator ?? "someone else"} (claim #${check.claim?.seq}). First claim wins — you can file a challenge below.`
          );
        }

        if (check.claimed) {
          // Our own earlier claim — backfill the artwork if it isn't on
          // Hedera yet (e.g. claims made before image storage existed)
          if (!(await hashHasImage(hash))) {
            setStatus("Storing your meme's artwork on Hedera…");
            const b64 = await downscaleToB64(file);
            await fetch("/api/claim", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kind: "image", hash, data: b64 }),
            });
            invalidateTopicCache();
          }
          // Enforce the challenge window
          if (now < check.claim.readyAt) {
            const opens = new Date(
              check.claim.readyAt * 1000
            ).toLocaleTimeString();
            throw new Error(
              `Your claim is recorded (HCS #${check.claim.seq}) but the challenge window is still open. You can launch after ${opens}.`
            );
          }
          if (check.claim.challenges > 0) {
            setStatus(
              `⚠ ${check.claim.challenges} challenge(s) on record for this meme — visible to everyone on HCS.`
            );
          }
          memo = check.claim.memo;
        } else {
          setStatus("Recording your claim on Hedera Consensus Service…");
          const claimRes = await fetch("/api/claim", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              hash,
              creator: displayAccount ?? evmAddress,
              name: name.trim(),
              symbol: symbol.trim().toUpperCase(),
            }),
          });
          const claim = await claimRes.json();
          if (!claimRes.ok) {
            throw new Error(claim.error ?? "claim failed");
          }

          // Store the artwork itself on Hedera, chunked onto the HCS topic
          setStatus("Storing your meme's artwork on Hedera…");
          try {
            const b64 = await downscaleToB64(file);
            await fetch("/api/claim", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ kind: "image", hash, data: b64 }),
            });
            invalidateTopicCache();
          } catch {
            /* artwork is cosmetic; the claim itself already succeeded */
          }

          if (claim.windowSec > 0) {
            const opens = new Date(claim.readyAt * 1000).toLocaleTimeString();
            setStatus(
              `✓ Claim sealed on HCS (${claim.memo}). Challenge window open until ${opens} — press Launch again after that.`
            );
            setBusy(false);
            return;
          }
          memo = claim.memo; // e.g. hcs:0.0.9638085/7
        }
      }

      // 2. One claim, one token: block relaunching an already-tokenized meme.
      if (memo) {
        setStatus("Checking this meme isn't already tokenized…");
        const existing = (await fetchMemes()).find((m) => m.memeMemo === memo);
        if (existing) {
          throw new Error(
            `This meme already has a live token (${existing.symbol ?? `#${existing.id}`}) — one claim, one token. Trade it instead.`
          );
        }
      }

      // 3. Launch the token with the claim reference in its immutable memo.
      await adapter.launchMeme(
        name.trim(),
        symbol.trim().toUpperCase(),
        memo,
        LAUNCH_VALUE_HBAR,
        setStatus
      );
      const memeId = await factoryRead().memeCount();
      setStatus("Launched!");
      nav(`/t/${memeId}`);
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage || err.message || String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-neon-pink/30 bg-neon-pink/10 px-3 py-1 text-[11px] font-bold tracking-wide text-neon-pink uppercase">
          <Rocket size={12} /> Launchpad
        </span>
        <h1 className="font-display text-3xl font-bold text-ink-bright">
          Launch a meme
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink">
          Creates a native Hedera token with a 1% transfer royalty baked in at
          birth — 0.4% to you as creator, 0.4% to the protocol, 0.2% back into
          the pool. No keys, no take-backs.
        </p>
      </div>

      <form
        onSubmit={onLaunch}
        className="flex flex-col gap-4 rounded-2xl border border-hairline bg-panel/50 p-6 backdrop-blur-xl"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-bright">Token name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grumpy Hbarb"
            maxLength={100}
            required
            className="rounded-xl border border-hairline bg-surface/60 px-3.5 py-2.5 text-sm text-ink-bright outline-none transition-all duration-200 placeholder:text-ink-dim focus:border-neon-purple focus:shadow-[0_0_16px_-6px_var(--color-neon-purple)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-bright">Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. GRUMP"
            maxLength={20}
            required
            className="rounded-xl border border-hairline bg-surface/60 px-3.5 py-2.5 font-mono text-sm text-ink-bright outline-none transition-all duration-200 placeholder:text-ink-dim placeholder:font-sans focus:border-neon-purple focus:shadow-[0_0_16px_-6px_var(--color-neon-purple)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-bright">
            Your meme{" "}
            <span className="font-normal text-ink-dim">
              (hashed and claimed on HCS, first claim wins)
            </span>
          </span>
          <div className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-dashed border-hairline bg-surface/60 p-3 transition-all duration-200 hover:border-neon-cyan">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover transition-transform duration-200 group-hover:scale-110"
              />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-hairline text-ink-dim">
                <Upload size={20} />
              </div>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {file ? file.name : "Choose an image…"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
        </label>

        <div className="rounded-xl border border-neon-purple/25 bg-neon-purple/5 p-4">
          <div className="flex items-baseline gap-1.5 text-sm">
            <strong className="font-mono text-base text-ink-bright">
              {LAUNCH_VALUE_HBAR} ℏ
            </strong>
            <span className="text-ink">to launch</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
            ≈ 5 ℏ seeds your pool + ~30 ℏ Hedera token-creation fee; surplus
            stays with the protocol. You get no free tokens — you buy on the
            curve like everyone else. Your meme's fingerprint is recorded on
            the Hedera Consensus Service and sealed into the token forever.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {PROMISES.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-neon-green"
              >
                <ShieldCheck size={11} /> {p}
              </span>
            ))}
          </div>
        </div>

        <button
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink py-3 text-sm font-bold text-white shadow-[0_0_24px_-6px_var(--color-neon-pink)] transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
        >
          <Rocket size={16} />
          {busy
            ? "Launching…"
            : displayAccount
            ? "Launch"
            : "Connect wallet to launch"}
        </button>

        {status && (
          <div className="rounded-xl border border-neon-green/30 bg-neon-green/5 px-3.5 py-2.5 text-sm text-neon-green">
            {status}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-neon-red/30 bg-neon-red/5 px-3.5 py-2.5 text-sm text-neon-red">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {challengeable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChallenge(challengeable)}
            title="Files a public, consensus-timestamped dispute on the Hedera Consensus Service"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-surface/60 py-2.5 text-sm font-bold text-ink transition-all duration-200 hover:border-neon-red hover:text-neon-red disabled:opacity-50"
          >
            <Gavel size={15} /> File a challenge on HCS
          </button>
        )}
      </form>
    </div>
  );
}
