/**
 * The Memegraph brand mark: an ascending line-graph (meme + graph) on a
 * rounded-square violet→blue badge, echoing the app-icon look of the token
 * cards. The graph line rises to the right with a node at each vertex.
 */
export default function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      className="grid shrink-0 place-items-center bg-gradient-to-br from-neon-purple to-neon-pink text-white shadow-[0_2px_10px_-2px_var(--color-neon-purple)]"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ascending graph line */}
        <path d="M4 16.5 L9.5 11 L13 13.5 L20 5.5" opacity="0.95" />
        {/* nodes at each vertex */}
        <circle cx="4" cy="16.5" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="11" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="13" cy="13.5" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="20" cy="5.5" r="2.1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
