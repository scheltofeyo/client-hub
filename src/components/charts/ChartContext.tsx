"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type ChartMode = "internal" | "branded";

export interface ChartTransition {
  durationMs: number;
  staggerMs: number;
  ease: [number, number, number, number] | "linear";
}

export interface ChartContextValue {
  mode: ChartMode;
  /** When set on `branded` mode, the wrapper writes this into `--client-accent` on its style. */
  clientAccent?: string;
  enter: ChartTransition;
  /** Whether interactive hover dim/lift behaviors should be enabled. Off in branded mode. */
  interactiveHover: boolean;
}

const INTERNAL_DEFAULT: ChartContextValue = {
  mode: "internal",
  enter: { durationMs: 700, staggerMs: 40, ease: [0.22, 1, 0.36, 1] }, // ease-out-quart
  interactiveHover: true,
};

const BRANDED_DEFAULT: ChartContextValue = {
  mode: "branded",
  enter: { durationMs: 980, staggerMs: 56, ease: [0.39, 0.575, 0.565, 1] }, // ease-out-sine, +40% duration
  interactiveHover: false,
};

const ChartCtx = createContext<ChartContextValue>(INTERNAL_DEFAULT);

export function ChartProvider({
  mode = "internal",
  clientAccent,
  children,
}: {
  mode?: ChartMode;
  clientAccent?: string;
  children: ReactNode;
}) {
  const value = useMemo<ChartContextValue>(
    () => ({ ...(mode === "branded" ? BRANDED_DEFAULT : INTERNAL_DEFAULT), clientAccent }),
    [mode, clientAccent]
  );

  // When clientAccent is provided, scope it as a CSS custom property on the
  // wrapper so descendant charts pick it up via `var(--client-accent, …)`.
  const style = clientAccent
    ? ({ "--client-accent": clientAccent } as React.CSSProperties)
    : undefined;

  return (
    <ChartCtx.Provider value={value}>
      <div style={style} className="contents">
        {children}
      </div>
    </ChartCtx.Provider>
  );
}

export function useChartContext(): ChartContextValue {
  return useContext(ChartCtx);
}
