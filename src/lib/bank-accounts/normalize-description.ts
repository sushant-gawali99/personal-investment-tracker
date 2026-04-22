export function normalizeDescription(input: string): string {
  if (!input) return "";
  return input
    .replace(/\d{10,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
