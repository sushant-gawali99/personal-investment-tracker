import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const VALID_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 5 MB" }, { status: 400 });
  if (!VALID_TYPES.includes(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] || "bin");
  const name = `${randomBytes(10).toString("hex")}.${ext}`;
  const dir = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "fd");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);

  const url = ext === "pdf" ? `/api/fd/file/${name}` : `/api/fd/image/${name}`;
  return NextResponse.json({ url });
}
