# Score normalization

Judges differ in how generously they score. The export therefore reports both a raw and a per-judge normalized score.

## Pipeline

1. **Weighted total per assignment** (`weightedTotal`): each criterion contributes `weight/Σweights × value/maxScore`, scaled to 0–100. Different `maxScore` values are handled; **a missing criterion yields `null`, never 0**, and that assignment is excluded.
2. **Per-judge normalization** (`normalizeJudgeScores`): for each judge, take the totals of all projects they fully scored.
   - If `N >= normalization_min_samples` (default 3) **and** population σ `> normalization_epsilon` (default 1e-6): `z = (x − μ) / σ`.
   - Otherwise fall back to the raw 0–100 value and report why (`too_few_samples` or `near_zero_variance`).
3. **Aggregation**: `mean_raw_score` and `mean_normalized_score` per project over the judges who scored it.

Both thresholds are per-event columns (`events.normalization_min_samples`, `events.normalization_epsilon`), not hidden constants.

## Known limitation

When some judges fall back to raw while others use z-scores, the two scales differ (0–100 vs. standard deviations), so `mean_normalized_score` mixes them. Rank on `mean_raw_score` when judges disagree on method, or ensure each judge scores at least `min_samples` projects. The export does not hide this: with the seeded data (each judge scores 1 project, fewer than the default minimum of 3) every judge uses the fallback, so the two columns are identical.

## Tests

`tests/normalization.test.ts` covers zero variance, N = 1 and 2, near-zero variance, configurable min samples, different max scores, and missing scores.
