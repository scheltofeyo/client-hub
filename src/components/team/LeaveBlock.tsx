"use client";

import {
  Sun,
  Thermometer,
  User,
  Circle,
  Palmtree,
  Baby,
  GraduationCap,
  Heart,
  Briefcase,
  Plane,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sun,
  Thermometer,
  User,
  Circle,
  Palmtree,
  Baby,
  GraduationCap,
  Heart,
  Briefcase,
  Plane,
};

interface LeaveBlockProps {
  color: string;
  icon: string;
  portion: "full" | "am" | "pm";
  muted?: boolean;
}

export default function LeaveBlock({ color, icon, portion, muted }: LeaveBlockProps) {
  const Icon = ICON_MAP[icon] ?? Circle;
  // Muted: grayscale + low opacity — indicates "doesn't count" (weekends)
  const blockOpacity = muted ? 0.3 : 0.85;
  const filter = muted ? "grayscale(0.6)" : undefined;

  if (portion === "full") {
    return (
      <div
        className="absolute inset-0.5 rounded-sm flex items-center justify-center"
        style={{ background: color, opacity: blockOpacity, filter }}
      >
        <Icon size={14} color="#fff" strokeWidth={2} />
      </div>
    );
  }

  const isAm = portion === "am";

  return (
    <div className="absolute inset-0">
      <div
        className={`absolute left-0.5 right-0.5 rounded-sm flex items-center justify-center ${isAm ? "top-0.5" : "bottom-0.5"}`}
        style={{
          background: color,
          opacity: blockOpacity,
          filter,
          height: "calc(50% - 2px)",
        }}
      >
        <Icon size={11} color="#fff" strokeWidth={2} />
      </div>
    </div>
  );
}
