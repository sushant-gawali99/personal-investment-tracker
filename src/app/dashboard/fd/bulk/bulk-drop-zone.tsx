"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export const MAX_FILES = 20;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_ZIP_SIZE = 20 * 1024 * 1024; // 20 MB

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
        "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors bg-[#17171a]",
        isDragActive
          ? "border-[#ff385c] bg-[#2a1218]"
          : "border-[#3a3a3f] hover:border-[#ff385c] hover:bg-[#2a1218]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <input {...getInputProps()} />
      <Upload size={24} className="mx-auto mb-2 text-[#a0a0a5]" />
      <p className="text-[14px] text-[#ededed]">
        {isDragActive ? "Drop here" : "Drop files or a .zip here, or click to browse"}
      </p>
      <p className="text-[12px] text-[#a0a0a5] mt-1">
        PDF, JPEG, PNG, WebP — up to {remaining} more file{remaining === 1 ? "" : "s"}, 5 MB each.
      </p>
    </div>
  );
}
