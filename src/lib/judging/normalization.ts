export type NormalizationConfig = {
  minSamples: number;
  epsilon: number;
};

export type NormalizationResult = {
  values: number[];
  method: "zscore" | "raw_fallback";
  reason?: "too_few_samples" | "near_zero_variance";
};

/**
 * Per-judge normalization of project totals (raw values already on a common scale).
 * z-score only when N >= minSamples AND sigma > epsilon; otherwise the raw values
 * are returned unchanged (documented fallback) and flagged.
 */
export function normalizeJudgeScores(
  raw: number[],
  config: NormalizationConfig,
): NormalizationResult {
  const n = raw.length;

  if (n < config.minSamples || n < 2) {
    return { values: [...raw], method: "raw_fallback", reason: "too_few_samples" };
  }

  const mean = raw.reduce((a, b) => a + b, 0) / n;
  const variance = raw.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sigma = Math.sqrt(variance);

  if (!(sigma > config.epsilon)) {
    return { values: [...raw], method: "raw_fallback", reason: "near_zero_variance" };
  }

  return { values: raw.map((v) => (v - mean) / sigma), method: "zscore" };
}

export type Criterion = { id: string; weight: number; maxScore: number };

/** Weighted total on a 0-100 scale. Missing criteria => null (never silently 0). */
export function weightedTotal(
  criteria: Criterion[],
  valuesByCriterion: Map<string, number>,
): number | null {
  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);
  if (criteria.length === 0 || totalWeight <= 0) return null;

  let sum = 0;
  for (const c of criteria) {
    const v = valuesByCriterion.get(c.id);
    if (v === undefined) return null;
    sum += (c.weight / totalWeight) * (v / c.maxScore);
  }
  return sum * 100;
}
