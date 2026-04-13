import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { requirePermission } from "@/lib/auth-helpers";

export async function GET() {
  const session = await auth();
  const forbidden = requirePermission(session, "employees.view");
  if (forbidden) return forbidden;

  await connectDB();
  const users = await UserModel.find().sort({ createdAt: 1 }).lean();

  return NextResponse.json(
    users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role ?? "member",
      status: u.status ?? "active",
      firstName: u.firstName,
      preposition: u.preposition,
      lastName: u.lastName,
      employeeNumber: u.employeeNumber,
      dateStarted: u.dateStarted,
      phone: u.phone,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const forbidden = requirePermission(session, "employees.invite");
  if (forbidden) return forbidden;

  const body = await req.json();
  const { email, firstName, preposition, lastName, role, displayName } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  await connectDB();

  // Check if email already exists
  const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 });
  }

  // Build the name for the computed field
  const nameParts = [firstName, preposition, lastName].filter(Boolean);
  const computedName = displayName ?? (nameParts.length > 0 ? nameParts.join(" ") : email);

  const user = await UserModel.create({
    email: email.toLowerCase().trim(),
    firstName: firstName || undefined,
    preposition: preposition || undefined,
    lastName: lastName || undefined,
    displayName: displayName || undefined,
    role: role || "member",
    status: "invited",
    invitedBy: session.user.id,
    invitedAt: new Date(),
    name: computedName,
  });

  return NextResponse.json(
    {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.firstName,
      preposition: user.preposition,
      lastName: user.lastName,
    },
    { status: 201 }
  );
}
