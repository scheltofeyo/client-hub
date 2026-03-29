import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SheetModel } from "@/lib/models/Sheet";
import { ClientModel } from "@/lib/models/Client";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.secret || body.secret !== process.env.GAS_FOLDER_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!body.clientId || !Array.isArray(body.sheets)) {
    return NextResponse.json({ ok: false, error: "clientId and sheets are required" }, { status: 400 });
  }

  await connectDB();
  await Promise.all([
    ...body.sheets.map((s: { name: string; url: string }) =>
      SheetModel.create({ clientId: body.clientId, name: s.name, url: s.url })
    ),
    ClientModel.findByIdAndUpdate(body.clientId, { folderStatus: "ready" }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
