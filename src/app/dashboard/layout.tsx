import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#17171a]">
      <TopNav />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
