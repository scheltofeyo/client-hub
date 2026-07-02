"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import InteractiveLineField, { DEFAULT_LINE_PARAMS } from "@/components/ui/InteractiveLineField";
import SummMark from "@/components/ui/SummMark";

const MESSAGES = [
  "Loading clients",
  "Checking open tasks",
  "Fetching project data",
  "Connecting to the database",
  "Preparing your workspace",
  "Gathering client insights",
  "Loading team assignments",
  "Syncing activity log",
  "Checking project statuses",
  "Fetching recent activity",
  "Loading logbook entries",
  "Preparing timeline events",
  "Checking Google Drive status",
  "Loading project templates",
  "Gathering contact information",
  "Fetching follow-up tasks",
  "Loading linked sheets",
  "Checking due dates",
  "Pulling in the latest signals",
  "Almost there",
];

// Scaled down from the proposal-hero tuning (DEFAULT_LINE_PARAMS stays owned
// by LineLab + ProposalHeroLine) so the lines read as a loader ornament, not
// a hero: thinner strokes, smaller bloom, a touch more openness at rest.
const LOADER_LINE_PARAMS = {
  ...DEFAULT_LINE_PARAMS,
  amplitude: 32,
  strokeWidth: 4.5,
  sigma: 60,
  idleBloom: 0.6,
};

/**
 * Branded loading state: the SUMM mark shimmering above the five brand lines
 * breathing in their autonomous idle mode. Replaces the old bouncing-dots
 * LoadingThinking; keeps its cycling status messages.
 */
export default function BrandLoader({
  showMessages = true,
  linesHeight = 150,
  className,
}: {
  showMessages?: boolean;
  linesHeight?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduceMotion) return;
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 1800);

    return () => clearInterval(cycle);
  }, [reduceMotion]);

  return (
    <div className={`flex flex-col items-center justify-center h-full gap-6 ${className ?? ""}`}>
      <SummMark size={30} animated />

      <InteractiveLineField
        forceIdle
        height={linesHeight}
        params={LOADER_LINE_PARAMS}
        className="w-full max-w-[420px]"
      />

      {showMessages && (
        <p
          className="text-sm"
          style={{
            color: "var(--text-secondary)",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {reduceMotion ? <>Preparing your workspace&hellip;</> : <>{MESSAGES[index]}&hellip;</>}
        </p>
      )}
    </div>
  );
}
