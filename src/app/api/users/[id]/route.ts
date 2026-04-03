import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const user = await UserModel.findById(id).lean();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
    isAdmin: user.isAdmin,
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
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  await connectDB();

  // Load the current user to merge for computed fields
  const existing = await UserModel.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Prevent self-demotion
  if (id === session.user.id && body.role === "member" && existing.role === "admin") {
    return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 });
  }

  // Allowed fields for update
  const allowedFields = [
    "displayName", "displayImage",
    "firstName", "preposition", "lastName",
    "dateOfBirth", "dateStarted", "employeeNumber",
    "vacationDays", "contractType", "contractHours", "contractEndDate",
    "phone", "emergencyContactName", "emergencyContactPhone",
    "notes", "role", "status",
  ];

  const setFields: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      setFields[field] = body[field];
    }
  }

  // Handle legacy isAdmin toggle (backward compat)
  if ("isAdmin" in body && !("role" in body)) {
    setFields.role = body.isAdmin ? "admin" : "member";
  }

  // Recompute name/image/isAdmin from merged state
  const merged = { ...existing.toObject(), ...setFields };
  const structuredName = [merged.firstName, merged.preposition, merged.lastName].filter(Boolean).join(" ");
  setFields.name = merged.displayName ?? merged.googleName ?? (structuredName || merged.email);
  setFields.image = merged.displayImage ?? merged.googleImage ?? undefined;
  setFields.isAdmin = (setFields.role ?? merged.role) === "admin";

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
    isAdmin: user.isAdmin,
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
