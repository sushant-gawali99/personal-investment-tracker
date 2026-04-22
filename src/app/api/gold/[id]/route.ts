import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "public", "uploads", "gold");

async function findOwned(id: string, userId: string) {
  const item = await prisma.goldItem.findFirst({ where: { id, userId } });
  return item;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const item = await findOwned(id, auth);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await findOwned(id, auth);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.title != null) {
    if (!body.title || typeof body.title !== "string") return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    data.title = body.title.trim().slice(0, 200);
  }
  if (body.weightGrams != null) {
    const w = Number(body.weightGrams);
    if (!(w > 0)) return NextResponse.json({ error: "Invalid weight" }, { status: 400 });
    data.weightGrams = w;
  }
  if (body.karat != null) {
    const k = Number(body.karat);
    if (![24, 22, 18, 14].includes(k)) return NextResponse.json({ error: "Invalid karat" }, { status: 400 });
    data.karat = k;
  }
  if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl || null;
  if (body.purchasedOn !== undefined) data.purchasedOn = body.purchasedOn ? new Date(body.purchasedOn) : null;
  if (body.purchasedFrom !== undefined) data.purchasedFrom = body.purchasedFrom ? String(body.purchasedFrom).trim().slice(0, 200) : null;
  if (body.purchasePrice !== undefined) data.purchasePrice = body.purchasePrice != null && body.purchasePrice !== "" ? Number(body.purchasePrice) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.disabled !== undefined) data.disabled = Boolean(body.disabled);

  const item = await prisma.goldItem.update({ where: { id }, data });

  if (body.photoUrl !== undefined && existing.photoUrl && existing.photoUrl !== item.photoUrl) {
    const filename = existing.photoUrl.split("/").pop();
    if (filename) await unlink(join(UPLOAD_DIR, filename)).catch(() => {});
  }

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const existing = await findOwned(id, auth);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goldItem.delete({ where: { id } });

  if (existing.photoUrl) {
    const filename = existing.photoUrl.split("/").pop();
    if (filename) await unlink(join(UPLOAD_DIR, filename)).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
