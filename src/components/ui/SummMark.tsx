// The SUMM icon mark — a 2×2 grid of rounded tiles, diagonal pair at full
// opacity, anti-diagonal at half. Single source of truth for the mark
// (previously duplicated inline in the login page and IconNav). The full
// wordmark (letters + icon) lives in SummLogo.tsx.
//
// Deliberately NOT a client component: it renders pure SVG (the `animated`
// tile shimmer is CSS-only via the .summ-tile keyframe in globals.css), so it
// can sit inside the statically prerendered /login page.

const TILES = [
  { x: 3, y: 3, opacity: 1 },
  { x: 14, y: 3, opacity: 0.5 },
  { x: 3, y: 14, opacity: 0.5 },
  { x: 14, y: 14, opacity: 1 },
];

export default function SummMark({
  size = 22,
  animated = false,
  className,
}: {
  size?: number;
  /** Gentle staggered opacity shimmer across the tiles (loader/overlay use). */
  animated?: boolean;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      {TILES.map((tile, i) => (
        <rect
          key={i}
          x={tile.x}
          y={tile.y}
          width="7"
          height="7"
          rx="1.5"
          fill="var(--primary)"
          opacity={tile.opacity}
          className={animated ? "summ-tile" : undefined}
          style={
            animated
              ? ({ "--summ-tile-base": tile.opacity, animationDelay: `${i * 150}ms` } as React.CSSProperties)
              : undefined
          }
        />
      ))}
    </svg>
  );
}
