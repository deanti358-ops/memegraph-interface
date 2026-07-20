import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Rocket, Wallet, Sun, Moon, Menu, X, ChevronDown } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { hederaAccountId, shortAddr } from "../lib/memegraph";
import { ACTIVE_NETWORK } from "../config";
import { applyTheme, type Theme } from "../lib/theme";
import BrandMark from "./BrandMark";

const NAV = [
  { to: "/", label: "Market", end: true },
  { to: "/launch", label: "Launchpad" },
  { to: "/creators", label: "Creators" },
];

function NetworkBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-ink backdrop-blur-md">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-neon-green" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-neon-green" />
      </span>
      Hedera {ACTIVE_NETWORK === "mainnet" ? "Mainnet" : "Testnet"}
    </span>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    (document.documentElement.dataset.theme as Theme) ?? "dark"
  );
  const next = theme === "dark" ? "light" : "dark";
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      aria-pressed={isDark}
      className="relative h-8 w-14 shrink-0 rounded-full border border-hairline bg-surface/70 backdrop-blur-md transition-colors duration-300"
    >
      {/* track icons */}
      <Sun
        size={13}
        className={`absolute left-1.5 top-1/2 -translate-y-1/2 transition-opacity duration-300 ${
          isDark ? "text-ink-dim opacity-40" : "text-amber-400 opacity-100"
        }`}
      />
      <Moon
        size={13}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 transition-opacity duration-300 ${
          isDark ? "text-neon-cyan opacity-100" : "text-ink-dim opacity-40"
        }`}
      />
      {/* sliding knob — animate `left` (not composited) so the slide is
          smooth and unambiguous */}
      <span
        style={{ left: isDark ? "28px" : "2px" }}
        className="absolute top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-pink text-white shadow-md transition-[left] duration-300 ease-out"
      >
        <span
          className={`transition-transform duration-500 ${
            isDark ? "rotate-0" : "rotate-180"
          }`}
        >
          {isDark ? <Moon size={13} /> : <Sun size={13} />}
        </span>
      </span>
    </button>
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

  useEffect(() => {
    setNativeId(null);
    if (displayAccount?.startsWith("0x")) {
      hederaAccountId(displayAccount)
        .then(setNativeId)
        .catch(() => {});
    }
  }, [displayAccount]);

  if (displayAccount) {
    const label = displayAccount.startsWith("0x")
      ? nativeId ?? shortAddr(displayAccount)
      : displayAccount;
    return (
      <button
        onClick={disconnect}
        title={`Connected via ${kind === "hashpack" ? "HashPack" : "MetaMask"} — click to disconnect`}
        className="inline-flex items-center gap-2 rounded-xl border border-neon-purple/50 bg-neon-purple/10 px-3 py-2 font-mono text-xs font-bold text-ink-bright backdrop-blur-md transition-all duration-200 hover:border-neon-purple hover:shadow-[0_0_18px_-2px_var(--color-neon-purple)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
        {label}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={connecting}
        className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-surface/70 px-3 py-2 text-sm font-bold text-ink-bright backdrop-blur-md transition-all duration-200 hover:border-neon-cyan hover:text-neon-cyan disabled:opacity-60"
      >
        <Wallet size={15} />
        <span className="hidden sm:inline">
          {connecting ? "Connecting…" : "Connect"}
        </span>
        <ChevronDown size={13} className="opacity-60" />
      </button>

      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-2xl border border-hairline bg-panel/95 shadow-2xl backdrop-blur-xl"
        >
          {[
            {
              name: "HashPack",
              hint: "Hedera-native · pairing modal",
              fn: connectHashPack,
            },
            {
              name: "MetaMask",
              hint: "EVM · adds Hedera testnet",
              fn: connectMetaMask,
            },
          ].map((w) => (
            <button
              key={w.name}
              onClick={() => {
                setOpen(false);
                w.fn();
              }}
              className="flex w-full flex-col items-start gap-0.5 border-b border-hairline px-4 py-3 text-left transition-colors duration-200 last:border-b-0 hover:bg-neon-purple/10"
            >
              <span className="font-bold text-ink-bright">{w.name}</span>
              <span className="text-xs text-ink-dim">{w.hint}</span>
            </button>
          ))}
        </div>
      )}

      {walletError && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-neon-red/60 bg-panel/95 px-3 py-2 text-xs text-neon-red backdrop-blur-xl">
          {walletError}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-obsidian/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 no-underline"
          onClick={() => setMenuOpen(false)}
        >
          <BrandMark size={34} />
          <span className="font-display text-xl font-bold tracking-tight text-ink-bright">
            Meme
            <span className="bg-gradient-to-r from-neon-pink to-neon-cyan bg-clip-text text-transparent">
              graph
            </span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <NetworkBadge />
        </div>

        <nav className="ml-2 hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-all duration-200 ${
                  isActive
                    ? "bg-neon-purple/10 text-ink-bright"
                    : "text-ink-dim hover:text-ink-bright"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            to="/launch"
            className="group hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink px-4 py-2 text-sm font-bold text-white no-underline shadow-[0_0_20px_-6px_var(--color-neon-pink)] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_26px_-2px_var(--color-neon-pink)] sm:inline-flex"
          >
            <Rocket
              size={15}
              className="transition-transform duration-200 group-hover:-translate-y-0.5"
            />
            Launch Token
          </Link>
          <ThemeToggle />
          <ConnectButton />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-xl border border-hairline bg-surface/70 text-ink backdrop-blur-md transition-colors duration-200 hover:text-ink-bright md:hidden"
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-hairline px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors duration-200 ${
                  isActive
                    ? "bg-neon-purple/10 text-ink-bright"
                    : "text-ink-dim hover:text-ink-bright"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
          <Link
            to="/launch"
            onClick={() => setMenuOpen(false)}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-neon-purple to-neon-pink px-4 py-2.5 text-sm font-bold text-white no-underline sm:hidden"
          >
            <Rocket size={15} /> Launch Token
          </Link>
          <div className="pt-1">
            <NetworkBadge />
          </div>
        </nav>
      )}
    </header>
  );
}
