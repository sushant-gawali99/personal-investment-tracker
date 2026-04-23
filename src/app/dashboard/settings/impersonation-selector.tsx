"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  isSuperAdmin: boolean;
  activeUserId: string | null;
}

export function ImpersonationSelector({ isSuperAdmin, activeUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then(({ users }) => setUsers(users))
      .finally(() => setLoading(false));
  }, []);

  if (!isSuperAdmin) return null;

  async function handleSelect(userId: string | null) {
    if (userId === null) return;
    if (userId === "__self__") return handleStop();
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.refresh();
  }

  async function handleStop() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.refresh();
  }

  const selectValue = activeUserId ?? "__self__";

  return (
    <section className="ab-card p-6 space-y-4">
      <div>
        <p className="text-[18px] font-semibold text-[#ededed] tracking-tight">Super Admin</p>
        <p className="text-[13px] text-[#a0a0a5] mt-1">
          View the app as another user. All data shown will be theirs.
        </p>
      </div>

      <div className="space-y-2">
        <label className="ab-label">View as user</label>
        {loading ? (
          <div className="h-8 w-64 rounded-lg bg-[#1c1c20] animate-pulse" />
        ) : (
          <Select value={selectValue} onValueChange={handleSelect}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a user…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__self__">— My own account —</SelectItem>
              {users.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {activeUserId && (
        <p className="text-[13px] text-amber-400">
          Currently viewing as <span className="font-semibold">{activeUserId}</span>
        </p>
      )}
    </section>
  );
}
