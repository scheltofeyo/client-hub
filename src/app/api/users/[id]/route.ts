import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { hasPermission } from "@/lib/auth-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isSelf = id === session.user.id;

  if (!hasPermission(session, "employees.view") && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await connectDB();

  const user = await UserModel.findById(id).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role ?? "member",
    status: user.status ?? "active",
    googleName: user.googleName,
    googleImage: user.googleImage,
    displayName: user.displayName,
    displayImage: user.displayImage,
    firstName: user.firstName,
    preposition: user.preposition,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    dateStarted: user.dateStarted,
    employeeNumber: user.employeeNumber,
    vacationDays: user.vacationDays,
    contractType: user.contractType,
    contractHours: user.contractHours,
    contractEndDate: user.contractEndDate,
    phone: user.phone,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    notes: user.notes,
    invitedAt: user.invitedAt,
    createdAt: user.createdAt,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const isSelf = id === session.user.id;
  const hasEmployeeEdit = hasPermission(session, "employees.edit");

  if (!hasEmployeeEdit && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  await connectDB();

  // Load the current user to merge for computed fields
  const existing = await UserModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent self-demotion (changing your own role)
  if (isSelf && body.role !== undefined && body.role !== existing.role) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  // Personal fields (self-editable with profile.editOwn)
  const PERSONAL_FIELDS = [
    "displayName", "displayImage",
    "firstName", "preposition", "lastName",
    "dateOfBirth", "phone",
    "emergencyContactName", "emergencyContactPhone",
  ];

  // All fields (requires employees.edit)
  const ALL_EDITABLE_FIELDS = [
    ...PERSONAL_FIELDS,
    "dateStarted", "employeeNumber",
    "vacationDays", "contractType", "contractHours", "contractEndDate",
    "notes", "role", "status",
  ];

  const allowedFields = hasEmployeeEdit ? ALL_EDITABLE_FIELDS : PERSONAL_FIELDS;

  const setFields: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      setFields[field] = body[field];
    }
  }

  // Recompute name/image from merged state
  const merged = { ...existing.toObject(), ...setFields };
  const structuredName = [merged.firstName, merged.preposition, merged.lastName].filter(Boolean).join(" ");
  setFields.name = merged.displayName ?? merged.googleName ?? (structuredName || merged.email);
  setFields.image = merged.displayImage ?? merged.googleImage ?? undefined;

  const user = await UserModel.findByIdAndUpdate(
    id,
    { $set: setFields },
    { new: true }
  ).lean();

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role ?? "member",
    status: user.status ?? "active",
    displayName: user.displayName,
    displayImage: user.displayImage,
    firstName: user.firstName,
    preposition: user.preposition,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    dateStarted: user.dateStarted,
    employeeNumber: user.employeeNumber,
    vacationDays: user.vacationDays,
    contractType: user.contractType,
    contractHours: user.contractHours,
    contractEndDate: user.contractEndDate,
    phone: user.phone,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    notes: user.notes,
  });
}
