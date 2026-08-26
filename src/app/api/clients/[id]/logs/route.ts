import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/auth-helpers";
import { connectDB } from "@/lib/mongodb";
import { LogModel } from "@/lib/models/Log";
import { createLogEntry, serializeLog } from "@/lib/logs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: clientId } = await params;
  await connectDB();
  const docs = await LogModel.find({ clientId }).sort({ date: -1, createdAt: -1 }).lean();
  return NextResponse.json(docs.map(serializeLog));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, "logs.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const body = await req.json();

  // Validation, the derived follow-up task and the activity event all live in
  // createLogEntry so the MCP tool gets identical behaviour.
  const result = await createLogEntry(session, clientId, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.log, { status: 201 });
}
