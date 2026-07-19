import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { factoryRead } from "../lib/memegraph";
import { LAUNCH_VALUE_HBAR } from "../config";

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

  async function onLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!adapter) {
      setError("Connect a wallet first (top right).");
      return;
    }
    setBusy(true);
    try {
      // 1. Provenance claim: hash the meme and record it on HCS. The claim
      //    reference is baked into the token's immutable memo.
      let memo = "";
      if (file) {
        setStatus("Hashing your meme…");
        const hash = await sha256Hex(file);

        setStatus("Checking it hasn't been claimed…");
        const check = await fetch(`/api/claim?hash=${hash}`).then((r) =>
          r.json()
        );
        if (check.claimed) {
          throw new Error(
            `This meme was already claimed by ${check.claim?.creator ?? "someone else"} (claim #${check.claim?.seq}). First claim wins.`
          );
        }

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
        memo = claim.memo; // e.g. hcs:0.0.9638085/7
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
      </form>
    </div>
  );
}
