import type { CategoryLite, CategorySource, ExtractedTxn, StagedTxn } from "./types";
import { applyRules, type RuleLite } from "./merchant-rules";
import { normalizeDescription } from "./normalize-description";

export function categorizeRows(
  rows: ExtractedTxn[],
  rules: RuleLite[],
  categoriesByName: Map<string, CategoryLite>,
): Array<StagedTxn> {
  return rows.map((r) => {
    const normalized = normalizeDescription(r.description);
    const ruleMatch = applyRules(normalized, rules);
    let categoryId: string | null = null;
    let categorySource: CategorySource | null = null;
    if (ruleMatch) {
      categoryId = ruleMatch;
      categorySource = "rule";
    } else if (r.claudeCategory) {
      const cat = categoriesByName.get(r.claudeCategory);
      if (cat) {
        categoryId = cat.id;
        categorySource = "claude";
      }
    }
    return {
      ...r,
      normalizedDescription: normalized,
      isDuplicate: false,
      duplicateOfId: null,
      categoryId,
      categorySource,
      skip: false,
    };
  });
}
