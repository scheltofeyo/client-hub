"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthNavigatorProps {
  year: number;
  month: number; // 1-based
  onPrev: () => void;
  onNext: () => void;
}

export default function MonthNavigator({ year, month, onPrev, onNext }: MonthNavigatorProps) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onPrev} className="btn-icon p-1.5 rounded-lg">
        <ChevronLeft size={18} />
      </button>
      <button onClick={onNext} className="btn-icon p-1.5 rounded-lg">
        <ChevronRight size={18} />
      </button>
      <h2 className="typo-section-title" style={{ color: "var(--text-primary)" }}>
        {MONTH_NAMES[month - 1]} {year}
      </h2>
    </div>
  );
}
