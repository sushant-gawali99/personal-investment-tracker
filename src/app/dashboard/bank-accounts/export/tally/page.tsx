import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import { redirect } from "next/navigation";
import { TallyExportClient } from "./tally-export-client";

export default async function TallyExportPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [accounts, categories] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { userId, disabled: false },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
    prisma.transactionCategory.findMany({
      where: { OR: [{ userId }, { userId: null }], disabled: false },
      select: { id: true, name: true, kind: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <TallyExportClient accounts={accounts} categories={categories} />;
}
