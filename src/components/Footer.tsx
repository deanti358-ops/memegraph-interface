import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import BrandMark from "./BrandMark";
import { network, CONTACT_EMAIL, SOCIALS, ACTIVE_NETWORK } from "../config";

const COLUMNS: { title: string; links: { label: string; to: string; ext?: boolean }[] }[] = [
  {
    title: "Protocol",
    links: [
      { label: "Market", to: "/" },
      { label: "Launchpad", to: "/launch" },
      { label: "Creators", to: "/creators" },
      { label: "Whitepaper", to: "/whitepaper" },
    ],
  },
  {
    title: "Transparency",
    links: [
      {
        label: "Factory on HashScan",
        to: `${network.hashscanUrl}/contract/${network.factoryAddress}`,
        ext: true,
      },
      {
        label: "Contracts source",
        to: "https://github.com/deanti358-ops/memegraph-contracts",
        ext: true,
      },
      {
        label: "Interface source",
        to: "https://github.com/deanti358-ops/memegraph-interface",
        ext: true,
      },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { label: "Hedera", to: "https://hedera.com", ext: true },
      { label: "HashPack", to: "https://www.hashpack.app", ext: true },
      { label: "Testnet faucet", to: "https://portal.hedera.com", ext: true },
    ],
  },
];

const ICON = "block h-[17px] w-[17px] shrink-0";

const SOCIAL_LINKS = [
  {
    href: SOCIALS.x,
    label: "X",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="currentColor" aria-hidden>
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.3l7.3-8.3L1.6 2H8l4.4 5.9L18.9 2zm-1.1 18.1h1.7L7.1 3.8H5.3l12.5 16.3z" />
      </svg>
    ),
  },
  {
    href: SOCIALS.github,
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="currentColor" aria-hidden>
        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17.2 4.9 18.2 5.2 18.2 5.2c.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6a11.5 11.5 0 0 0 7.8-10.9C23.5 5.7 18.3.5 12 .5z" />
      </svg>
    ),
  },
  {
    href: SOCIALS.discord,
    label: "Discord",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} fill="currentColor" aria-hidden>
        <path d="M20.3 4.4A19.8 19.8 0 0 0 15.9 3l-.6 1.2a18.3 18.3 0 0 0-6.6 0L8.1 3a19.8 19.8 0 0 0-4.4 1.4C.9 8.6.1 12.7.5 16.7A20 20 0 0 0 6 19.5l1.3-1.9c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.4 0l.5.4c-.6.4-1.3.7-2 1l1.3 1.9a20 20 0 0 0 5.5-2.8c.5-4.6-.7-8.7-3.2-12.3zM8.5 14.2c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
      </svg>
    ),
  },
  {
    href: `mailto:${CONTACT_EMAIL}`,
    label: "Contact us",
    icon: <Mail className={ICON} aria-hidden />,
  },
];

export default function Footer() {
  return (
    <footer className="mt-14 border-t border-hairline bg-surface/40 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={30} />
            <span className="font-display text-lg font-bold text-ink-bright">
              Meme
              <span className="bg-gradient-to-r from-neon-pink to-neon-cyan bg-clip-text text-transparent">
                graph
              </span>
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-ink-dim">
            The memecoin launchpad built natively on Hedera. Creators earn a
            network-enforced royalty on every transfer — fast, gas-light,
            impossible to rug.
          </p>
          <div className="flex gap-2.5">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noreferrer"
                title={s.label}
                aria-label={s.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-surface text-ink transition-colors duration-200 hover:border-neon-purple hover:text-ink-bright"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="mb-3 text-[11px] font-bold tracking-wider text-ink-dim uppercase">
              {col.title}
            </h3>
            <ul className="flex list-none flex-col gap-2 p-0">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.ext ? (
                    <a
                      href={l.to}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-ink no-underline transition-colors duration-200 hover:text-neon-cyan"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      to={l.to}
                      className="text-sm text-ink no-underline transition-colors duration-200 hover:text-neon-cyan"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-4 text-xs text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Memegraph · Not financial advice. DYOR.</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-neon-green" />
            Hedera {ACTIVE_NETWORK === "mainnet" ? "Mainnet" : "Testnet"} · royalties
            enforced by the network
          </span>
        </div>
      </div>
    </footer>
  );
}
