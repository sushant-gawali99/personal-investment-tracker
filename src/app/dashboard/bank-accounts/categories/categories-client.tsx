// src/app/dashboard/bank-accounts/categories/categories-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  CheckCircle2,
  Globe,
  MinusCircle,
  PlusCircle,
  Sparkles,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";

interface Cat {
  id: string; userId: string | null; name: string; kind: string;
  icon: string | null; color: string | null; sortOrder: number;
}
interface Rule {
  id: string; pattern: string; matchCount: number;
  userId: string | null; // null = shared/system rule
  category: Cat;
}

function kindChipClass(kind: string): string {
  switch (kind) {
    case "expense":  return "ab-chip-error";
    case "income":   return "ab-chip-success";
    case "transfer": return "ab-chip-info";
    default:         return "";
  }
}

function kindIcon(kind: string) {
  switch (kind) {
    case "expense":  return <MinusCircle size={11} />;
    case "income":   return <PlusCircle size={11} />;
    case "transfer": return <ArrowLeftRight size={11} />;
    default:         return null;
  }
}

export function CategoriesClient({ categories, rules }: { categories: Cat[]; rules: Rule[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", kind: "expense" as "expense" | "income" | "transfer" });
  const [error, setError] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiResult, setAiResult] = useState<{
    rulesCreated: number;
    categoriesCreated?: number;
    transactionsCategorised: number;
    remainingUncategorised?: number;
    remainingSamples?: string[];
    rounds?: Array<{
      round: number;
      descriptions: number;
      suggestions: number;
      rulesCreated: number;
      txnsCategorised: number;
    }>;
    message?: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runAiCategorize() {
    setAiRunning(true);
    setAiResult(null);
    setAiError(null);
    try {
      const r = await fetch("/api/bank-accounts/transactions/ai-categorize", {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok) {
        setAiError(data.error ?? "Failed to run AI categorization.");
      } else {
        setAiResult(data);
        router.refresh();
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setAiRunning(false);
    }
  }

  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const r = await fetch("/api/bank-accounts/categories", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ name: "", kind: "expense" });
    setError(null);
    router.refresh();
  }
  async function delCat(id: string) {
    if (!confirm("Soft-delete this category? Past transactions keep their label.")) return;
    await fetch(`/api/bank-accounts/categories/${id}`, { method: "DELETE" });
    router.refresh();
  }
  async function delRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/bank-accounts/rules/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const userCats = categories.filter((c) => c.userId !== null);
  const presetCats = categories.filter((c) => c.userId === null);

  // Group presets by kind for a cleaner display
  const presetsByKind = {
    expense: presetCats.filter((c) => c.kind === "expense"),
    income: presetCats.filter((c) => c.kind === "income"),
    transfer: presetCats.filter((c) => c.kind === "transfer"),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── Left column: Categories ────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight">Categories</h2>
          <span className="text-[12px] text-[var(--text-secondary)]">
            {presetCats.length} preset · {userCats.length} custom
          </span>
        </div>

        <form onSubmit={addCat} className="ab-card p-4 space-y-3">
          {/* Labelled fields: grid keeps the name input wide and prevents
              flex-basis collapse when the select has longer intrinsic content. */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 gap-y-2 items-end">
            <div className="min-w-0">
              <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold block mb-1">
                Name
              </label>
              <input
                className="ab-input"
                placeholder="e.g. Coffee shops"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <label className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold block mb-1">
                Kind
              </label>
              <select
                className="ab-input"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as "expense" | "income" | "transfer" })}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <button type="submit" className="ab-btn ab-btn-accent h-[46px] px-5">
              <PlusCircle size={14} /> Add
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 text-[13px] text-[var(--accent-error)]">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Presets grouped by kind */}
        {(["expense", "income", "transfer"] as const).map((k) => {
          const list = presetsByKind[k];
          if (list.length === 0) return null;
          return (
            <div key={k} className="ab-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`ab-chip ${kindChipClass(k)}`}>
                  {kindIcon(k)} {k}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{list.length} preset</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {list.map((c) => (
                  <span key={c.id} className="ab-chip" style={{ background: "var(--surface-muted)" }}>
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Custom categories */}
        <div className="ab-card p-4">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Your categories</h3>
          {userCats.length === 0 ? (
            <p className="text-[13px] text-[var(--text-tertiary)]">No custom categories yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {userCats.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className={`ab-chip ${kindChipClass(c.kind)}`}>
                      {kindIcon(c.kind)} {c.kind}
                    </span>
                    <span className="text-[14px] text-[var(--text-primary)] font-medium">{c.name}</span>
                  </div>
                  <button
                    onClick={() => delCat(c.id)}
                    className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-error)] hover:bg-[rgba(255,122,110,0.08)] transition-colors"
                    title="Soft-delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── Right column: Rules ─────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[18px] font-semibold text-[var(--text-primary)] tracking-tight">Merchant rules</h2>
            <span className="text-[12px] text-[var(--text-secondary)]">{rules.length} rule{rules.length === 1 ? "" : "s"}</span>
          </div>
          <button
            type="button"
            onClick={runAiCategorize}
            disabled={aiRunning}
            className="ab-btn ab-btn-accent shrink-0"
            title="Ask Claude to cluster uncategorised transactions and auto-create rules"
          >
            <Sparkles size={14} />
            {aiRunning ? "Running…" : "Auto-categorize with AI"}
          </button>
        </div>

        {aiResult && (
          <div className="ab-card p-4 flex items-start gap-3 border border-[rgba(94,224,164,0.25)] bg-[rgba(94,224,164,0.06)]">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[var(--accent-success)]" />
            <div className="text-[13px] text-[var(--text-primary)] space-y-0.5">
              {aiResult.message ? (
                <p>{aiResult.message}</p>
              ) : (
                <>
                  <p>
                    Created{" "}
                    <span className="font-semibold text-[var(--accent-success)]">
                      {aiResult.rulesCreated} new rule{aiResult.rulesCreated === 1 ? "" : "s"}
                    </span>
                    {aiResult.categoriesCreated && aiResult.categoriesCreated > 0 ? (
                      <>
                        {" "}(+{" "}
                        <span className="font-semibold text-[var(--accent-success)]">
                          {aiResult.categoriesCreated} new categor{aiResult.categoriesCreated === 1 ? "y" : "ies"}
                        </span>
                        )
                      </>
                    ) : null}{" "}
                    and categorised{" "}
                    <span className="font-semibold text-[var(--accent-success)]">
                      {aiResult.transactionsCategorised} transaction{aiResult.transactionsCategorised === 1 ? "" : "s"}
                    </span>
                    .
                  </p>
                  {aiResult.rulesCreated === 0 && (
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      No new rules were confident enough to auto-apply.
                    </p>
                  )}
                  {aiResult.rounds && aiResult.rounds.length > 0 && (
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      {aiResult.rounds.length} round{aiResult.rounds.length === 1 ? "" : "s"}:{" "}
                      {aiResult.rounds
                        .map((r) => `#${r.round} +${r.rulesCreated} rule${r.rulesCreated === 1 ? "" : "s"}/${r.txnsCategorised} txn`)
                        .join(" · ")}
                    </p>
                  )}
                  {typeof aiResult.remainingUncategorised === "number" && aiResult.remainingUncategorised > 0 && (
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      {aiResult.remainingUncategorised} transaction{aiResult.remainingUncategorised === 1 ? "" : "s"} still uncategorised — run again to try more, or categorise them manually.
                    </p>
                  )}
                  {aiResult.remainingSamples && aiResult.remainingSamples.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)]">
                        Sample of what&apos;s still uncategorised ({aiResult.remainingSamples.length} of {aiResult.remainingUncategorised})
                      </summary>
                      <ul className="mt-2 space-y-1 font-mono text-[11px] text-[var(--text-secondary)]">
                        {aiResult.remainingSamples.map((s, i) => (
                          <li key={i} className="truncate">{s}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {aiError && (
          <div className="ab-card p-4 flex items-start gap-3 border border-[rgba(255,122,110,0.25)] bg-[rgba(255,122,110,0.06)]">
            <XCircle size={16} className="shrink-0 mt-0.5 text-[var(--accent-error)]" />
            <p className="text-[13px] text-[var(--text-primary)]">{aiError}</p>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="ab-card p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[rgba(255,56,92,0.1)] flex items-center justify-center mx-auto mb-3">
              <Tag size={18} className="text-[var(--primary)]" />
            </div>
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">No rules yet</p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
              Rules appear automatically when you change a transaction&apos;s category
              and choose to apply it to matching merchants.
            </p>
          </div>
        ) : (
          <div className="ab-card overflow-hidden flex flex-col" style={{ maxHeight: 420 }}>
            {/* Compact header showing count + scroll hint when list is long */}
            {rules.length > 8 && (
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between shrink-0">
                <span className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                  {rules.length} rules
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">scroll to see all</span>
              </div>
            )}
            <ul className="divide-y divide-[var(--border)] overflow-y-auto ab-scroll">
              {rules.map((r) => {
                const isGlobal = r.userId === null;
                return (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--surface-muted)]/60 transition-colors">
                  {/* Pattern + category on one compact row */}
                  <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-[12px] text-[var(--text-primary)] truncate">{r.pattern}</p>
                    {isGlobal && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--accent-info)] bg-[rgba(90,169,255,0.1)] border border-[rgba(90,169,255,0.25)]"
                        title="Shared across all users"
                      >
                        <Globe size={9} /> shared
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--text-tertiary)]">→</span>
                    <span className={`ab-chip ${kindChipClass(r.category.kind)}`} style={{ fontSize: 10, padding: "1px 7px" }}>
                      {kindIcon(r.category.kind)} {r.category.name}
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)] shrink-0">
                      {r.matchCount} match{r.matchCount === 1 ? "" : "es"}
                    </span>
                  </div>
                  {isGlobal ? (
                    <span
                      className="p-1.5 text-[var(--border-strong)] shrink-0"
                      title="Shared rules can't be deleted from here"
                    >
                      <Globe size={13} />
                    </span>
                  ) : (
                    <button
                      onClick={() => delRule(r.id)}
                      className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent-error)] hover:bg-[rgba(255,122,110,0.08)] transition-colors shrink-0"
                      title="Delete rule"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
