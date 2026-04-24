import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { parseNJIndiaPdf } from "@/lib/nj-india/parse-statement";

const MAX_BYTES = 5 * 1024 * 1024;

function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "nj-india")
    : path.join(process.cwd(), "public", "uploads", "nj-india");
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF exceeds 5 MB" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseNJIndiaPdf(bytes);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Parse failed" }, { status: 400 });
  }

  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(10).toString("hex")}.pdf`;
  await writeFile(path.join(dir, name), bytes);
  const fileUrl = `/api/nj-india/file/${name}`;

  const stmt = await prisma.nJIndiaStatement.create({
    data: {
      userId,
      fileUrl,
      fileName: file.name,
      reportDate: parsed.reportDate,
      totalInvested: parsed.totalInvested,
      totalCurrentValue: parsed.totalCurrentValue,
      totalGainLoss: parsed.totalGainLoss,
      weightedReturnPct: parsed.weightedReturnPct,
      absoluteReturnPct: parsed.absoluteReturnPct,
      schemeCount: parsed.schemes.length,
      schemesJson: JSON.stringify(parsed.schemes),
      investorName: parsed.investorName,
    },
  });

  return NextResponse.json({
    id: stmt.id,
    reportDate: stmt.reportDate,
    schemeCount: stmt.schemeCount,
    totalCurrentValue: stmt.totalCurrentValue,
  }, { status: 201 });
}
