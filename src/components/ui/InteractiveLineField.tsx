"use client";

import { useEffect, useRef } from "react";

/**
 * InteractiveLineField — the 5 SUMM brand lines collapsed onto a single flat
 * baseline that fan apart into a localized "lens" (a Gaussian bump) wherever the
 * cursor is. Lines breathe organically while expanded; the expansion amount
 * varies (breathing + slow per-line noise + cursor-speed reactivity) so it is
 * never quite the same twice. Built to be tuned in /proposal/line-lab and then
 * dropped into the proposal hero.
 *
 * Math per line i:
 *   y(x) = centerY - Aᵢ(t) · exp( -((x - focusX - shiftᵢ)/σ)² / 2 )
 * where Aᵢ(t) = openness · lineAmpᵢ · amplitude · breatheᵢ(t) · wanderᵢ(t) · (1 + speedBoost)
 *
 * Paths are updated imperatively (setAttribute on the <path> nodes) inside one
 * rAF loop — React never re-renders per frame. Stroke/colour are React props.
 */

export interface LineFieldParams {
  /** Bump half-width in px (σ of the Gaussian). Larger = wider lens. */
  sigma: number;
  /** Global fan height in px — multiplies each line's signed base amplitude. */
  amplitude: number;
  /** Stroke width in px. */
  strokeWidth: number;
  /** How fast focusX chases the cursor (0..1 lerp per frame). Lower = more lag. */
  followEase: number;
  /** How fast the fan opens/closes on enter/leave (0..1 lerp per frame). */
  openSpeed: number;
  /** Breathing depth as a fraction of amplitude (0 = none). */
  breatheDepth: number;
  /** Breathing speed (radians/sec-ish). */
  breatheSpeed: number;
  /** Per-line breathing phase offset so lines breathe out of sync. */
  breatheDesync: number;
  /** Slow organic wander of each line's peak (0..1). The "never the same" feel. */
  variation: number;
  /** How much cursor speed boosts the expansion (0..1). */
  speedReactivity: number;
  /** Horizontal scatter of each line's peak, as a fraction of σ (0 = peaks stacked). */
  scatter: number;
  /** Idle bloom on no-hover (mobile) devices — openness at rest (0 = flat, off). */
  idleBloom: number;
  /** How fast the idle focal point wanders across the width (lower = slower). */
  idleWanderSpeed: number;
  /** Per-line signed base amplitude profile (paint order; last drawn = on top). */
  lineAmps: number[];
}

export const DEFAULT_LINE_PARAMS: LineFieldParams = {
  sigma: 69,
  amplitude: 49,
  strokeWidth: 7.5,
  followEase: 0.08,
  openSpeed: 0.08,
  breatheDepth: 0.15,
  breatheSpeed: 0.8,
  breatheDesync: 1.65,
  variation: 0.6,
  speedReactivity: 0,
  scatter: 1.2,
  idleBloom: 0.5,
  idleWanderSpeed: 0.18,
  // green ↑ highest, blue ↑, amber ↓, orange ↓ deepest, purple = gentle backbone on top
  lineAmps: [1, 0.6, -0.8, -1.24, 0.16],
};

/** Paint order — last entry is drawn on top, so it owns the resting flat line. */
export const DEFAULT_LINE_COLORS = [
  "#90CDB7", // green
  "#4FAFC7", // blue
  "#E8B370", // amber
  "#E99762", // orange
  "#6F3FF3", // purple (backbone)
];

/** Fixed per-line horizontal peak offsets (× scatter × σ) for the crossing look. */
const BASE_SHIFT = [-0.45, 0.32, -0.22, 0.4, 0.05];

/** Peak offset for line i — tuned values for the first 5, deterministic beyond. */
function shiftFor(i: number): number {
  if (i < BASE_SHIFT.length) return BASE_SHIFT[i];
  const r = Math.sin((i + 1) * 53.17) * 43758.5453;
  return r - Math.floor(r) - 0.5; // ~[-0.5, 0.5]
}

/** Catmull-Rom → cubic-bezier smoothing for a buttery line through sample points. */
function buildPath(pts: number[][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

/** Smooth deterministic per-line noise in ~[-1, 1] — two incommensurate sines. */
function noise(t: number, i: number): number {
  return 0.6 * Math.sin(t * 0.53 + i * 2.1) + 0.4 * Math.sin(t * 0.27 + i * 4.3);
}

export default function InteractiveLineField({
  params,
  colors = DEFAULT_LINE_COLORS,
  className,
  style,
  height,
  forceIdle = false,
}: {
  params: LineFieldParams;
  colors?: string[];
  className?: string;
  style?: React.CSSProperties;
  /** Stage height in px. Omit to drive height via CSS (className/style) instead. */
  height?: number;
  /** Force the autonomous idle behaviour even on hover devices (lab preview). */
  forceIdle?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  // Live params — read inside the rAF loop so slider changes apply instantly.
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  // Mutable animation state (never triggers re-render).
  const size = useRef({ w: 0, h: 0 });
  const focusX = useRef(0);
  const targetX = useRef(0);
  const openness = useRef(0);
  const targetOpen = useRef(0);
  const speed = useRef(0); // decaying cursor speed
  const lastMove = useRef<{ x: number; ts: number } | null>(null);
  const lineCount = colors.length;

  useEffect(() => {
    const wrap = wrapRef.current;
    const svg = svgRef.current;
    if (!wrap || !svg) return;

    const mq = (q: string) => typeof window.matchMedia === "function" && window.matchMedia(q).matches;
    const reduced = mq("(prefers-reduced-motion: reduce)");
    // Only wire up cursor interaction on real hover devices — on touch the line
    // stays a clean static divider and never blocks vertical scrolling.
    const interactive = mq("(hover: hover) and (pointer: fine)");

    // Keep the SVG's internal coordinate system equal to its pixel size so the
    // cursor maps 1:1 and stroke width stays in real px.
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      size.current = { w: r.width, h: r.height };
      svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);

    focusX.current = size.current.w / 2;
    targetX.current = focusX.current;

    const draw = (t: number) => {
      const p = paramsRef.current;
      const { w, h } = size.current;
      const centerY = h / 2;
      const N = Math.max(48, Math.min(160, Math.round(w / 13)));
      const step = w / (N - 1);
      const open = openness.current;
      const speedBoost = p.speedReactivity * Math.min(1, speed.current * 0.8);

      for (let li = 0; li < lineCount; li++) {
        const node = pathRefs.current[li];
        if (!node) continue;

        const baseShift = shiftFor(li) * p.scatter * p.sigma;
        const breathe = 1 + p.breatheDepth * Math.sin(t * p.breatheSpeed + li * p.breatheDesync);
        const wander = 1 + p.variation * noise(t, li);
        const amp =
          open * (p.lineAmps[li] ?? 0) * p.amplitude * breathe * wander * (1 + speedBoost);

        const pts: number[][] = [];
        for (let s = 0; s < N; s++) {
          const x = s * step;
          const u = (x - focusX.current - baseShift) / p.sigma;
          const g = Math.exp(-(u * u) / 2);
          pts.push([x, centerY - amp * g]);
        }
        node.setAttribute("d", buildPath(pts));
      }
    };

    let raf = 0;

    // Idle mode — touch/no-hover devices (or the lab's idle preview). The line
    // breathes autonomously at a slowly wandering focal point. No pointer
    // listeners, so the page still scrolls normally over the band. Under
    // reduced-motion it falls back to a clean static line (no loop).
    if (!interactive || forceIdle) {
      if (reduced) {
        openness.current = 0;
        draw(0);
        return () => ro.disconnect();
      }
      const idleLoop = (now: number) => {
        const t = now / 1000;
        const p = paramsRef.current;
        const w = size.current.w;
        // Organic two-harmonic drift across the middle ~75% of the width.
        const wander =
          0.5 + 0.34 * Math.sin(t * p.idleWanderSpeed) + 0.08 * Math.sin(t * p.idleWanderSpeed * 2.7);
        focusX.current = w * wander;
        openness.current += (p.idleBloom - openness.current) * 0.05;
        speed.current = 0;
        draw(t);
        raf = requestAnimationFrame(idleLoop);
      };
      raf = requestAnimationFrame(idleLoop);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }

    if (reduced) {
      // Reduced motion: no loop, no breathing. Draw flat; snap a static fan on
      // hover (functional, instant — no continuous motion).
      openness.current = 0;
      draw(0);
    } else {
      const loop = (now: number) => {
        const t = now / 1000;
        const p = paramsRef.current;
        openness.current += (targetOpen.current - openness.current) * p.openSpeed;
        focusX.current += (targetX.current - focusX.current) * p.followEase;
        speed.current *= 0.9; // decay cursor speed each frame
        draw(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    // Pointer wiring.
    const pointAt = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * size.current.w;
    };
    const onEnter = (e: PointerEvent) => {
      const x = pointAt(e.clientX);
      targetX.current = x;
      if (openness.current < 0.02) focusX.current = x; // snap on first open
      targetOpen.current = 1;
      lastMove.current = { x, ts: e.timeStamp };
      if (reduced) {
        openness.current = 1;
        focusX.current = x;
        draw(0);
      }
    };
    const onMove = (e: PointerEvent) => {
      const x = pointAt(e.clientX);
      targetX.current = x;
      const last = lastMove.current;
      if (last) {
        const dt = Math.max(1, e.timeStamp - last.ts);
        const inst = Math.abs(x - last.x) / dt; // px per ms
        speed.current = Math.max(speed.current, Math.min(3, inst));
      }
      lastMove.current = { x, ts: e.timeStamp };
      if (reduced) {
        openness.current = 1;
        focusX.current = x;
        draw(0);
      }
    };
    const onLeave = () => {
      targetOpen.current = 0;
      if (reduced) {
        openness.current = 0;
        draw(0);
      }
    };

    wrap.addEventListener("pointerenter", onEnter);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
    };
    // Structural deps only; params flow via the ref.
  }, [lineCount, height, forceIdle]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", height, ...style }}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        fill="none"
      >
        {colors.map((c, i) => (
          <path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            strokeWidth={params.strokeWidth}
            strokeLinecap="round"
            fill="none"
            style={{ stroke: c }}
          />
        ))}
      </svg>
    </div>
  );
}
