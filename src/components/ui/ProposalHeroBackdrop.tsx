/**
 * Hero backdrop for the public proposal — a quiet, client-branded gradient wash.
 * Replaces the earlier animated brand-wave/line system: no SVG strokes, no JS,
 * just a soft brand tint plus a single radial glow that themes the hero to the
 * client's color and hands off cleanly to the body. Light-only (the proposal
 * surface is light-only); degrades to a flat tint where color-mix is unsupported.
 */
export default function ProposalHeroBackdrop({ brandColor }: { brandColor: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ contain: "paint", zIndex: 0 }}
    >
      {/* faint, full-bleed brand wash */}
      <div
        className="absolute inset-0"
        style={{ background: `color-mix(in srgb, ${brandColor} 5%, var(--bg-app))` }}
      />
      {/* soft brand glow, top-right — one gentle light source for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(58% 78% at 82% 8%, color-mix(in srgb, ${brandColor} 18%, transparent) 0%, transparent 60%)`,
        }}
      />
      {/* clean hand-off into the body */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{ background: "linear-gradient(to bottom, transparent, var(--bg-app))" }}
      />
    </div>
  );
}
