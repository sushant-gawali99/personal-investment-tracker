import { EquityMFTabs } from "./tabs";

export default function EquityMFLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#ededed] tracking-tight">Equity &amp; Mutual Funds</h1>
          <p className="text-[14px] text-[#a0a0a5] mt-1">Your direct-equity holdings and mutual-fund portfolio.</p>
        </div>
        <EquityMFTabs />
      </div>
      {children}
    </div>
  );
}
