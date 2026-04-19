"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function FDDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this FD record? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/fd/${id}`, { method: "DELETE" });
      router.push("/dashboard/fd");
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#fdecea] text-[#c13515] hover:bg-[#fcdcd7] text-[14px] font-medium transition-colors disabled:opacity-40"
    >
      <Trash2 size={12} />
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
