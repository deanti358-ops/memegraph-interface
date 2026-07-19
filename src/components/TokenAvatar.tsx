import { useEffect, useState } from "react";
import { memeImageFromMemo } from "../lib/memeImage";

/**
 * Token avatar. If the meme's artwork was recorded on the HCS claims topic
 * (see lib/memeImage.ts) it is shown; otherwise falls back to a stable
 * emoji + gradient derived from the token's address. All avatars on a page
 * share one topic scan via the module-level cache.
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
  memo,
  size = 34,
}: {
  symbol?: string;
  address?: string;
  /** token memeMemo (hcs:topic/seq) — enables the on-chain image lookup */
  memo?: string;
  size?: number;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (memo?.startsWith("hcs:")) {
      memeImageFromMemo(memo)
        .then((url) => alive && url && setImageUrl(url))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [memo]);

  if (imageUrl) {
    return (
      <img
        className="token-avatar"
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "cover" }}
      />
    );
  }

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
