// Claude Haiku 4.5 pricing (USD per 1M tokens): input $1.00, output $5.00.
// Source: anthropic.com/pricing as of 2026-04. Update here if pricing changes.
const INPUT_PER_MTOK = 1.0;
const OUTPUT_PER_MTOK = 5.0;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * INPUT_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_PER_MTOK;
}
