/**
 * The Memegraph brand mark: the letter "M" drawn as a rising market line —
 * meme and graph fused into one glyph. Two peaks make the M; the final
 * stroke breaks out above them and ends in a bright node, so the letter
 * itself reads as a chart that finishes higher than it started.
 */
export default function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      className="relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-neon-purple via-neon-purple to-neon-pink text-white shadow-[0_2px_12px_-2px_var(--color-neon-purple)]"
    >
      {/* soft top-left sheen so the badge reads as an app icon */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,0.28), transparent 55%)",
        }}
      />
      <svg
        width={size * 0.66}
        height={size * 0.66}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* M-as-market-line: up, dip, up, breakout */}
        <path d="M3.5 19 L8 8 L12 14.5 L16 6.5 L20.5 3.5" />
        {/* start + breakout nodes */}
        <circle cx="3.5" cy="19" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="20.5" cy="3.5" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
