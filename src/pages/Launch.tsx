import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../lib/wallet";
import { factoryRead } from "../lib/memegraph";
import { LAUNCH_VALUE_HBAR } from "../config";

export default function Launch() {
  const { adapter, displayAccount } = useWallet();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [memo, setMemo] = useState("");
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
      await adapter.launchMeme(
        name.trim(),
        symbol.trim().toUpperCase(),
        memo.trim(),
        LAUNCH_VALUE_HBAR,
        setStatus
      );
      // Latest meme is ours (single-launcher race is acceptable on testnet)
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
          Meme reference <span className="muted">(HCS topic / content hash — provenance)</span>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="hcs:0.0.12345 or sha256:…"
            maxLength={100}
          />
        </label>

        <div className="fee-box">
          <div>
            <strong>{LAUNCH_VALUE_HBAR} ℏ</strong> to launch
          </div>
          <span className="muted">
            ≈ 5 ℏ seeds your pool + ~30 ℏ Hedera token-creation fee; surplus
            stays with the protocol. You get no free tokens — you buy on the
            curve like everyone else.
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
