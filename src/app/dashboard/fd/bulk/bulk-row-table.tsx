"use client";

import { Fragment, useState } from "react";
import { Loader2, Check, X, AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Trash2, FileText, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkRow, RowStatus, EditableFields } from "./bulk-state";
import { BulkRowEditor } from "./bulk-row-editor";

function StatusPill({ status, error }: { status: RowStatus; error?: string }) {
  if (status === "pending") {
    return <span className="ab-chip" title="Pending">Pending</span>;
  }
  if (status === "extracting" || status === "saving") {
    return (
      <span className="ab-chip" title={status}>
        <Loader2 size={12} className="animate-spin" />
        {status === "extracting" ? "Extracting" : "Saving"}
      </span>
    );
  }
  if (status === "extracted") {
    return (
      <span className="ab-chip ab-chip-accent" title="Extracted">
        <Check size={12} /> Extracted
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="ab-chip ab-chip-accent" title="Saved">
        <Check size={12} /> Saved
      </span>
    );
  }
  return (
    <span
      className="ab-chip"
      title={error ?? status}
      style={{ background: "#2a1613", color: "#ff7a6e", borderColor: "#3a1a16" }}
    >
      <X size={12} /> {status === "extract_failed" ? "Extract failed" : "Save failed"}
    </span>
  );
}

export function BulkRowTable({
  rows,
  onToggleSelected,
  onEditField,
  onRemove,
  onRetryExtract,
  onRetrySave,
}: {
  rows: BulkRow[];
  onToggleSelected: (id: string) => void;
  onEditField: (id: string, field: keyof EditableFields, value: string) => void;
  onRemove: (id: string) => void;
  onRetryExtract: (id: string) => void;
  onRetrySave: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="ab-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#2a2a2e] text-left text-[12px] text-[#a0a0a5] uppercase tracking-wider">
              <th className="px-3 py-2 w-[40px]"></th>
              <th className="px-3 py-2 w-[40px]"></th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Bank</th>
              <th className="px-3 py-2">FD #</th>
              <th className="px-3 py-2 text-right">Principal</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">Maturity</th>
              <th className="px-3 py-2 w-[100px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isExpanded = expanded.has(row.id);
              const canEdit =
                row.status === "extracted" ||
                row.status === "save_failed" ||
                row.status === "extract_failed";
              const canSelect =
                row.status === "extracted" || row.status === "save_failed";
              const f = row.edited;
              return (
                <Fragment key={row.id}>
                  <tr
                    className={cn(
                      "border-b border-[#2a2a2e] hover:bg-[#17171a]/50",
                      row.isDuplicate && "bg-[#2a1f0d]/30",
                    )}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#2a2a2e]"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                        disabled={!canEdit}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => onToggleSelected(row.id)}
                        disabled={!canSelect}
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusPill status={row.status} error={row.error} />
                        {row.isDuplicate && (
                          <span
                            className="ab-chip"
                            title="An FD with this bank + FD number already exists"
                            style={{ background: "#2a1f0d", color: "#f5a524", borderColor: "#3a2d0f" }}
                          >
                            <AlertTriangle size={12} /> Duplicate
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[#a0a0a5] max-w-[120px] sm:max-w-[180px]">
                      <div className="flex items-center gap-1.5 truncate">
                        {row.kind === "pdf" ? <FileText size={12} /> : <ImageIcon size={12} />}
                        <span className="truncate" title={row.file.name}>{row.file.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">{f.bankName ?? ""}</td>
                    <td className="px-3 py-2 text-[#a0a0a5]">{f.fdNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-right mono">{f.principal ?? ""}</td>
                    <td className="px-3 py-2 text-right mono">{f.interestRate ?? ""}</td>
                    <td className="px-3 py-2 mono text-[#a0a0a5]">{f.startDate ?? ""}</td>
                    <td className="px-3 py-2 mono text-[#a0a0a5]">{f.maturityDate ?? ""}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        {row.status === "extract_failed" && (
                          <button
                            type="button"
                            onClick={() => onRetryExtract(row.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#a0a0a5]"
                            title="Retry extraction"
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                        {row.status === "save_failed" && (
                          <button
                            type="button"
                            onClick={() => onRetrySave(row.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#a0a0a5]"
                            title="Retry save"
                          >
                            <RefreshCw size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemove(row.id)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a2a2e] text-[#a0a0a5]"
                          title="Remove"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && canEdit && (
                    <tr className="border-b border-[#2a2a2e] bg-[#0e0e10]">
                      <td colSpan={11} className="px-3 sm:px-6 py-2 sm:py-4">
                        <BulkRowEditor
                          row={row}
                          onEditField={(field, value) => onEditField(row.id, field, value)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
