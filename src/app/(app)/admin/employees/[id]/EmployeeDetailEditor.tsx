"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PageHeader from "@/components/layout/PageHeader";
import { Save } from "lucide-react";

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
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notes: string;
  invitedAt: string | null;
  createdAt: string;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-sm font-semibold uppercase tracking-wide mb-3 mt-8 first:mt-0"
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
}: {
  employee: EmployeeData;
  isCurrentUser: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
  const [phone, setPhone] = useState(employee.phone);
  const [emergencyContactName, setEmergencyContactName] = useState(employee.emergencyContactName);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(employee.emergencyContactPhone);
  const [notes, setNotes] = useState(employee.notes);
  const [role, setRole] = useState(employee.role);
  const [status, setStatus] = useState(employee.status);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);

    const res = await fetch(`/api/users/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: displayName || null,
        displayImage: displayImage || null,
        firstName: firstName || null,
        preposition: preposition || null,
        lastName: lastName || null,
        dateOfBirth: dateOfBirth || null,
        dateStarted: dateStarted || null,
        employeeNumber: employeeNumber || null,
        vacationDays,
        contractType: contractType || null,
        contractHours,
        contractEndDate: contractEndDate || null,
        phone: phone || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        notes: notes || null,
        role,
        status,
      }),
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

  const avatarSrc = displayImage || employee.googleImage || employee.image;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Employees", href: "/admin?tab=users" },
          { label: "..." },
        ]}
        title={employee.name}
        actions={
          <div className="flex items-center gap-2">
            {success && (
              <span className="text-sm" style={{ color: "var(--success, #16a34a)" }}>Saved</span>
            )}
            {error && (
              <span className="text-sm" style={{ color: "var(--danger, #dc2626)" }}>{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Save size={14} />
              {saving ? "Saving\u2026" : "Save Changes"}
            </button>
          </div>
        }
      />

      <div className="p-7 max-w-2xl space-y-1">
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

        {/* Identity */}
        <SectionHeading>Display Identity</SectionHeading>
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            {/* Avatar preview */}
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

        {/* Personal */}
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

        {/* Employment */}
        <SectionHeading>Employment</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
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

        {/* Access */}
        <SectionHeading>Access</SectionHeading>
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
              <option value="member">Member</option>
              <option value="admin">Admin</option>
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
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        {isCurrentUser && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            You cannot change your own role or status.
          </p>
        )}

        {/* Notes */}
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
      </div>
    </>
  );
}
