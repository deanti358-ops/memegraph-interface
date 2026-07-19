import { useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useWallet } from "./lib/wallet";
import { shortAddr } from "./lib/memegraph";
import Home from "./pages/Home";
import Launch from "./pages/Launch";
import Token from "./pages/Token";
import Creators from "./pages/Creators";

function ConnectButton() {
  const {
    displayAccount,
    kind,
    connecting,
    connectMetaMask,
    connectHashPack,
    disconnect,
  } = useWallet();
  const [open, setOpen] = useState(false);

  if (displayAccount) {
    return (
      <button
        className="btn btn-connect"
        onClick={disconnect}
        title={`Connected via ${kind === "hashpack" ? "HashPack" : "MetaMask"} — click to disconnect`}
      >
        {displayAccount.startsWith("0x")
          ? shortAddr(displayAccount)
          : displayAccount}
      </button>
    );
  }

  return (
    <div className="connect-wrap">
      <button
        className="btn btn-connect"
        onClick={() => setOpen((o) => !o)}
        disabled={connecting}
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="connect-menu" onMouseLeave={() => setOpen(false)}>
          <button
            className="connect-option"
            onClick={() => {
              setOpen(false);
              connectHashPack();
            }}
          >
            <strong>HashPack</strong>
            <span className="muted small">Hedera-native · pairing modal</span>
          </button>
          <button
            className="connect-option"
            onClick={() => {
              setOpen(false);
              connectMetaMask();
            }}
          >
            <strong>MetaMask</strong>
            <span className="muted small">EVM · adds Hedera testnet</span>
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">▲</span> memegraph
        </Link>
        <nav>
          <NavLink to="/" end>
            Board
          </NavLink>
          <NavLink to="/launch">Launch</NavLink>
          <NavLink to="/creators">Creators</NavLink>
        </nav>
        <ConnectButton />
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/t/:id" element={<Token />} />
          <Route path="/creators" element={<Creators />} />
        </Routes>
      </main>

      <footer className="footer">
        <span>
          Hedera testnet · creator royalties enforced by the network on every
          transfer
        </span>
      </footer>
    </div>
  );
}

export default App;
