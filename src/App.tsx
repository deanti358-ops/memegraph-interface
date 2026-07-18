import { useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useWallet } from "./lib/wallet";
import { shortAddr } from "./lib/memegraph";
import { network, ACTIVE_NETWORK } from "./config";
import Home from "./pages/Home";
import Launch from "./pages/Launch";
import Token from "./pages/Token";
import Creators from "./pages/Creators";

function BrandMark() {
  return (
    <span className="brand-badge" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="5.5" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="18.5" r="2.4" fill="currentColor" stroke="none" />
        <path d="M8 11l7-4.5M8 13l7 4.5" />
      </svg>
    </span>
  );
}

function ConnectButton() {
  const {
    displayAccount,
    kind,
    connecting,
    walletError,
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
        {connecting ? "Connecting…" : "Connect Wallet"}
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
      {walletError && <div className="connect-error">{walletError}</div>}
    </div>
  );
}

function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <BrandMark />
          <span>
            Meme<span className="brand-graph">graph</span>
          </span>
        </Link>
        <nav>
          <NavLink to="/" end>
            Board
          </NavLink>
          <NavLink to="/launch">Launchpad</NavLink>
          <NavLink to="/creators">Creators</NavLink>
        </nav>
        <span className="net-pill">
          <span className="net-dot" />
          Hedera {ACTIVE_NETWORK === "mainnet" ? "Mainnet" : "Testnet"}
        </span>
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
        <div className="footer-cols">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <BrandMark />
              <span>
                Meme<span className="brand-graph">graph</span>
              </span>
            </Link>
            <span>
              The memecoin launchpad built natively on Hedera. Creators earn a
              network-enforced royalty on every transfer — fast, gas-light,
              impossible to rug.
            </span>
          </div>
          <div>
            <h3>Protocol</h3>
            <ul>
              <li>
                <Link to="/">Board</Link>
              </li>
              <li>
                <Link to="/launch">Launchpad</Link>
              </li>
              <li>
                <Link to="/creators">Creators</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Transparency</h3>
            <ul>
              <li>
                <a
                  href={`${network.hashscanUrl}/contract/${network.factoryAddress}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Factory on HashScan
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/deanti358-ops/memegraph-contracts"
                  target="_blank"
                  rel="noreferrer"
                >
                  Contracts source
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/deanti358-ops/memegraph-interface"
                  target="_blank"
                  rel="noreferrer"
                >
                  Interface source
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Ecosystem</h3>
            <ul>
              <li>
                <a href="https://hedera.com" target="_blank" rel="noreferrer">
                  Hedera
                </a>
              </li>
              <li>
                <a href="https://www.hashpack.app" target="_blank" rel="noreferrer">
                  HashPack
                </a>
              </li>
              <li>
                <a
                  href="https://portal.hedera.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Testnet faucet
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-tag">
          <span>© 2026 Memegraph · Not financial advice. DYOR.</span>
          <span>
            Royalties enforced by the Hedera network on every transfer.
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
