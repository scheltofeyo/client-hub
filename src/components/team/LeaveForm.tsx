"use client";

import { useState } from "react";
import type { TimeOffEntry, LeaveType, DayPortion } from "@/types";

interface CalendarUser {
  id: string;
  name: string;
  image: string | null;
  role: string;
}

interface LeaveFormProps {
  entry?: TimeOffEntry;
  prefillUserId?: string;
  prefillDate?: string;
  leaveTypes: LeaveType[];
  users?: CalendarUser[]; // only provided when canManageAny
  currentUserId: string;
  onSaved: () => void;
  onDeleted?: () => void;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/40";
const inputStyle = {
  background: "var(--bg-sidebar)",
  borderColor: "var(--border)",
  color: "var(--text-primary)",
};

const ALL_PORTION_OPTIONS: { value: DayPortion; label: string }[] = [
  { value: "full", label: "Full day" },
  { value: "am", label: "Morning only" },
  { value: "pm", label: "Afternoon only" },
];

// Multi-day first day: you either take the full day off or leave in the afternoon
const FIRST_DAY_OPTIONS: { value: DayPortion; label: string }[] = [
  { value: "full", label: "Full day" },
  { value: "pm", label: "Afternoon only" },
];

// Multi-day last day: you either take the full day off or return in the afternoon (morning only off)
const LAST_DAY_OPTIONS: { value: DayPortion; label: string }[] = [
  { value: "full", label: "Full day" },
  { value: "am", label: "Morning only" },
];

export default function LeaveForm({
  entry,
  prefillUserId,
  prefillDate,
  leaveTypes,
  users,
  currentUserId,
  onSaved,
  onDeleted,
  onClose,
}: LeaveFormProps) {
  const isEdit = !!entry;

  const [userId, setUserId] = useState(entry?.userId ?? prefillUserId ?? currentUserId);
  const [startDate, setStartDate] = useState(entry?.startDate ?? prefillDate ?? "");
  const [endDate, setEndDate] = useState(entry?.endDate ?? prefillDate ?? "");
  const [startDayPortion, setStartDayPortion] = useState<DayPortion>(entry?.startDayPortion ?? "full");
  const [endDayPortion, setEndDayPortion] = useState<DayPortion>(entry?.endDayPortion ?? "full");
  const [leaveTypeSlug, setLeaveTypeSlug] = useState(entry?.leaveTypeSlug ?? leaveTypes[0]?.slug ?? "vacation");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const isMultiDay = startDate && endDate && startDate !== endDate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate || !leaveTypeSlug) return;

    setSaving(true);
    setError("");

    const body = {
      userId: users ? userId : undefined,
      startDate,
      endDate,
      startDayPortion,
      endDayPortion: isMultiDay ? endDayPortion : startDayPortion,
      leaveTypeSlug,
      notes: notes.trim() || undefined,
    };

    try {
      const url = isEdit ? `/api/time-off/${entry.id}` : "/api/time-off";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save");
        return;
      }

      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry || !confirm("Delete this time off entry?")) return;

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/time-off/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete");
        return;
      }
      onDeleted?.();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  const selectedLeaveType = leaveTypes.find((lt) => lt.slug === leaveTypeSlug);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-1 py-2">
      {/* User selector — only for admins */}
      {users && (
        <div>
          <label className="typo-label">Employee</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="typo-label">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              const newStart = e.target.value;
              setStartDate(newStart);
              if (!endDate || newStart > endDate) setEndDate(newStart);
              // Reset invalid portions for multi-day
              const willBeMultiDay = newStart && endDate && newStart !== endDate && newStart <= endDate;
              if (willBeMultiDay && startDayPortion === "am") setStartDayPortion("full");
            }}
            className={inputClass}
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label className="typo-label">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              const newEnd = e.target.value;
              setEndDate(newEnd);
              const willBeMultiDay = startDate && newEnd && startDate !== newEnd;
              if (willBeMultiDay && startDayPortion === "am") setStartDayPortion("full");
              if (willBeMultiDay && endDayPortion === "pm") setEndDayPortion("full");
            }}
            min={startDate}
            className={inputClass}
            style={inputStyle}
            required
          />
        </div>
      </div>

      {/* Day portion — start day */}
      <div>
        <label className="typo-label">
          {isMultiDay ? "First day" : "Day type"}
        </label>
        <div className="flex gap-2">
          {(isMultiDay ? FIRST_DAY_OPTIONS : ALL_PORTION_OPTIONS).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStartDayPortion(value)}
              className="flex-1 text-xs font-medium py-2 rounded-lg border transition-colors"
              style={{
                background: startDayPortion === value ? "var(--primary-light)" : "var(--bg-sidebar)",
                borderColor: startDayPortion === value ? "var(--primary)" : "var(--border)",
                color: startDayPortion === value ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Day portion — end day (only for multi-day) */}
      {isMultiDay && (
        <div>
          <label className="typo-label">Last day</label>
          <div className="flex gap-2">
            {LAST_DAY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEndDayPortion(value)}
                className="flex-1 text-xs font-medium py-2 rounded-lg border transition-colors"
                style={{
                  background: endDayPortion === value ? "var(--primary-light)" : "var(--bg-sidebar)",
                  borderColor: endDayPortion === value ? "var(--primary)" : "var(--border)",
                  color: endDayPortion === value ? "var(--primary)" : "var(--text-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Leave type */}
      <div>
        <label className="typo-label">Leave type</label>
        <div className="flex gap-2 flex-wrap">
          {leaveTypes.map((lt) => (
            <button
              key={lt.slug}
              type="button"
              onClick={() => setLeaveTypeSlug(lt.slug)}
              className="flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg border transition-colors"
              style={{
                background: leaveTypeSlug === lt.slug ? lt.color + "20" : "var(--bg-sidebar)",
                borderColor: leaveTypeSlug === lt.slug ? lt.color : "var(--border)",
                color: leaveTypeSlug === lt.slug ? lt.color : "var(--text-muted)",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: lt.color }}
              />
              {lt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="typo-label">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 200))}
          placeholder="e.g. dentist appointment, family event..."
          rows={2}
          className={inputClass}
          style={inputStyle}
        />
        <div className="text-[10px] mt-1 text-right" style={{ color: "var(--text-muted)" }}>
          {notes.length}/200
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !startDate || !endDate}
          className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost text-sm px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="btn-danger text-sm px-4 py-2 rounded-lg ml-auto disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
