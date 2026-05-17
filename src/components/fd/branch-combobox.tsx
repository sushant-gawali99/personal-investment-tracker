"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { normalizeBranchName } from "@/lib/fd-bank";

interface BranchOption {
  id: string;
  name: string;
  normalizedName: string;
  depositCount?: number;
}

interface Props {
  /** Currently selected branch name (free text in the parent form state). */
  value: string;
  onChange: (value: string) => void;
  /**
   * The currently-selected bank's name. When empty, the combobox falls
   * back to a plain text input — branches are scoped to a bank, so we
   * can't usefully suggest anything without one. Used for the lookup
   * key only; the actual scoping is by bankId from /api/fd/banks.
   */
  bankName: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Creatable branch picker scoped to a bank. Resolves the user's banks via
 * /api/fd/banks (small, cached after first fetch), matches the parent
 * bankName by normalized name to find the bankId, then fetches branches
 * for that bank. When no bank is selected yet we render a plain text
 * input so the user isn't blocked.
 */
export function BranchCombobox({
  value,
  onChange,
  bankName,
  placeholder = "Branch (optional)",
  className,
  disabled,
  id,
}: Props) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Resolve bankName → bankId by hitting /api/fd/banks. Tiny payload, fine
  // to refetch when the bank name changes; the combobox above us drives
  // this prop only on commit, not on every keystroke.
  const [bankId, setBankId] = useState<string | null>(null);
  useEffect(() => {
    const name = (bankName ?? "").trim();
    if (!name) { setBankId(null); return; }
    let cancelled = false;
    fetch("/api/fd/banks")
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((j: { items: { id: string; name: string; normalizedName: string }[] }) => {
        if (cancelled) return;
        const wanted = name.toLowerCase();
        const norm = wanted.split(/\s+/).slice(0, 2).join(" ");
        // Try the normalized form first (matches normalizeBankName), then
        // fall back to a loose case-insensitive equality on the raw name.
        const match = j.items.find((b) => b.normalizedName === norm)
                  ?? j.items.find((b) => b.name.toLowerCase() === wanted);
        setBankId(match?.id ?? null);
      })
      .catch(() => setBankId(null));
    return () => { cancelled = true; };
  }, [bankName]);

  // Fetch branches for the resolved bankId.
  useEffect(() => {
    if (!bankId) { setBranches([]); return; }
    let cancelled = false;
    fetch(`/api/fd/branches?bankId=${encodeURIComponent(bankId)}`)
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((j: { items: BranchOption[] }) => { if (!cancelled) setBranches(j.items ?? []); })
      .catch(() => { /* fall through to plain input */ });
    return () => { cancelled = true; };
  }, [bankId]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const trimmed = value.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return branches.slice(0, 8);
    const q = trimmed.toLowerCase();
    return branches
      .filter((b) => b.name.toLowerCase().includes(q) || b.normalizedName.includes(q))
      .slice(0, 8);
  }, [branches, trimmed]);

  const typedNorm = normalizeBranchName(trimmed);
  const showCreate = trimmed.length > 0 && !branches.some((b) => b.normalizedName === typedNorm);
  // When we don't have a resolved bank yet, hide the dropdown entirely —
  // it would just suggest blanks. The text input still works normally.
  const dropdownDisabled = !bankId || branches.length === 0 && !showCreate;

  function commit(name: string) {
    onChange(name);
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || dropdownDisabled) return;
    const items: Array<{ kind: "branch"; branch: BranchOption } | { kind: "create" }> = [
      ...filtered.map((b) => ({ kind: "branch" as const, branch: b })),
      ...(showCreate ? [{ kind: "create" as const }] : []),
    ];
    if (items.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + items.length) % items.length); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = items[highlight];
      if (pick?.kind === "branch") commit(pick.branch.name);
      else if (pick?.kind === "create") commit(trimmed);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <input
          id={id}
          type="text"
          className="ab-input pr-9"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none"
        />
      </div>

      {open && !dropdownDisabled && (
        <div
          className="absolute z-30 mt-1 w-full rounded-lg overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
          role="listbox"
        >
          {filtered.map((b, i) => {
            const selected = b.name === trimmed;
            const highlighted = i === highlight;
            return (
              <button
                key={b.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => commit(b.name)}
                onMouseEnter={() => setHighlight(i)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[14px] transition-colors"
                style={{
                  background: highlighted ? "var(--surface-muted)" : "transparent",
                  color: "var(--text-primary)",
                }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {selected && <Check size={12} className="text-[var(--primary)] shrink-0" />}
                  <span className="truncate">{b.name}</span>
                </span>
                {typeof b.depositCount === "number" && (
                  <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">
                    {b.depositCount} FD{b.depositCount === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            );
          })}

          {showCreate && (
            <button
              type="button"
              role="option"
              aria-selected={highlight === filtered.length}
              onClick={() => commit(trimmed)}
              onMouseEnter={() => setHighlight(filtered.length)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-[14px] transition-colors border-t"
              style={{
                background: highlight === filtered.length ? "var(--surface-muted)" : "transparent",
                borderColor: "var(--border)",
                color: "var(--primary)",
              }}
            >
              <Plus size={13} />
              Use <strong className="font-semibold">&ldquo;{trimmed}&rdquo;</strong> as a new branch
            </button>
          )}
        </div>
      )}
    </div>
  );
}
