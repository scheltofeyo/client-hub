import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { ClientModel } from "@/lib/models/Client";
import { ProjectPlanModel } from "@/lib/models/ProjectPlan";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function resolveChromiumExecutable(): Promise<string | undefined> {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return process.env.CHROMIUM_EXECUTABLE_PATH;
  if (process.env.NODE_ENV === "production") return await chromium.executablePath();
  const fs = await import("node:fs/promises");
  for (const p of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ]) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // try next
    }
  }
  return undefined;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  const { shareCode } = await params;
  await connectDB();

  const plan = await ProjectPlanModel.findOne({ shareCode }).lean();
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.status === "archived" || plan.status === "draft") {
    return NextResponse.json({ error: "This proposal is not available for download" }, { status: 400 });
  }

  const client = await ClientModel.findById(plan.clientId, { _id: 1, company: 1 }).lean();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const baseUrl = req.nextUrl.origin;
  const proposalUrl = `${baseUrl}/proposal/${shareCode}/pdf`;

  const executablePath = await resolveChromiumExecutable();
  if (!executablePath) {
    return NextResponse.json(
      {
        error:
          "No Chromium executable found. Set CHROMIUM_EXECUTABLE_PATH to a local Chrome binary, or deploy where @sparticuz/chromium runs.",
      },
      { status: 500 }
    );
  }

  let pdfBuffer: Buffer;
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const browser = await playwright.launch({
      args: isProduction ? chromium.args : ["--no-sandbox"],
      executablePath,
      headless: true,
    });
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
      await page.goto(proposalUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.emulateMedia({ media: "print" });

      const titleEsc = plan.title.replace(/"/g, "&quot;");
      const companyEsc = client.company.replace(/"/g, "&quot;");
      // Headers/footers render in a separate Chromium context — no inheritance from page CSS.
      // Set font-family + font-size explicitly so they match the body's Ubuntu Sans look.
      const headerFooterFont = `font-family: "Ubuntu", "Ubuntu Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;`;
      const headerTemplate = `
        <div style="width:100%; font-size:10px; color:#666; padding:0 15mm; display:flex; justify-content:space-between; -webkit-print-color-adjust:exact; ${headerFooterFont}">
          <span style="font-weight:600; letter-spacing:0.16em; text-transform:uppercase;">SUMM</span>
          <span style="opacity:0.7;">${titleEsc}</span>
        </div>`;
      const footerTemplate = `
        <div style="width:100%; font-size:10px; color:#666; padding:0 15mm; display:flex; justify-content:space-between; -webkit-print-color-adjust:exact; ${headerFooterFont}">
          <span style="opacity:0.7;">Confidential — Prepared for ${companyEsc}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`;

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "22mm", bottom: "20mm", left: "15mm", right: "15mm" },
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
      });
      pdfBuffer = pdf;
    } finally {
      await browser.close();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to render PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const filename = `${slugify(client.company)}-${slugify(plan.title) || "proposal"}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
