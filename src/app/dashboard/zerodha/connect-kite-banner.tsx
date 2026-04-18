"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw, Settings } from "lucide-react";

interface Props {
  status: "not_configured" | "expired" | "error";
  hasConfig: boolean;
}

export function ConnectKiteBanner({ status, hasConfig }: Props) {
  const messages = {
    not_configured: { title: "Zerodha not connected", description: "Add your Kite API credentials in Settings, then connect your account.", icon: <Settings size={16} className="text-muted-foreground" /> },
    expired: { title: "Session expired", description: "Your Kite access token expired. Reconnect to refresh it.", icon: <RefreshCw size={16} className="text-amber-400" /> },
    error: { title: "Connection error", description: "Could not fetch data from Kite. Your session may have expired.", icon: <AlertCircle size={16} className="text-red-400" /> },
  };

  const msg = messages[status];

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-3 max-w-md">
      <div className="mt-0.5 p-2 rounded-lg bg-border/60">{msg.icon}</div>
      <div>
        <p className="text-sm font-medium text-slate-200">{msg.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{msg.description}</p>
        <div className="flex gap-2 mt-3">
          {hasConfig && (
            <a href="/api/kite/login" className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 transition-colors">
              Connect Zerodha
            </a>
          )}
          <Link href="/dashboard/settings" className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-border/40 transition-colors">
            Go to Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
