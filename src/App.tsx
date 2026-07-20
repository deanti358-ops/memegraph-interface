import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useWallet } from "./lib/wallet";
import { hederaAccountId, shortAddr } from "./lib/memegraph";
import { network, ACTIVE_NETWORK, CONTACT_EMAIL, SOCIALS } from "./config";
import { applyTheme, type Theme } from "./lib/theme";
import Home from "./pages/Home";
import Launch from "./pages/Launch";
import Token from "./pages/Token";
import Creators from "./pages/Creators";
import Whitepaper from "./pages/Whitepaper";

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    (document.documentElement.dataset.theme as Theme) ?? "dark"
  );
  const set = (t: Theme) => {
    applyTheme(t);
    setTheme(t);
  };
  return (
    <span className="theme-toggle" role="group" aria-label="Color theme">
      <button
        className={theme === "light" ? "active" : ""}
        onClick={() => set("light")}
        title="Light mode"
        aria-pressed={theme === "light"}
      >
        ☀
      </button>
      <button
        className={theme === "dark" ? "active" : ""}
        onClick={() => set("dark")}
        title="Dark mode"
        aria-pressed={theme === "dark"}
      >
        ☾
      </button>
    </span>
  );
}

function SocialLinks() {
  return (
    <div className="socials">
      <a href={SOCIALS.x} target="_blank" rel="noreferrer" title="X / Twitter">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1.6 2H8l4.4 5.9L18.9 2zm-1.1 18.1h1.7L7.1 3.8H5.3l12.5 16.3z" />
        </svg>
      </a>
      <a href={SOCIALS.github} target="_blank" rel="noreferrer" title="GitHub">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.2 4.9 18.2 5.2 18.2 5.2c.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6a11.5 11.5 0 0 0 7.8-10.9C23.5 5.7 18.3.5 12 .5z" />
        </svg>
      </a>
      <a href={SOCIALS.discord} target="_blank" rel="noreferrer" title="Discord">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M20.3 4.4A19.8 19.8 0 0 0 15.9 3l-.6 1.2a18.3 18.3 0 0 0-6.6 0L8.1 3a19.8 19.8 0 0 0-4.4 1.4C.9 8.6.1 12.7.5 16.7A20 20 0 0 0 6 19.5l1.3-1.9c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.4 0l.5.4c-.6.4-1.3.7-2 1l1.3 1.9a20 20 0 0 0 5.5-2.8c.5-4.6-.7-8.7-3.2-12.3zM8.5 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
        </svg>
      </a>
      <a href={`mailto:${CONTACT_EMAIL}`} title="Contact us">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13zm2.6-.5L12 11.4 19.4 5H4.6zM20 6.9l-7.4 6.4a1 1 0 0 1-1.2 0L4 6.9V18.5c0 .3.2.5.5.5h15c.3 0 .5-.2.5-.5V6.9z" />
        </svg>
      </a>
    </div>
  );
}

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
  const [nativeId, setNativeId] = useState<string | null>(null);

  // Always show the Hedera-native account id, even for EVM wallets
  useEffect(() => {
    setNativeId(null);
    if (displayAccount?.startsWith("0x")) {
      hederaAccountId(displayAccount)
        .then(setNativeId)
        .catch(() => {});
    }
  }, [displayAccount]);

  if (displayAccount) {
    return (
      <button
        className="btn btn-connect"
        onClick={disconnect}
        title={`Connected via ${kind === "hashpack" ? "HashPack" : "MetaMask"} — click to disconnect`}
      >
        {displayAccount.startsWith("0x")
          ? nativeId ?? shortAddr(displayAccount)
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
            Market
          </NavLink>
          <NavLink to="/launch">Launchpad</NavLink>
          <NavLink to="/creators">Creators</NavLink>
        </nav>
        <span className="net-pill">
          <span className="net-dot" />
          Hedera {ACTIVE_NETWORK === "mainnet" ? "Mainnet" : "Testnet"}
        </span>
        <ThemeToggle />
        <ConnectButton />
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/t/:id" element={<Token />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/whitepaper" element={<Whitepaper />} />
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
            <SocialLinks />
          </div>
          <div>
            <h3>Protocol</h3>
            <ul>
              <li>
                <Link to="/">Market</Link>
              </li>
              <li>
                <Link to="/launch">Launchpad</Link>
              </li>
              <li>
                <Link to="/creators">Creators</Link>
              </li>
              <li>
                <Link to="/whitepaper">Whitepaper</Link>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
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
