import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SheetModel } from "@/lib/models/Sheet";
import { ClientModel } from "@/lib/models/Client";

const SHEET_ORDER = ["Content", "Client", "Job profiles", "Onboarding"];

function processSheets(sheets: { name: string; url: string }[]) {
  return sheets
    .filter((s) => !s.name.toLowerCase().includes("translation"))
    .sort((a, b) => {
      const ai = SHEET_ORDER.findIndex((n) => a.name.toLowerCase().includes(n.toLowerCase()));
      const bi = SHEET_ORDER.findIndex((n) => b.name.toLowerCase().includes(n.toLowerCase()));
      const aOrder = ai === -1 ? SHEET_ORDER.length : ai;
      const bOrder = bi === -1 ? SHEET_ORDER.length : bi;
      return aOrder - bOrder;
    });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.secret || body.secret !== process.env.GAS_FOLDER_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (!body.clientId || !Array.isArray(body.sheets)) {
    return NextResponse.json({ ok: false, error: "clientId and sheets are required" }, { status: 400 });
  }

  const sheets = processSheets(body.sheets);

  await connectDB();
  await Promise.all([
    ...sheets.map((s: { name: string; url: string }) =>
      SheetModel.create({ clientId: body.clientId, name: s.name, url: s.url })
    ),
    ClientModel.findByIdAndUpdate(body.clientId, { folderStatus: "ready" }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}
