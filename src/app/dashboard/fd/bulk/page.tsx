import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUserId } from "@/lib/session";
import { BulkUploadForm } from "./bulk-upload-form";

export default async function BulkUploadPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/api/auth/signin");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/fd"
          className="text-[13px] text-[#a0a0a5] hover:text-[#ededed] inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to FDs
        </Link>
        <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight mt-2">
          Bulk Upload FDs
        </h1>
        <p className="text-[14px] text-[#a0a0a5] mt-1">
          Drop up to 20 files — PDFs, images, or a .zip. Each file becomes one FD.
        </p>
      </div>
      <BulkUploadForm />
    </div>
  );
}
