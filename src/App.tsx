import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import LiveTicker from "./components/LiveTicker";
import { fetchNetworkStats, fetchRecentTrades, type RecentTrade } from "./lib/stats";
import Home from "./pages/Home";
import Launch from "./pages/Launch";
import Token from "./pages/Token";
import Creators from "./pages/Creators";
import Whitepaper from "./pages/Whitepaper";
import Profile from "./pages/Profile";

function App() {
  const [trades, setTrades] = useState<RecentTrade[] | null>(null);
  const { pathname } = useLocation();

  // One shared ticker feed for the whole app, refreshed periodically.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchNetworkStats()
        .then((s) => fetchRecentTrades(s.tokens, 18))
        .then((r) => alive && setTrades(r))
        .catch(() => alive && setTrades([]));
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-obsidian">
      <Header />
      <LiveTicker trades={trades} />

      <main className="mx-auto w-full min-w-0 max-w-[1240px] flex-1 px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/t/:id" element={<Token />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/whitepaper" element={<Whitepaper />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
