"use client";

import { useState } from "react";
import InteractiveLineField, {
  DEFAULT_LINE_COLORS,
  DEFAULT_LINE_PARAMS,
  type LineFieldParams,
} from "@/components/proposal/InteractiveLineField";

/**
 * Line-animation lab — tuning ground for the proposal-hero "lens" line.
 * The 5 brand lines rest on one flat baseline and fan apart into a localized
 * Gaussian bump wherever the cursor is, breathing organically while expanded.
 * Drag the sliders to dial in the feel; "Copy settings" dumps the values.
 */

type BgKey = "app" | "surface" | "wash" | "dark";

const BACKGROUNDS: { key: BgKey; label: string; bg: string; ink: string }[] = [
  { key: "app", label: "App", bg: "var(--bg-app)", ink: "var(--text-primary)" },
  { key: "surface", label: "Surface", bg: "var(--bg-surface)", ink: "var(--text-primary)" },
  {
    key: "wash",
    label: "Brand wash",
    bg: "color-mix(in srgb, #6F3FF3 6%, var(--bg-app))",
    ink: "var(--text-primary)",
  },
  { key: "dark", label: "Dark", bg: "#0e1015", ink: "#f4f4f6" },
];

const LINE_NAMES = ["Green", "Blue", "Amber", "Orange", "Purple"];

export default function LineLab() {
  const [params, setParams] = useState<LineFieldParams>(DEFAULT_LINE_PARAMS);
  const [bg, setBg] = useState<BgKey>("app");
  const [showBaseline, setShowBaseline] = useState(false);
  const [idlePreview, setIdlePreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const stage = BACKGROUNDS.find((b) => b.key === bg)!;

  const set = <K extends keyof LineFieldParams>(key: K, value: LineFieldParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const setAmp = (i: number, value: number) =>
    setParams((p) => {
      const lineAmps = [...p.lineAmps];
      lineAmps[i] = value;
      return { ...p, lineAmps };
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(params, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Beweeg je muis over de lijn. De vijf merklijnen liggen op één lijn en waaieren open op de
        plek van je cursor — ze blijven ademen zolang ze open staan, en de uitslag is nooit precies
        hetzelfde.
      </p>

      {/* Stage */}
      <div
        className="relative mt-6 overflow-hidden rounded-2xl border border-border-default"
        style={{ background: stage.bg, color: stage.ink }}
      >
        {showBaseline && (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
            style={{ background: "color-mix(in srgb, currentColor 12%, transparent)" }}
          />
        )}
        <InteractiveLineField
          params={params}
          colors={DEFAULT_LINE_COLORS}
          height={380}
          forceIdle={idlePreview}
        />
        <p
          className="pointer-events-none absolute bottom-3 left-4 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: "color-mix(in srgb, currentColor 45%, transparent)" }}
        >
          {idlePreview ? "idle (mobile) — breathing on its own" : "hover anywhere on the line"}
        </p>
      </div>

      {/* Top bar: backgrounds + actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Bg
        </span>
        {BACKGROUNDS.map((b) => (
          <button
            key={b.key}
            onClick={() => setBg(b.key)}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: bg === b.key ? "var(--primary)" : "var(--bg-surface)",
              color: bg === b.key ? "#fff" : "var(--text-primary)",
              borderColor: bg === b.key ? "var(--primary)" : "var(--border)",
            }}
          >
            {b.label}
          </button>
        ))}

        <div className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} />

        <button
          onClick={() => setShowBaseline((v) => !v)}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{
            background: showBaseline ? "var(--primary)" : "var(--bg-surface)",
            color: showBaseline ? "#fff" : "var(--text-primary)",
            borderColor: showBaseline ? "var(--primary)" : "var(--border)",
          }}
        >
          Baseline
        </button>
        <button
          onClick={() => setIdlePreview((v) => !v)}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{
            background: idlePreview ? "var(--primary)" : "var(--bg-surface)",
            color: idlePreview ? "#fff" : "var(--text-primary)",
            borderColor: idlePreview ? "var(--primary)" : "var(--border)",
          }}
        >
          Idle (mobile)
        </button>
        <button
          onClick={() => setParams(DEFAULT_LINE_PARAMS)}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--bg-surface)", color: "var(--text-muted)", borderColor: "var(--border)" }}
        >
          ↺ Reset
        </button>
        <button
          onClick={copy}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--bg-surface)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          {copied ? "✓ Copied" : "⧉ Copy settings"}
        </button>
      </div>

      {/* Controls */}
      <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-2">
        <Group title="Shape">
          <Slider label="Bump width (σ)" value={params.sigma} min={14} max={280} step={1} unit="px"
            onChange={(v) => set("sigma", v)} />
          <Slider label="Fan height" value={params.amplitude} min={0} max={150} step={1} unit="px"
            onChange={(v) => set("amplitude", v)} />
          <Slider label="Stroke width" value={params.strokeWidth} min={1} max={12} step={0.5} unit="px"
            onChange={(v) => set("strokeWidth", v)} />
          <Slider label="Peak scatter" value={params.scatter} min={0} max={1.2} step={0.01}
            onChange={(v) => set("scatter", v)} hint="spreads each line's peak sideways → the crossing look" />
        </Group>

        <Group title="Follow">
          <Slider label="Follow lag" value={params.followEase} min={0.02} max={0.4} step={0.005}
            onChange={(v) => set("followEase", v)} hint="lower = the lens trails further behind the cursor" />
          <Slider label="Open / close speed" value={params.openSpeed} min={0.02} max={0.4} step={0.005}
            onChange={(v) => set("openSpeed", v)} hint="how fast the fan opens on enter, closes on leave" />
          <Slider label="Speed reactivity" value={params.speedReactivity} min={0} max={1} step={0.01}
            onChange={(v) => set("speedReactivity", v)} hint="how much faster cursor movement enlarges the bump" />
        </Group>

        <Group title="Breathing">
          <Slider label="Depth" value={params.breatheDepth} min={0} max={0.6} step={0.01}
            onChange={(v) => set("breatheDepth", v)} hint="how much the open lines pulse in height" />
          <Slider label="Speed" value={params.breatheSpeed} min={0} max={4} step={0.05}
            onChange={(v) => set("breatheSpeed", v)} />
          <Slider label="Desync" value={params.breatheDesync} min={0} max={2.5} step={0.05}
            onChange={(v) => set("breatheDesync", v)} hint="phase offset per line so they breathe out of sync" />
        </Group>

        <Group title="Variation">
          <Slider label="Organic wander" value={params.variation} min={0} max={0.6} step={0.01}
            onChange={(v) => set("variation", v)} hint="slow per-line drift → never the same expansion twice" />
        </Group>

        <Group title="Idle (mobile)">
          <p className="-mt-1 mb-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            On touch devices there&rsquo;s no hover — the line breathes on its own at a wandering
            point. Toggle “Idle (mobile)” above to preview it here.
          </p>
          <Slider label="Idle bloom" value={params.idleBloom} min={0} max={1} step={0.01}
            onChange={(v) => set("idleBloom", v)} hint="how far the line fans open at rest (0 = stays flat)" />
          <Slider label="Wander speed" value={params.idleWanderSpeed} min={0.02} max={0.6} step={0.01}
            onChange={(v) => set("idleWanderSpeed", v)} hint="how fast the idle focal point drifts across" />
        </Group>

        <Group title="Per-line amplitude" full>
          <p className="-mt-1 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Signed multiplier per line — positive arcs up, negative dips down. Purple is drawn on top
            and owns the resting line.
          </p>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {params.lineAmps.map((a, i) => (
              <Slider
                key={i}
                label={LINE_NAMES[i] ?? `Line ${i + 1}`}
                swatch={DEFAULT_LINE_COLORS[i]}
                value={a}
                min={-1.4}
                max={1.4}
                step={0.02}
                onChange={(v) => setAmp(i, v)}
              />
            ))}
          </div>
        </Group>
      </div>

      <p className="mt-10 text-xs" style={{ color: "var(--text-muted)" }}>
        Respecteert <code>prefers-reduced-motion</code> (ademen uit, lens opent direct) en blijft op
        touch-apparaten een statische lijn zodat scrollen normaal werkt.
      </p>
    </div>
  );
}

function Group({ title, full, children }: { title: string; full?: boolean; children: React.ReactNode }) {
  return (
    <section className={full ? "md:col-span-2" : undefined}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--primary)" }}>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  swatch,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
  swatch?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {swatch && <span className="inline-block h-3 w-3 rounded-full" style={{ background: swatch }} />}
          {label}
        </span>
        <span className="tabular-nums text-xs" style={{ color: "var(--text-muted)" }}>
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1.5 w-full accent-[var(--primary)]"
      />
      {hint && (
        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}
