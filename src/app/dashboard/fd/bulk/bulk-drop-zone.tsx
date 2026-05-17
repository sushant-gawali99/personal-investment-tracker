"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_FILES = 20;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50 MB

export function BulkDropZone({
  currentCount,
  onFiles,
  disabled,
}: {
  currentCount: number;
  onFiles: (files: File[]) => void;
  disabled: boolean;
}) {
  const onDrop = useCallback(
    (files: File[]) => {
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [],
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "application/zip": [],
      "application/x-zip-compressed": [],
    },
    disabled,
    multiple: true,
  });

  const remaining = MAX_FILES - currentCount;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "rounded-xl border-2 border-dashed p-5 sm:p-8 text-center cursor-pointer transition-colors bg-[var(--surface-raised)]",
        isDragActive
          ? "border-[var(--primary)] bg-[var(--primary-tint)]"
          : "border-[var(--border-strong)] hover:border-[var(--primary)] hover:bg-[var(--primary-tint)]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <input {...getInputProps()} />
      <Upload size={24} className="mx-auto mb-2 text-[var(--text-secondary)]" />
      <p className="text-[14px] text-[var(--text-primary)]">
        {isDragActive ? "Drop here" : "Drop files or a .zip here, or click to browse"}
      </p>
      <p className="text-[12px] text-[var(--text-secondary)] mt-1">
        PDF, JPEG, PNG, WebP — up to {remaining} more file{remaining === 1 ? "" : "s"}, 5 MB each.
      </p>
    </div>
  );
}
