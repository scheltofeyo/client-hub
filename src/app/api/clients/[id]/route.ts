import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectModel } from "@/lib/models/Project";
import { TaskModel } from "@/lib/models/Task";
import { LogModel } from "@/lib/models/Log";
import { ClientEventModel } from "@/lib/models/ClientEvent";
import { SheetModel } from "@/lib/models/Sheet";
import { ActivityEventModel } from "@/lib/models/ActivityEvent";
import { SalesCardModel } from "@/lib/models/SalesCard";
import { requirePermission } from "@/lib/auth-helpers";
import { updateClient } from "@/lib/clients";
import type { IClient } from "@/lib/models/Client";

/** Structural type so both lean results and hydrated docs fit. */
type SerializableClient = Pick<
  IClient,
  | "company"
  | "status"
  | "platform"
  | "clientSince"
  | "employees"
  | "website"
  | "description"
  | "primaryColor"
  | "contacts"
  | "leads"
  | "culturalDna"
  | "culturalLevels"
  | "addressStreet"
  | "addressPostalCode"
  | "addressCity"
  | "addressCountry"
> & { _id: { toString(): string } };

/** The editable shape of a client, as the side-panel client editor reads it. */
function serializeClient(doc: SerializableClient) {
  return {
    id: doc._id.toString(),
    company: doc.company,
    status: doc.status,
    platform: doc.platform,
    clientSince: doc.clientSince,
    employees: doc.employees,
    website: doc.website,
    description: doc.description,
    primaryColor: doc.primaryColor ?? undefined,
    contacts: doc.contacts ?? [],
    leads: doc.leads ?? [],
    culturalDna: doc.culturalDna ?? [],
    culturalLevels: doc.culturalLevels ?? [],
    addressStreet: doc.addressStreet ?? null,
    addressPostalCode: doc.addressPostalCode ?? null,
    addressCity: doc.addressCity ?? null,
    addressCountry: doc.addressCountry ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const doc = await ClientModel.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(serializeClient(doc));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // The whole handler lives in updateClient(): the lead-aware permission
  // check, the field handling and the granular activity events. The MCP tools
  // call the same function, so the two surfaces cannot drift on what updating
  // a client means.
  const result = await updateClient(session, id, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(serializeClient(result.client));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const forbidden = requirePermission(session, "clients.delete");
  if (forbidden) return forbidden;

  const { id } = await params;
  await connectDB();
  const doc = await ClientModel.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all([
    ProjectModel.deleteMany({ clientId: id }),
    TaskModel.deleteMany({ clientId: id }),
    LogModel.deleteMany({ clientId: id }),
    ClientEventModel.deleteMany({ clientId: id }),
    SheetModel.deleteMany({ clientId: id }),
    ActivityEventModel.deleteMany({ clientId: id }),
    // Without this the client's cards linger on every board as "Onbekende prospect".
    SalesCardModel.deleteMany({ clientId: id }),
  ]);

  return NextResponse.json({ success: true });
}
