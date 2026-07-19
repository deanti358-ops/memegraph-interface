/**
 * Deterministic token avatar: a stable emoji + gradient derived from the
 * token's address, so every token gets a distinct face with no image
 * hosting. Known demo tokens get curated emoji.
 */

const CURATED: Record<string, string> = {
  MGTEST: "🧪",
  GRUMP: "😾",
  HDOGE: "🐕",
  PEPEH: "🐸",
  MOONH: "🌙",
  WLAMBO: "🏎️",
  HAMST: "🐹",
};

const FALLBACK = ["🚀", "🔥", "💎", "🦍", "🐳", "🎩", "👑", "🍕", "🤖", "🌵", "🦆", "🍄"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function TokenAvatar({
  symbol,
  address,
  size = 34,
}: {
  symbol?: string;
  address?: string;
  size?: number;
}) {
  const h = hash((address ?? symbol ?? "?").toLowerCase());
  const emoji = (symbol && CURATED[symbol]) || FALLBACK[h % FALLBACK.length];
  const hue1 = h % 360;
  const hue2 = (hue1 + 70) % 360;
  return (
    <span
      className="token-avatar"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.52),
        background: `linear-gradient(135deg, hsl(${hue1} 70% 45%), hsl(${hue2} 70% 30%))`,
      }}
    >
      {emoji}
    </span>
  );
}
