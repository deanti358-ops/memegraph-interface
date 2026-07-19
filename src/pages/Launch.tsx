import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { factoryRead } from "../lib/memegraph";
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

      // 2. Launch the token with the claim reference in its immutable memo.
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
    <div className="page narrow">
      <h1>Launch a meme</h1>
      <p className="sub">
        Creates a native Hedera token with a 1% transfer royalty baked in at
        birth — 0.4% to you as creator, 0.4% to the protocol, 0.2% back into
        the pool. No keys, no take-backs: supply and fees are immutable the
        moment it exists.
      </p>

      <form className="panel form" onSubmit={onLaunch}>
        <label>
          Token name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grumpy Hbarb"
            maxLength={100}
            required
          />
        </label>
        <label>
          Symbol
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. GRUMP"
            maxLength={20}
            required
          />
        </label>
        <label>
          Your meme <span className="muted">(image — hashed and claimed on HCS, first claim wins)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="fee-box">
          <div>
            <strong>{LAUNCH_VALUE_HBAR} ℏ</strong> to launch
          </div>
          <span className="muted">
            ≈ 5 ℏ seeds your pool + ~30 ℏ Hedera token-creation fee; surplus
            stays with the protocol. You get no free tokens — you buy on the
            curve like everyone else. Your meme's fingerprint is recorded on
            the Hedera Consensus Service and sealed into the token forever.
          </span>
        </div>

        <button className="btn btn-primary" disabled={busy}>
          {busy
            ? "Launching…"
            : displayAccount
            ? "Launch"
            : "Connect wallet to launch"}
        </button>

        {status && <div className="status">{status}</div>}
        {error && <div className="error">{error}</div>}
        {challengeable && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => onChallenge(challengeable)}
            title="Files a public, consensus-timestamped dispute on the Hedera Consensus Service"
          >
            File a challenge on HCS
          </button>
        )}
      </form>
    </div>
  );
}
