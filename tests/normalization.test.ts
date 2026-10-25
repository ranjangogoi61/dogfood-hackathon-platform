import { describe, expect, it } from "vitest";

import { normalizeJudgeScores, weightedTotal } from "@/lib/judging/normalization";

const cfg = { minSamples: 3, epsilon: 1e-6 };

describe("normalizeJudgeScores", () => {
  it("z-scores when N and variance are sufficient", () => {
    const r = normalizeJudgeScores([50, 60, 70], cfg);
    expect(r.method).toBe("zscore");
    expect(r.values[1]).toBeCloseTo(0, 6);
  });

  it("falls back on zero variance instead of dividing by zero", () => {
    const r = normalizeJudgeScores([5, 5, 5, 5], cfg);
    expect(r.method).toBe("raw_fallback");
    expect(r.reason).toBe("near_zero_variance");
    expect(r.values).toEqual([5, 5, 5, 5]);
  });

  it("falls back for N=1 and N=2 (below min samples)", () => {
    expect(normalizeJudgeScores([42], cfg).reason).toBe("too_few_samples");
    expect(normalizeJudgeScores([40, 60], cfg).reason).toBe("too_few_samples");
  });

  it("falls back on near-zero variance", () => {
    const r = normalizeJudgeScores([4.0, 4.0000001, 4.0], cfg);
    expect(r.method).toBe("raw_fallback");
  });

  it("min samples is configurable, not hardcoded", () => {
    const r = normalizeJudgeScores([40, 60], { minSamples: 2, epsilon: 1e-6 });
    expect(r.method).toBe("zscore");
  });
});

describe("weightedTotal", () => {
  const crit = [
    { id: "a", weight: 0.5, maxScore: 10 },
    { id: "b", weight: 0.5, maxScore: 20 },
  ];

  it("handles different max scores", () => {
    const t = weightedTotal(crit, new Map([["a", 10], ["b", 10]]));
    expect(t).toBeCloseTo(75, 6);
  });

  it("never turns a missing score into zero", () => {
    expect(weightedTotal(crit, new Map([["a", 10]]))).toBeNull();
  });
});
