import { useEffect, useState } from "react";
import { memeImageFromMemo } from "../lib/memeImage";

/**
 * Token artwork, in priority order:
 * 1. The meme's real uploaded image, recorded on the HCS claims topic (see
 *    lib/memeImage.ts) — e.g. a creator's actual photo/artwork.
 * 2. A curated illustration for known demo tokens (public/token-art/*.png —
 *    original artwork, not reproductions of any copyrighted character).
 * 3. A deterministic pick from a generic illustration set, keyed by address,
 *    so any token still gets a distinct, non-placeholder-looking icon.
 *
 * All avatars on a page share one topic scan via the module-level cache in
 * memeImage.ts.
 */

const CURATED: Record<string, string> = {
  MGTEST: "mgtest",
  GRUMP: "grump",
  HDOGE: "hdoge",
  MOONH: "moonh",
  WLAMBO: "wlambo",
  HAMST: "hamst",
};

const FALLBACK = ["rocket", "diamond", "crown", "alien"];

function artUrl(name: string): string {
  return `/token-art/${name}.png`;
}

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
  rounded = true,
  fill = false,
}: {
  symbol?: string;
  address?: string;
  /** token memeMemo (hcs:topic/seq) — enables the on-chain image lookup */
  memo?: string;
  size?: number;
  /** false renders a square (rounded corners) instead of a circle — use for
      the large hero image on cards, matching a "coin logo" rather than a
      profile-picture avatar. */
  rounded?: boolean;
  /** stretch to 100% of the parent (an aspect-ratio container controls the
      actual size) instead of using the `size` prop for fixed pixel dims. */
  fill?: boolean;
}) {
  const [onChainUrl, setOnChainUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setOnChainUrl(null);
    if (memo?.startsWith("hcs:")) {
      memeImageFromMemo(memo)
        .then((url) => alive && url && setOnChainUrl(url))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [memo]);

  const h = hash((address ?? symbol ?? "?").toLowerCase());
  const curated = symbol ? CURATED[symbol] : undefined;
  const src = onChainUrl ?? artUrl(curated ?? FALLBACK[h % FALLBACK.length]);

  return (
    <img
      className="token-avatar"
      src={src}
      alt=""
      width={fill ? undefined : size}
      height={fill ? undefined : size}
      style={{
        width: fill ? "100%" : size,
        height: fill ? "100%" : size,
        objectFit: "cover",
        borderRadius: rounded ? "50%" : fill ? 0 : `${Math.max(6, size * 0.18)}px`,
      }}
    />
  );
}
