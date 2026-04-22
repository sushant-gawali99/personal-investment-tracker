import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseStatementPdf } from "@/lib/fd-statement/parse-pdf";
import { matchFd } from "@/lib/fd-statement/match";
import type { MatchCandidate } from "@/lib/fd-statement/types";

export async function POST(req: NextRequest) {
  const result = await requireUserId();
  if (result instanceof NextResponse) return result;
  const userId = result;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const bankName = (form.get("bankName") as string | null)?.trim();
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!bankName) return NextResponse.json({ error: "Bank required" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF exceeds 10 MB" }, { status: 400 });
  if (file.type !== "application/pdf") return NextResponse.json({ error: "PDF only" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const { txns, parseMethod } = await parseStatementPdf(bytes);
  if (txns.length === 0) {
    return NextResponse.json({ error: "Could not parse statement; please check format" }, { status: 422 });
  }

  const fds = await prisma.fixedDeposit.findMany({
    where: { userId, bankName },
    select: { id: true, fdNumber: true, accountNumber: true, maturityDate: true, principal: true },
  });
  const candidates: MatchCandidate[] = fds.map((f) => ({
    fdId: f.id,
    fdNumber: f.fdNumber,
    accountNumber: f.accountNumber,
    label: `${f.fdNumber ?? f.accountNumber ?? "FD"} — ₹${f.principal}`,
    maturityDate: f.maturityDate.toISOString().slice(0, 10),
  }));

  const enriched = txns.map((t) => {
    const m = matchFd(t.detectedFdNumber, candidates);
    const matchedFd = m.kind === "matched" ? candidates.find((c) => c.fdId === m.fdId) : null;
    let type = t.type;
    if (type === "maturity" && matchedFd && t.txnDate < matchedFd.maturityDate) {
      type = "premature_close";
    }
    return {
      ...t,
      type,
      match: m,
      suggestedFdId: m.kind === "matched" ? m.fdId : null,
    };
  });

  const matchedCount = enriched.filter((t) => t.suggestedFdId).length;
  const dates = txns.map((t) => t.txnDate).sort();
  return NextResponse.json({
    parseMethod,
    fromDate: dates[0],
    toDate: dates[dates.length - 1],
    txnCount: txns.length,
    matchedCount,
    candidates,
    txns: enriched,
  });
}
