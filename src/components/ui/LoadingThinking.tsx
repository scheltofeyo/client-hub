"use client";

import { useEffect, useState } from "react";

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

export default function LoadingThinking() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 1800);

    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      {/* Animated dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: "var(--primary)",
              animation: `thinking-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Cycling message */}
      <p
        className="text-sm"
        style={{
          color: "var(--text-secondary)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {MESSAGES[index]}&hellip;
      </p>

      <style>{`
        @keyframes thinking-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
