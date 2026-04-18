import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="max-w-6xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
