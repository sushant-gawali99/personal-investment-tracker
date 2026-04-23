"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  savedPhone: string | null;
}

export function NotificationSettingsForm({ savedPhone }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState(savedPhone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label htmlFor="phone" className="ab-label">WhatsApp Phone Number</label>
        <input
          id="phone"
          className="ab-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
        />
        <p className="text-[12px] text-[#a0a0a5] mt-1.5">
          International format. Leave blank to skip WhatsApp reminders.
        </p>
      </div>

      {error && (
        <p className="text-[13px] text-[#ff7a6e] bg-[#2a1613] rounded-lg px-3 py-2.5 font-medium">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-[13px] text-[#5ee0a4] bg-[#0f2a19] rounded-lg px-3 py-2.5 font-medium">
          Saved successfully.
        </p>
      )}

      <button type="submit" disabled={saving} className="ab-btn ab-btn-accent">
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
