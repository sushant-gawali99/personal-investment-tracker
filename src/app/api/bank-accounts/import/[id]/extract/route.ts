import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { extractTransactions } from "@/lib/bank-accounts/extract-transactions";
import { categorizeRows } from "@/lib/bank-accounts/categorize";
import { markDuplicates } from "@/lib/bank-accounts/dedup";
import { normalizeDescription } from "@/lib/bank-accounts/normalize-description";
import { commitImport } from "@/lib/bank-accounts/commit-import";
import type { StagedTxn, CategoryLite } from "@/lib/bank-accounts/types";

function resolveLocalPath(fileUrl: string): string {
  const name = fileUrl.replace("/api/bank-accounts/import/file/", "");
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements", name)
    : path.join(process.cwd(), "public", "uploads", "bank-statements", name);
}

/**
 * Runs the full extract → categorize → dedup pipeline in the background.
 * Must never throw — catches all errors and persists them as status=failed.
 */
async function runExtraction(importId: string, userId: string, pdfPassword?: string): Promise<void> {
  const started = Date.now();
  try {
    const imp = await prisma.statementImport.findFirst({ where: { id: importId, userId } });
    if (!imp) return;

    const bytes = await readFile(resolveLocalPath(imp.fileUrl));

    const categories = await prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
    });
    const categoryNames = categories.map((c) => c.name);
    const categoriesByName = new Map<string, CategoryLite>(
      categories.map((c) => [c.name, { id: c.id, name: c.name, kind: c.kind as CategoryLite["kind"], userId: c.userId }]),
    );

    const extraction = await extractTransactions(Buffer.from(bytes), categoryNames, pdfPassword);

    const rules = await prisma.merchantRule.findMany({
      // Include system-wide rules (userId=null) so newly-seeded users
      // benefit from the shared starter set on their very first import.
      where: { OR: [{ userId: null }, { userId }] },
      select: { id: true, pattern: true, categoryId: true },
    });

    let staged: StagedTxn[] = categorizeRows(extraction.transactions, rules, categoriesByName);

    const existing = await prisma.transaction.findMany({
      where: { userId, accountId: imp.accountId },
      select: { id: true, bankRef: true, txnDate: true, amount: true, normalizedDescription: true },
    });
    const existingForDedup = existing.map((e) => ({
      id: e.id,
      bankRef: e.bankRef,
      txnDate: e.txnDate.toISOString().slice(0, 10),
      amount: e.amount,
      normalizedDescription: e.normalizedDescription,
    }));
    const withDupes = markDuplicates(
      staged.map((s) => ({
        ...s,
        bankRef: s.bankRef,
        txnDate: s.txnDate,
        amount: s.amount,
        normalizedDescription: s.normalizedDescription,
      })),
      existingForDedup,
    );
    staged = staged.map((s, i) => ({
      ...s,
      normalizedDescription: normalizeDescription(s.description),
      isDuplicate: withDupes[i].isDuplicate,
      duplicateOfId: withDupes[i].duplicateOfId,
      skip: withDupes[i].isDuplicate,
    }));

    const dupCount = staged.filter((s) => s.isDuplicate).length;
    const newCount = staged.length - dupCount;

    await prisma.statementImport.update({
      where: { id: importId },
      data: {
        status: "preview",
        statementPeriodStart: extraction.statementPeriodStart ? new Date(extraction.statementPeriodStart) : null,
        statementPeriodEnd: extraction.statementPeriodEnd ? new Date(extraction.statementPeriodEnd) : null,
        extractedCount: staged.length,
        newCount,
        duplicateCount: dupCount,
        claudeInputTokens: extraction.inputTokens,
        claudeOutputTokens: extraction.outputTokens,
        claudeCostUsd: extraction.costUsd,
        stagedTransactions: JSON.stringify(staged),
      },
    });
    console.log(`[extract] import ${importId} extracted in ${Date.now() - started}ms, auto-committing…`);

    // Auto-commit: persist non-duplicate, non-skipped rows immediately. Transitions
    // status preview → saved. User can still re-categorise rows from the
    // transactions list afterwards.
    const commitResult = await commitImport(importId, userId, staged);
    console.log(
      `[extract] import ${importId} committed: ${commitResult.inserted} inserted, ${commitResult.transfersDetected} transfer pairs, total ${Date.now() - started}ms`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`[extract] import ${importId} FAILED after ${Date.now() - started}ms: ${msg}`);
    try {
      await prisma.statementImport.update({
        where: { id: importId },
        data: { status: "failed", errorMessage: msg },
      });
    } catch {
      /* DB write failed — nothing more we can do */
    }
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let pdfPassword: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { password?: string } | null;
    const pw = body?.password?.trim();
    if (pw) pdfPassword = pw;
  } catch {
    /* no body — extraction proceeds without a password */
  }

  // Guard against double-starts: only kick off if pending or previously failed.
  if (imp.status === "extracting") {
    return NextResponse.json({ importId: id, status: "extracting", alreadyRunning: true }, { status: 202 });
  }

  await prisma.statementImport.update({
    where: { id },
    data: { status: "extracting", errorMessage: null },
  });

  // Fire-and-forget. Works in both `next dev` and long-running Node (Railway).
  // Would need a queue (BullMQ, etc.) to work on serverless platforms.
  void runExtraction(id, userId, pdfPassword);

  return NextResponse.json({ importId: id, status: "extracting" }, { status: 202 });
}
