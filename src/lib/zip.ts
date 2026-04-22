import JSZip from "jszip";

const SUPPORTED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const;

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function isSupported(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTS.some((ext) => lower.endsWith(ext));
}

function extOf(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot + 1) : "";
}

/**
 * Expands a .zip File into a flat array of File objects for supported types
 * (pdf / jpg / jpeg / png / webp). Unsupported entries, directories, and
 * macOS metadata files (__MACOSX/, .DS_Store) are silently ignored.
 *
 * Throws if the zip cannot be parsed — callers should surface a toast.
 */
export async function expandZip(zipFile: File): Promise<File[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const out: File[] = [];

  const entries = Object.values(zip.files).filter(
    (e) =>
      !e.dir &&
      !e.name.startsWith("__MACOSX/") &&
      !e.name.endsWith("/.DS_Store") &&
      !e.name.endsWith(".DS_Store") &&
      isSupported(e.name),
  );

  for (const entry of entries) {
    const blob = await entry.async("blob");
    const baseName = entry.name.split("/").pop() || entry.name;
    const ext = extOf(baseName);
    const mime = EXT_TO_MIME[ext] ?? "application/octet-stream";
    out.push(new File([blob], baseName, { type: mime }));
  }

  return out;
}

export function isZipFile(file: File): boolean {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}
