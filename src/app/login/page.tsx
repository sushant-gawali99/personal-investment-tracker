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

function LogoMark() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-[14px] font-bold"
      style={{ background: "linear-gradient(135deg, #ff385c 0%, #e00b41 100%)" }}
    >
      M
    </span>
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
    <div className="min-h-screen bg-white flex">
      <div className="hidden lg:flex lg:w-[48%] flex-col justify-between p-12 bg-[#fafafa] border-r border-[#ebebeb]">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[18px] font-semibold text-[#222222] tracking-tight">MyFolio</span>
        </div>

        <div className="space-y-10">
          <div>
            <h1 className="text-[44px] font-bold text-[#222222] leading-[1.05] tracking-tight">
              Your wealth,<br />at a glance.
            </h1>
            <p className="text-[#6a6a6a] text-[15px] mt-5 leading-relaxed max-w-sm">
              Track equities, mutual funds, and fixed deposits in one unified dashboard. Live P&amp;L, AI-powered FD extraction, and more.
            </p>
          </div>

          <div className="space-y-5">
            {[
              { icon: BarChart3, label: "Live portfolio from Zerodha", sub: "Equity & MF holdings in real time" },
              { icon: ShieldCheck, label: "AI-powered FD tracking", sub: "Extract details from certificates instantly" },
              { icon: TrendingUp, label: "Portfolio analytics", sub: "CAGR, allocation drift, accrual timeline" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fff5f7] flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-[#ff385c]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#222222]">{label}</p>
                  <p className="text-[13px] text-[#6a6a6a] mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-[#929292]">Personal use only · Data stays in your account</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-7">
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <LogoMark />
            <span className="text-[16px] font-semibold text-[#222222] tracking-tight">MyFolio</span>
          </div>

          <div>
            <h2 className="text-[28px] font-bold text-[#222222] tracking-tight">Welcome back</h2>
            <p className="text-[#6a6a6a] text-[14px] mt-1.5">Sign in to access your portfolio</p>
          </div>

          <button
            onClick={handleGoogle}
            disabled={loadingGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#f7f7f7] text-[#222222] font-medium text-[15px] py-3 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed border border-[#222222]"
          >
            {loadingGoogle ? (
              <Loader2 size={17} className="animate-spin text-[#6a6a6a]" />
            ) : (
              <GoogleIcon />
            )}
            {loadingGoogle ? "Redirecting…" : "Continue with Google"}
          </button>

          <p className="text-center text-[12px] text-[#929292]">
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
