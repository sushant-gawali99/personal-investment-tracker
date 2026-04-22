// src/components/bank-accounts/top-merchants-list.tsx
export function TopMerchantsList({ items }: { items: { normalizedDescription: string; total: number; count: number }[] }) {
  return (
    <div className="ab-card p-4">
      <h3 className="font-medium mb-3">Top Merchants</h3>
      <table className="w-full text-sm">
        <tbody>
          {items.map((m, i) => (
            <tr key={i} className="border-t border-[#2a2a2e] first:border-none">
              <td className="py-2 pr-2 truncate max-w-[260px]">{m.normalizedDescription}</td>
              <td className="py-2 text-right text-[#a0a0a5]">{m.count}×</td>
              <td className="py-2 text-right">₹{m.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
