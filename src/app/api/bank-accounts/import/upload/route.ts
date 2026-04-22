import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const accountId = (form.get("accountId") as string | null)?.trim();
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "PDF exceeds 5 MB" }, { status: 400 });

  const account = await prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const uploadDir = process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements")
    : path.join(process.cwd(), "public", "uploads", "bank-statements");
  await mkdir(uploadDir, { recursive: true });
  const name = `${randomBytes(10).toString("hex")}.pdf`;
  await writeFile(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));
  const fileUrl = `/api/bank-accounts/import/file/${name}`;

  const imp = await prisma.statementImport.create({
    data: {
      userId,
      accountId,
      fileUrl,
      fileName: file.name,
      status: "pending",
    },
  });
  return NextResponse.json({ importId: imp.id, fileUrl, fileName: file.name }, { status: 201 });
}
