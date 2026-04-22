import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { extractTransactions } from "@/lib/bank-accounts/extract-transactions";
import { categorizeRows } from "@/lib/bank-accounts/categorize";
import { markDuplicates } from "@/lib/bank-accounts/dedup";
import { normalizeDescription } from "@/lib/bank-accounts/normalize-description";
import type { StagedTxn, CategoryLite } from "@/lib/bank-accounts/types";

function resolveLocalPath(fileUrl: string): string {
  const name = fileUrl.replace("/api/bank-accounts/import/file/", "");
  return process.env.UPLOAD_DIR
    ? path.join(process.env.UPLOAD_DIR, "bank-statements", name)
    : path.join(process.cwd(), "public", "uploads", "bank-statements", name);
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const imp = await prisma.statementImport.findFirst({ where: { id, userId } });
  if (!imp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.statementImport.update({ where: { id }, data: { status: "extracting", errorMessage: null } });

  try {
    const bytes = await readFile(resolveLocalPath(imp.fileUrl));

    const categories = await prisma.transactionCategory.findMany({
      where: { OR: [{ userId: null }, { userId }], disabled: false },
    });
    const categoryNames = categories.map((c) => c.name);
    const categoriesByName = new Map<string, CategoryLite>(
      categories.map((c) => [c.name, { id: c.id, name: c.name, kind: c.kind as CategoryLite["kind"], userId: c.userId }]),
    );

    const extraction = await extractTransactions(Buffer.from(bytes), categoryNames);

    const rules = await prisma.merchantRule.findMany({
      where: { userId },
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

    const updated = await prisma.statementImport.update({
      where: { id },
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
    return NextResponse.json({ importId: updated.id, staged, newCount, duplicateCount: dupCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.statementImport.update({
      where: { id },
      data: { status: "failed", errorMessage: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
