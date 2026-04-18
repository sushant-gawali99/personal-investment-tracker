"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2, TrendingUp, ShieldCheck, BarChart3 } from "lucide-react";
import { Suspense } from "react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function handleGoogle() {
    setLoadingGoogle(true);
    await signIn("google", { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0d] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-[#0e0e11] border-r border-[rgba(73,69,78,0.2)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <TrendingUp size={15} className="text-primary" />
          </div>
          <span className="font-headline font-bold text-sm text-[#e4e1e6]">Personal Investment Tracker</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="font-headline font-bold text-4xl text-[#e4e1e6] leading-tight tracking-tight">
              Your wealth,<br />at a glance.
            </h1>
            <p className="text-[#cbc4d0] text-sm mt-4 leading-relaxed max-w-xs">
              Track equities, mutual funds, and fixed deposits in one unified dashboard. Live P&amp;L, AI-powered FD extraction, and more.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: BarChart3, label: "Live portfolio from Zerodha", sub: "Equity & MF holdings in real time" },
              { icon: ShieldCheck, label: "AI-powered FD tracking", sub: "Extract details from certificates instantly" },
              { icon: TrendingUp, label: "Portfolio analytics", sub: "CAGR, allocation drift, accrual timeline" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1b1b1e] ghost-border flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={13} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-headline font-semibold text-[#e4e1e6]">{label}</p>
                  <p className="text-[11px] text-[#cbc4d0] mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-[#49454e]">Personal use only · Data stays in your account</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp size={13} className="text-primary" />
            </div>
            <span className="font-headline font-bold text-sm text-[#e4e1e6]">Personal Investment Tracker</span>
          </div>

          <div>
            <h2 className="font-headline font-bold text-2xl text-[#e4e1e6] tracking-tight">Welcome back</h2>
            <p className="text-[#cbc4d0] text-sm mt-1">Sign in to access your portfolio</p>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loadingGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loadingGoogle ? (
              <Loader2 size={16} className="animate-spin text-gray-500" />
            ) : (
              <GoogleIcon />
            )}
            {loadingGoogle ? "Redirecting…" : "Continue with Google"}
          </button>

          <p className="text-center text-[11px] text-[#49454e]">
            Private app · Only authorised accounts can sign in
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
