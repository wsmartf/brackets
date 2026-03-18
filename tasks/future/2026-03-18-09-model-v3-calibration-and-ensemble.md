## Goal
Improve prediction quality beyond the current V2 model without making production operations complicated.

## Why
- Better probabilities increase the quality of the entire bracket universe.
- This is the most direct path toward deeper survivor runs.
- It is one of the strongest technically impressive areas for next iteration.

## Constraints
- Keep the production runtime path simple.
- Use season-based backtests and holdouts, not ad hoc judgment.
- Do not ship a new model unless it clearly improves the chosen evaluation metrics.

## Acceptance Criteria
- At least one stronger post-V2 candidate model is trained and evaluated.
- The evaluation includes calibration and holdout metrics.
- A clear ship/no-ship decision is recorded.
- Production integration remains a frozen artifact plus TypeScript inference path.

## Current Status
- Not started.

## Next Steps
- Choose the next candidate family: recalibrated V2, ensemble, or market blend.
- Decide the primary optimization metric.
- Reuse the existing backtest pipeline and record results.

## Affected Files
- `scripts/`
- `data/model-v2.json`
- future model artifacts
- `lib/tournament.ts`
- `README.md`
