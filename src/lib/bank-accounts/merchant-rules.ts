export interface RuleLite {
  id: string;
  pattern: string;
  categoryId: string;
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped, "i");
}

export function applyRules(description: string, rules: RuleLite[]): string | null {
  const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const r of sorted) {
    if (patternToRegex(r.pattern).test(description)) return r.categoryId;
  }
  return null;
}

export function suggestPattern(description: string): string {
  return description
    .replace(/\b\d{6,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPatternTooBroad(pattern: string, allDescriptions: string[]): boolean {
  if (pattern.length < 3) return true;
  if (allDescriptions.length === 0) return false;
  const re = patternToRegex(pattern);
  const hits = allDescriptions.filter((d) => re.test(d)).length;
  return hits / allDescriptions.length > 0.5;
}
