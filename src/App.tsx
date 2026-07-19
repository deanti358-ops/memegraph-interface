import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useWallet } from "./lib/wallet";
import { shortAddr } from "./lib/memegraph";
import Home from "./pages/Home";
import Launch from "./pages/Launch";
import Token from "./pages/Token";
import Creators from "./pages/Creators";

function App() {
  const { account, connect, connecting } = useWallet();

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
        <button className="btn btn-connect" onClick={connect} disabled={connecting}>
          {account ? shortAddr(account) : connecting ? "Connecting…" : "Connect wallet"}
        </button>
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
