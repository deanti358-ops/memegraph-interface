/** The Memegraph share-node mark on the brand gradient. */
export default function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-neon-purple to-neon-pink text-white shadow-[0_0_18px_-4px_var(--color-neon-pink)]"
    >
      <svg
        width={size * 0.53}
        height={size * 0.53}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="6" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="5.5" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="18.5" r="2.4" fill="currentColor" stroke="none" />
        <path d="M8 11l7-4.5M8 13l7 4.5" />
      </svg>
    </span>
  );
}
