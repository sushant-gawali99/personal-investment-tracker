import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { commitImport } from "@/lib/bank-accounts/commit-import";
import type { StagedTxn } from "@/lib/bank-accounts/types";

interface CommitBody {
  txns: StagedTxn[];
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as CommitBody;
  try {
    const result = await commitImport(id, userId, body.txns);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
