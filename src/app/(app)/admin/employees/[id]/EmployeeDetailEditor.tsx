"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PageHeader from "@/components/layout/PageHeader";
import { Save, Archive, RotateCcw, AlertTriangle } from "lucide-react";
import { usePermission } from "@/hooks/usePermission";

interface RoleOption { slug: string; name: string; }

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  status: string;
  googleName: string | null;
  googleImage: string | null;
  displayName: string;
  displayImage: string;
  firstName: string;
  preposition: string;
  lastName: string;
  dateOfBirth: string;
  dateStarted: string;
  employeeNumber: string;
  vacationDays: number | null;
  contractType: string;
  contractHours: number | null;
  contractEndDate: string;
  jobTitle: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  invitedAt: string | null;
  createdAt: string;
}

type TabKey = "identity" | "employment" | "access" | "notes";

const ALL_TABS: { key: TabKey; label: string; adminOnly: boolean }[] = [
  { key: "identity",   label: "Identity & Personal", adminOnly: false },
  { key: "employment", label: "Employment",          adminOnly: true },
  { key: "access",     label: "System Access",       adminOnly: true },
  { key: "notes",      label: "Notes",               adminOnly: true },
];

const TAB_FIELDS: Record<TabKey, string[]> = {
  identity: [
    "displayName", "displayImage",
    "firstName", "preposition", "lastName",
    "dateOfBirth", "phone",
    "emergencyContactName", "emergencyContactPhone",
  ],
  employment: [
    "dateStarted", "employeeNumber",
    "vacationDays", "contractType", "contractHours", "contractEndDate",
    "jobTitle",
  ],
  access: ["role", "status"],
  notes: ["notes"],
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="typo-section-header mb-3 mt-8 first:mt-0"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </h2>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full text-sm px-3 py-2 rounded-lg disabled:opacity-50"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-input)",
        color: "var(--text-primary)",
      }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder={placeholder}
      className="w-full text-sm px-3 py-2 rounded-lg"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-input)",
        color: "var(--text-primary)",
      }}
    />
  );
}

export default function EmployeeDetailEditor({
  employee,
  isCurrentUser,
  mode = "admin",
}: {
  employee: EmployeeData;
  isCurrentUser: boolean;
  mode?: "admin" | "self";
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

  // Form state
  const [displayName, setDisplayName] = useState(employee.displayName);
  const [displayImage, setDisplayImage] = useState(employee.displayImage);
  const [firstName, setFirstName] = useState(employee.firstName);
  const [preposition, setPreposition] = useState(employee.preposition);
  const [lastName, setLastName] = useState(employee.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(employee.dateOfBirth);
  const [dateStarted, setDateStarted] = useState(employee.dateStarted);
  const [employeeNumber, setEmployeeNumber] = useState(employee.employeeNumber);
  const [vacationDays, setVacationDays] = useState(employee.vacationDays);
  const [contractType, setContractType] = useState(employee.contractType);
  const [contractHours, setContractHours] = useState(employee.contractHours);
  const [contractEndDate, setContractEndDate] = useState(employee.contractEndDate);
  const [jobTitle, setJobTitle] = useState(employee.jobTitle);
  const [phone, setPhone] = useState(employee.phone);
  const [emergencyContactName, setEmergencyContactName] = useState(employee.emergencyContactName);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(employee.emergencyContactPhone);
  const [notes, setNotes] = useState(employee.notes);
  const [role, setRole] = useState(employee.role);
  const [status, setStatus] = useState(employee.status);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const canArchive = usePermission("employees.archive");

  // Archive state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveImpact, setArchiveImpact] = useState<{
    clientLeadCount: number;
    clientNames: string[];
    openTaskCount: number;
    futureTimeOffCount: number;
  } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    if (mode !== "admin") return;
    fetch("/api/roles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Array<{ slug: string; name: string }>) =>
        setRoleOptions(data.map((r) => ({ slug: r.slug, name: r.name })))
      )
      .catch(() => {});
  }, [mode]);

  async function handleArchiveClick() {
    setLoadingImpact(true);
    try {
      const res = await fetch(`/api/users/${employee.id}/archive-impact`);
      if (res.ok) {
        const data = await res.json();
        setArchiveImpact(data);
        setShowArchiveDialog(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to load impact preview");
      }
    } catch {
      setError("Failed to load impact preview");
    }
    setLoadingImpact(false);
  }

  async function handleArchiveConfirm() {
    setArchiving(true);
    const res = await fetch(`/api/users/${employee.id}/archive`, { method: "POST" });
    if (res.ok) {
      setShowArchiveDialog(false);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to archive employee");
    }
    setArchiving(false);
  }

  async function handleReactivate() {
    setReactivating(true);
    setError("");
    const res = await fetch(`/api/users/${employee.id}/reactivate`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to reactivate employee");
    }
    setReactivating(false);
  }

  const fieldValues: Record<string, unknown> = {
    displayName: displayName || null,
    displayImage: displayImage || null,
    firstName: firstName || null,
    preposition: preposition || null,
    lastName: lastName || null,
    dateOfBirth: dateOfBirth || null,
    phone: phone || null,
    emergencyContactName: emergencyContactName || null,
    emergencyContactPhone: emergencyContactPhone || null,
    dateStarted: dateStarted || null,
    employeeNumber: employeeNumber || null,
    vacationDays,
    contractType: contractType || null,
    contractHours,
    contractEndDate: contractEndDate || null,
    jobTitle: jobTitle || null,
    notes: notes || null,
    role,
    status,
  };

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);

    const fields = TAB_FIELDS[activeTab];
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      body[field] = fieldValues[field];
    }

    const res = await fetch(`/api/users/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save changes");
    }

    setSaving(false);
  }

  const visibleTabs = mode === "admin"
    ? ALL_TABS
    : ALL_TABS.filter((t) => !t.adminOnly);

  const breadcrumbs = mode === "admin"
    ? [
        { label: "Admin", href: "/admin" },
        { label: "Employees", href: "/admin?tab=users" },
        { label: "..." },
      ]
    : [{ label: "Profile" }];

  const avatarSrc = displayImage || employee.googleImage || employee.image;

  const tertiaryNav = (
    <div
      className="flex gap-0 border-b shrink-0 -mx-7 px-7 mt-2"
      style={{ borderColor: "var(--border)" }}
    >
      {visibleTabs.map(({ key, label }) => {
        const active = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className="px-1 py-3 mr-5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: active ? "var(--primary)" : "transparent",
              color: active ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={employee.name}
        sticky
        tertiaryNav={tertiaryNav}
        actions={
          <div className="flex items-center gap-2">
            {success && (
              <span className="text-sm" style={{ color: "var(--success)" }}>Saved</span>
            )}
            {error && (
              <span className="text-sm" style={{ color: "var(--danger)" }}>{error}</span>
            )}
            {mode === "admin" && canArchive && !isCurrentUser && employee.status !== "inactive" && (
              <button
                onClick={handleArchiveClick}
                disabled={loadingImpact}
                className="btn-danger text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Archive size={14} />
                {loadingImpact ? "Loading\u2026" : "Archive"}
              </button>
            )}
            {mode === "admin" && canArchive && employee.status === "inactive" && (
              <button
                onClick={handleReactivate}
                disabled={reactivating}
                className="btn-secondary border text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <RotateCcw size={14} />
                {reactivating ? "Reactivating\u2026" : "Reactivate"}
              </button>
            )}
            {employee.status !== "inactive" && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Save size={14} />
                {saving ? "Saving\u2026" : "Save Changes"}
              </button>
            )}
          </div>
        }
      />

      {/* Archived banner */}
      {employee.status === "inactive" && (
        <div
          className="mx-7 mt-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
          style={{
            background: "color-mix(in srgb, var(--danger) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            color: "var(--danger)",
          }}
        >
          <Archive size={14} />
          This employee has been archived. They cannot log in and have been removed from all client leads and task assignments.
        </div>
      )}

      {/* Archive confirmation dialog */}
      {showArchiveDialog && archiveImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowArchiveDialog(false)} />
          <div
            className="relative rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                  color: "var(--danger)",
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <h3 className="typo-modal-title" style={{ color: "var(--text-primary)" }}>
                Archive {employee.name}?
              </h3>
            </div>

            <div className="space-y-2 mb-4">
              {archiveImpact.clientLeadCount > 0 && (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  Lead on <strong>{archiveImpact.clientLeadCount}</strong> client{archiveImpact.clientLeadCount !== 1 ? "s" : ""}
                  {archiveImpact.clientNames.length <= 5 && (
                    <span style={{ color: "var(--text-muted)" }}>
                      {" "}({archiveImpact.clientNames.join(", ")})
                    </span>
                  )}
                </p>
              )}
              {archiveImpact.openTaskCount > 0 && (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  Assigned to <strong>{archiveImpact.openTaskCount}</strong> open task{archiveImpact.openTaskCount !== 1 ? "s" : ""}
                </p>
              )}
              {archiveImpact.futureTimeOffCount > 0 && (
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <strong>{archiveImpact.futureTimeOffCount}</strong> future time-off entr{archiveImpact.futureTimeOffCount !== 1 ? "ies" : "y"} will be canceled
                </p>
              )}
              {archiveImpact.clientLeadCount === 0 && archiveImpact.openTaskCount === 0 && archiveImpact.futureTimeOffCount === 0 && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No active assignments found.
                </p>
              )}
            </div>

            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              They will be removed from all client leads and task assignments. Historical records (logs, activity) will be preserved. They will no longer be able to log in.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowArchiveDialog(false)}
                className="btn-ghost text-sm px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={archiving}
                className="btn-danger text-sm px-4 py-2 rounded-lg"
              >
                {archiving ? "Archiving\u2026" : "Archive Employee"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-7 max-w-2xl space-y-1">
        {activeTab === "identity" && (
          <>
            {/* Google info banner */}
            {employee.googleName && (
              <div
                className="rounded-lg px-4 py-3 flex items-center gap-3 text-sm mb-4"
                style={{
                  background: "var(--bg-hover)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {employee.googleImage && (
                  <Image
                    src={employee.googleImage}
                    alt="Google profile"
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                )}
                <span>
                  Google account: <strong style={{ color: "var(--text-primary)" }}>{employee.googleName}</strong>
                  {" "}({employee.email})
                </span>
              </div>
            )}

            {/* Display Identity */}
            <SectionHeading>Display Identity</SectionHeading>
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <div
                  className="shrink-0 w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg font-semibold text-white"
                  style={{ background: "var(--primary)" }}
                >
                  {avatarSrc ? (
                    <Image src={avatarSrc} alt={employee.name} width={64} height={64} className="object-cover" />
                  ) : (
                    employee.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <Field label="Display name" hint="Overrides the Google name everywhere in the app">
                    <TextInput value={displayName} onChange={setDisplayName} placeholder={employee.googleName ?? "Display name"} />
                  </Field>
                  <Field label="Display avatar URL" hint="Overrides the Google profile picture">
                    <TextInput value={displayImage} onChange={setDisplayImage} placeholder="https://..." />
                  </Field>
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <SectionHeading>Personal Details</SectionHeading>
            <div className="grid grid-cols-3 gap-3">
              <Field label="First name">
                <TextInput value={firstName} onChange={setFirstName} placeholder="First name" />
              </Field>
              <Field label="Preposition">
                <TextInput value={preposition} onChange={setPreposition} placeholder="van, de, etc." />
              </Field>
              <Field label="Last name">
                <TextInput value={lastName} onChange={setLastName} placeholder="Last name" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Date of birth">
                <TextInput type="date" value={dateOfBirth} onChange={setDateOfBirth} />
              </Field>
              <Field label="Phone">
                <TextInput value={phone} onChange={setPhone} placeholder="+31 6 12345678" />
              </Field>
            </div>

            {/* Emergency Contact */}
            <SectionHeading>Emergency Contact</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact name">
                <TextInput value={emergencyContactName} onChange={setEmergencyContactName} placeholder="Full name" />
              </Field>
              <Field label="Contact phone">
                <TextInput value={emergencyContactPhone} onChange={setEmergencyContactPhone} placeholder="+31 6 12345678" />
              </Field>
            </div>
          </>
        )}

        {activeTab === "employment" && (
          <>
            <SectionHeading>Employment</SectionHeading>
            <Field label="Job title" hint="Shown publicly (e.g. in email signatures)">
              <TextInput value={jobTitle} onChange={setJobTitle} placeholder="Design & Experience Lead" />
            </Field>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Employee number">
                <TextInput value={employeeNumber} onChange={setEmployeeNumber} placeholder="EMP-001" />
              </Field>
              <Field label="Date started">
                <TextInput type="date" value={dateStarted} onChange={setDateStarted} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Contract type">
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">Not set</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="freelance">Freelance</option>
                </select>
              </Field>
              <Field label="Contract hours" hint="Per week">
                <NumberInput value={contractHours} onChange={setContractHours} placeholder="40" />
              </Field>
              <Field label="Vacation days" hint="Per year">
                <NumberInput value={vacationDays} onChange={setVacationDays} placeholder="25" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Field label="Contract end date" hint="Leave empty for indefinite">
                <TextInput type="date" value={contractEndDate} onChange={setContractEndDate} />
              </Field>
            </div>
          </>
        )}

        {activeTab === "access" && (
          <>
            <SectionHeading>System Access</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={isCurrentUser}
                  className="w-full text-sm px-3 py-2 rounded-lg disabled:opacity-50"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                >
                  {roleOptions.length > 0
                    ? roleOptions.map((r) => (
                        <option key={r.slug} value={r.slug}>{r.name}</option>
                      ))
                    : <>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </>
                  }
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isCurrentUser}
                  className="w-full text-sm px-3 py-2 rounded-lg disabled:opacity-50"
                  style={{
                    border: "1px solid var(--border)",
                    background: "var(--bg-input)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="invited">Invited</option>
                  <option value="active">Active</option>
                </select>
              </Field>
            </div>
            {isCurrentUser && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                You cannot change your own role or status.
              </p>
            )}
          </>
        )}

        {activeTab === "notes" && (
          <>
            <SectionHeading>Notes</SectionHeading>
            <Field label="Admin notes" hint="Only visible to admins">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes about this employee..."
                rows={3}
                className="w-full text-sm px-3 py-2 rounded-lg resize-y"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
              />
            </Field>

            {/* Meta info */}
            <div className="mt-8 pt-4 text-xs space-y-1" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
              <p>Email: {employee.email}</p>
              {employee.invitedAt && <p>Invited: {new Date(employee.invitedAt).toLocaleDateString()}</p>}
              <p>Created: {new Date(employee.createdAt).toLocaleDateString()}</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
