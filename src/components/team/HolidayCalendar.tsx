"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import MonthNavigator from "./MonthNavigator";
import CalendarGrid from "./CalendarGrid";
import LeaveForm from "./LeaveForm";
import { useRightPanel } from "@/components/layout/RightPanel";
import type { TimeOffEntry, LeaveType, CompanyHoliday } from "@/types";

interface CalendarUser {
  id: string;
  name: string;
  image: string | null;
  role: string;
}

interface HolidayCalendarProps {
  initialEntries: TimeOffEntry[];
  initialUsers: CalendarUser[];
  leaveTypes: LeaveType[];
  companyHolidays: CompanyHoliday[];
  initialYear: number;
  initialMonth: number;
  currentUserId: string;
  permissions: string[];
}

export default function HolidayCalendar({
  initialEntries,
  initialUsers,
  leaveTypes,
  companyHolidays,
  initialYear,
  initialMonth,
  currentUserId,
  permissions,
}: HolidayCalendarProps) {
  const router = useRouter();
  const { openPanel, closePanel } = useRightPanel();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [entries, setEntries] = useState<TimeOffEntry[]>(initialEntries);
  const [users, setUsers] = useState<CalendarUser[]>(initialUsers);
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, { entries: TimeOffEntry[]; users: CalendarUser[] }>>(new Map());

  // Cache the initial data
  useEffect(() => {
    const key = `${initialYear}-${initialMonth}`;
    cacheRef.current.set(key, { entries: initialEntries, users: initialUsers });
  }, [initialYear, initialMonth, initialEntries, initialUsers]);

  const fetchMonth = useCallback(async (y: number, m: number) => {
    const key = `${y}-${m}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setEntries(cached.entries);
      setUsers(cached.users);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/time-off?month=${y}-${String(m).padStart(2, "0")}`);
      if (res.ok) {
        const data = await res.json();
        cacheRef.current.set(key, data);
        setEntries(data.entries);
        setUsers(data.users);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrev = useCallback(() => {
    const newMonth = month === 1 ? 12 : month - 1;
    const newYear = month === 1 ? year - 1 : year;
    setMonth(newMonth);
    setYear(newYear);
    fetchMonth(newYear, newMonth);
  }, [year, month, fetchMonth]);

  const handleNext = useCallback(() => {
    const newMonth = month === 12 ? 1 : month + 1;
    const newYear = month === 12 ? year + 1 : year;
    setMonth(newMonth);
    setYear(newYear);
    fetchMonth(newYear, newMonth);
  }, [year, month, fetchMonth]);

  const refreshCurrentMonth = useCallback(() => {
    // Clear cache for current month to force refetch
    cacheRef.current.delete(`${year}-${month}`);
    fetchMonth(year, month);
  }, [year, month, fetchMonth]);

  const canManageOwn = permissions.includes("team.manageOwnLeave");
  const canManageAny = permissions.includes("team.manageAnyLeave");

  const handleCellClick = useCallback((userId: string, date: string, existingEntry?: TimeOffEntry) => {
    const isOwn = userId === currentUserId;
    if (!canManageOwn && isOwn) return;
    if (!canManageAny && !isOwn) return;

    openPanel(
      existingEntry ? "Edit Time Off" : "Add Time Off",
      <LeaveForm
        entry={existingEntry}
        prefillUserId={userId}
        prefillDate={date}
        leaveTypes={leaveTypes}
        users={canManageAny ? users : undefined}
        currentUserId={currentUserId}
        onSaved={() => {
          closePanel();
          refreshCurrentMonth();
          router.refresh();
        }}
        onDeleted={() => {
          closePanel();
          refreshCurrentMonth();
          router.refresh();
        }}
        onClose={closePanel}
      />
    );
  }, [currentUserId, canManageOwn, canManageAny, leaveTypes, users, openPanel, closePanel, refreshCurrentMonth, router]);

  const handleAddTimeOff = useCallback(() => {
    openPanel(
      "Add Time Off",
      <LeaveForm
        leaveTypes={leaveTypes}
        users={canManageAny ? users : undefined}
        currentUserId={currentUserId}
        onSaved={() => {
          closePanel();
          refreshCurrentMonth();
          router.refresh();
        }}
        onClose={closePanel}
      />
    );
  }, [leaveTypes, users, canManageAny, currentUserId, openPanel, closePanel, refreshCurrentMonth, router]);

  // Collect unique roles for filter
  const roles = Array.from(new Set(users.map((u) => u.role).filter(Boolean))).sort();
  const filteredUsers = roleFilter === "all" ? users : users.filter((u) => u.role === roleFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-7 py-4 shrink-0">
        <MonthNavigator year={year} month={month} onPrev={handlePrev} onNext={handleNext} />

        <div className="flex items-center gap-3 ml-auto">
          {roles.length > 1 && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          {(canManageOwn || canManageAny) && (
            <button onClick={handleAddTimeOff} className="btn-primary text-sm px-3 py-1.5 rounded-lg">
              + Add Time Off
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto px-7 pb-7">
        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>
            Loading...
          </div>
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            users={filteredUsers}
            entries={entries}
            leaveTypes={leaveTypes}
            companyHolidays={companyHolidays}
            currentUserId={currentUserId}
            canManageOwn={canManageOwn}
            canManageAny={canManageAny}
            onCellClick={handleCellClick}
          />
        )}
      </div>
    </div>
  );
}
