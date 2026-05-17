"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { normalizeBankName } from "@/lib/fd-bank";

interface BankOption {
  id: string;
  name: string;
  normalizedName: string;
  depositCount?: number;
}

interface Props {
  /** Currently selected bank name (free text in the parent form state). */
  value: string;
  /** Called on every change — including typing. Parent decides when to save. */
  onChange: (value: string) => void;
  /** Optional list of existing banks. If omitted, fetches /api/fd/banks once. */
  banks?: BankOption[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  /** Optional id, for label association. */
  id?: string;
}

/**
 * Creatable bank picker for FD forms. Behaves like a normal text input but
 * shows a dropdown of existing FdBanks (filtered as you type) plus an
 * inline "Create new bank" option when the typed value doesn't match any
 * existing entry. Selection just sets the text — the server resolves the
 * actual FdBank on save via findOrCreateFdBank.
 */
export function BankCombobox({
  value,
  onChange,
  banks: banksProp,
  placeholder = "Start typing a bank name…",
  required,
  className,
  disabled,
  id,
}: Props) {
  const [banks, setBanks] = useState<BankOption[]>(banksProp ?? []);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch the list of banks once if not provided by the parent.
  useEffect(() => {
    if (banksProp) return;
    let cancelled = false;
    fetch("/api/fd/banks")
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((j: { items: BankOption[] }) => { if (!cancelled) setBanks(j.items ?? []); })
      .catch(() => { /* offline — fall through to plain text input */ });
    return () => { cancelled = true; };
  }, [banksProp]);

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
    if (!trimmed) return banks.slice(0, 8);
    const q = trimmed.toLowerCase();
    return banks
      .filter((b) => b.name.toLowerCase().includes(q) || b.normalizedName.includes(q))
      .slice(0, 8);
  }, [banks, trimmed]);

  // Show "Create new" affordance when:
  // - user typed something
  // - and no existing bank has that exact normalized name
  const typedNorm = normalizeBankName(trimmed);
  const showCreate = trimmed.length > 0 && !banks.some((b) => b.normalizedName === typedNorm);

  function commit(name: string) {
    onChange(name);
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    const items: Array<{ kind: "bank"; bank: BankOption } | { kind: "create" }> = [
      ...filtered.map((b) => ({ kind: "bank" as const, bank: b })),
      ...(showCreate ? [{ kind: "create" as const }] : []),
    ];
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = items[highlight];
      if (pick?.kind === "bank") commit(pick.bank.name);
      else if (pick?.kind === "create") commit(trimmed);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="ab-input pr-9"
          placeholder={placeholder}
          value={value}
          required={required}
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

      {open && (filtered.length > 0 || showCreate) && (
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
              Use <strong className="font-semibold">&ldquo;{trimmed}&rdquo;</strong> as a new bank
            </button>
          )}
        </div>
      )}
    </div>
  );
}
