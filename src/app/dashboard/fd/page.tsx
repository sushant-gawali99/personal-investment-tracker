import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FDList } from "./fd-list";
import { getSessionUserId } from "@/lib/session";

export default async function FDPage() {
  const userId = await getSessionUserId();
  const fds = await prisma.fixedDeposit.findMany({
    where: { userId: userId ?? "" },
    orderBy: { maturityDate: "asc" },
    include: { renewals: { orderBy: { renewalNumber: "asc" } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Fixed Deposits</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Track and analyse your fixed deposit investments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/fd/bulk"
            className="ab-btn ab-btn-ghost relative"
            style={{ borderColor: "#ff385c", border: "1px solid #ff385c", color: "#ff385c" }}
          >
            <Upload size={15} />
            Bulk Upload
            <span
              className="ab-chip ab-chip-accent"
              style={{ fontSize: "10px", padding: "2px 6px", marginLeft: "4px" }}
            >
              New
            </span>
          </Link>
          <Link
            href="/dashboard/fd/new"
            className="ab-btn ab-btn-accent"
          >
            <Plus size={15} />
            Add FD
          </Link>
        </div>
      </div>

      <FDList fds={fds} />
    </div>
  );
}
