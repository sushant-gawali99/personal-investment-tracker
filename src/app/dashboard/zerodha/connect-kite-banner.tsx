"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw, Settings } from "lucide-react";

interface Props {
  status: "not_configured" | "expired" | "error";
  hasConfig: boolean;
}

export function ConnectKiteBanner({ status, hasConfig }: Props) {
  const messages = {
    not_configured: { title: "Zerodha not connected", description: "Add your Kite API credentials in Settings, then connect your account.", icon: <Settings size={18} className="text-[#222222]" /> },
    expired: { title: "Session expired", description: "Your Kite access token expired. Reconnect to refresh it.", icon: <RefreshCw size={18} className="text-[#b25e00]" /> },
    error: { title: "Connection error", description: "Could not fetch data from Kite. Your session may have expired.", icon: <AlertCircle size={18} className="text-[#c13515]" /> },
  };

  const msg = messages[status];

  return (
    <div className="ab-card p-6 flex items-start gap-4 max-w-xl">
      <div className="w-11 h-11 rounded-full bg-[#f7f7f7] flex items-center justify-center shrink-0">{msg.icon}</div>
      <div className="flex-1">
        <p className="text-[16px] font-semibold text-[#222222]">{msg.title}</p>
        <p className="text-[14px] text-[#6a6a6a] mt-1">{msg.description}</p>
        <div className="flex gap-2 mt-4 flex-wrap">
          {hasConfig && (
            <a href="/api/kite/login" className="ab-btn ab-btn-accent">
              Connect Zerodha
            </a>
          )}
          <Link href="/dashboard/settings" className="ab-btn ab-btn-secondary">
            Go to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
