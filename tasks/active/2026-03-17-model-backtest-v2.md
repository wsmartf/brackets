# Task: Model Backtest And V2 Probability Model

## Goal
Build a simple, better-tested tournament prediction model without overcomplicating the system.

The immediate objective is not "AI" or a giant feature set. It is:
- assemble a trustworthy historical dataset
- reproduce the current model as a baseline
- evaluate it properly on past tournaments
- try one stronger but still simple replacement model
- only switch the production model if it clearly performs better out of sample

## Why
- The current model is a reasonable V1 prior, but it is hand-tuned and lightly calibrated.
- More bracket count helps only a little if the probabilities themselves are mediocre.
- The cleanest improvement is usually better probabilities, not more code or more infrastructure.

## Current Model
The current production model lives in [lib/tournament.ts](/Users/willsmart/dev/brackets/lib/tournament.ts).

Today it does this:
- each team has one strength number: `netRating`
- for any matchup, compute:
  - `P(teamA beats teamB) = logistic(BETA * (netRatingA - netRatingB))`
- `BETA` is currently a hand-chosen constant: `0.07`
- the app precomputes a `64 x 64` matchup table and uses that for all rounds

This is simple and fast, but limited.

## Core Concepts
### Matchup model
A matchup model predicts the probability that Team A beats Team B on a neutral court.

For this app, that is the key modeling unit. Once we can predict any single matchup well, the bracket generator can use those probabilities to simulate the full tournament.

### Logistic regression
Logistic regression is the simplest high-value model to try next.

It works well when:
- the outcome is binary: win or lose
- the inputs are numeric team features
- we want interpretable coefficients
- we want a stable model that is easy to export into TypeScript later

### Calibration
Calibration asks whether predicted probabilities match reality.

Example:
- if we predict 100 games at `70%`
- about 70 of those games should actually be won by that side

A model can have decent accuracy and still be badly calibrated.

### Log loss
Log loss is a standard metric for probabilistic predictions.

It rewards:
- high probability on events that really happened

and punishes:
- overconfidence on wrong predictions

This is often the best primary metric for tournament prediction models.

### Brier score
Brier score is the mean squared error of predicted probabilities.

It is easier to interpret than log loss and is also useful for calibration checks.

### Backtest
A backtest means:
- train on older seasons
- test on later seasons that the model has not seen

This is how we find out whether a model is genuinely better or just overfit.

## Constraints
- Keep the first improved model simple.
- Prefer pre-tournament inputs only. Do not use post-tournament or post-game information.
- Do not change the production app model until a backtest shows a clear improvement.
- Keep the runtime production path simple: ideally export coefficients or a compact lookup table.
- Avoid adding heavy infra, training servers, or complicated pipelines.

## Candidate Data Sources
### Historical tournament outcomes
Needed for labels and evaluation.

Likely source:
- Kaggle March Madness / March Machine Learning Mania datasets
- useful tables include tournament results, seeds, and bracket slots

### Historical pre-tournament team ratings
Needed for model features.

Good options:
- KenPom historical ratings, if we can source a reliable historical export
- Bart Torvik historical ratings
- Kaggle `MasseyOrdinals` data as a fallback or additional feature source

### Local `data.csv`
This may be useful if:
- it is pre-tournament
- it can be sourced historically, not just for one season
- the fields are stable and not leaking future information

Initial promising columns:
- `obpr`
- `dbpr`
- `bpr`
- `off_rank`
- `def_rank`
- `tempo`
- `opponent_adjust`
- `pace_adjust`
- possibly injury/roster-related fields if they are genuinely pre-tournament

Before using this file, we need to identify:
- where it came from
- whether historical versions exist
- whether any columns leak post-selection or post-tournament information

## Recommended V2 Model
Start with regularized logistic regression on matchup feature differences.

For Team A vs Team B, create features like:
- `adj_em_diff`
- `adj_o_diff`
- `adj_d_diff`
- `tempo_diff`
- `seed_diff`
- optionally `barthag_diff` or similar if using Torvik
- optionally a small number of `data.csv` feature diffs if historical and trustworthy

Target:
- `1` if Team A won
- `0` if Team B won

This keeps the model:
- interpretable
- easy to train
- easy to validate
- easy to port into production

## Baselines To Compare
At minimum, compare:

1. Seed-only baseline
   Always pick the better seed, with a simple probability curve by seed difference or seed matchup.

2. Current production model
   The existing `netRating` logistic model from [lib/tournament.ts](/Users/willsmart/dev/brackets/lib/tournament.ts).

3. V2 logistic regression
   The richer feature-difference model.

Optional later baseline:
- a market-informed model if we can obtain reliable historical spreads or prices

## Backtest Design
### Data split
Use season-based holdouts, not random row splits.

Suggested split:
- train: older historical seasons
- validate: middle seasons
- holdout: newest seasons

Example:
- train: 2003-2017
- validate: 2018-2021
- holdout: 2022-2025

Exact split depends on data availability.

### Evaluation metrics
Primary:
- log loss on tournament games

Secondary:
- Brier score
- calibration by probability bucket
- raw accuracy
- performance by seed-matchup bucket like `1v16`, `5v12`, `8v9`

### Sanity checks
- Does the model heavily overrate favorites?
- Does it underpredict classic upset bands?
- Does it assign reasonable champion probabilities?
- Does it clearly beat the current production model on holdout seasons?

## Production Integration Plan
If V2 wins the backtest:

1. Freeze the trained model into a compact production artifact.
   Example:
   - JSON coefficients
   - feature normalization constants if needed

2. Add a pure TypeScript probability function in [lib/tournament.ts](/Users/willsmart/dev/brackets/lib/tournament.ts)
   that reproduces the trained model exactly.

3. Rebuild the `64 x 64` matchup probability table from the new function.

4. Keep the rest of the app unchanged.
   The worker/analyzer architecture should not need to change.

## Acceptance Criteria
- Historical dataset assembled with documented provenance
- Current production model reproduced as a backtest baseline
- One simple V2 model trained and evaluated
- Holdout-season results recorded for:
  - current model
  - seed-only baseline
  - V2 model
- Decision made:
  - keep current model, or
  - switch to V2 because it clearly wins

## Plan
1. Identify and download the historical data sources we can actually rely on.
2. Build a season-level training table of tournament matchups.
3. Recreate the current production model offline and score it historically.
4. Train a simple logistic regression V2 on feature differences.
5. Compare metrics on holdout seasons.
6. If V2 is clearly better, port it into TypeScript and re-run app-level sanity checks.

## Current Status
- Current production model exists and is stable.
- Historical tournament matchup dataset has been assembled from Kaggle tournament results/seeds and normalized KenPom ratings.
- `data.csv` exists locally and may provide useful richer features, but provenance and historical availability are still unknown.
- A baseline backtest script for the current production model now exists and should be run before attempting a richer V2.

## Baseline Findings
Historical backtest on `2002-2025` NCAA tournament games:

- Current production `BETA=0.07`
  - all-game log loss: `0.530672`
  - all-game Brier score: `0.176108`
  - all-game accuracy: `0.757436`
  - holdout (`2022-2025`) log loss: `0.538172`
  - holdout accuracy: `0.750000`

- Best train-only beta found by simple grid search over the current model form:
  - best beta on train split: `0.15`
  - all-game log loss with `beta=0.15`: `0.487692`
  - holdout log loss with `beta=0.15`: `0.512461`
  - holdout accuracy with `beta=0.15`: `0.750000`

Interpretation:
- the current model shape is decent, but `BETA=0.07` appears too flat
- a steeper slope improves probability quality materially
- this is strong evidence that calibration/fitting matters before adding a more complex model

## V2 Findings
Simple logistic-regression V2 using:
- `net_rating_diff`
- `offense_rating_diff`
- `defense_rating_diff`
- `adj_tempo_diff`
- `schedule_net_rating_diff`
- `seed_num_diff`

Best first-pass result:
- validation-selected regularization: `0.0`
- holdout (`2022-2025`) log loss: `0.498025`
- holdout Brier score: `0.163955`
- holdout accuracy: `0.742537`

Comparison:
- tuned one-parameter baseline (`beta=0.15`) holdout log loss: `0.512461`
- V2 holdout log loss: `0.498025`

Interpretation:
- V2 improves probability quality on holdout seasons
- holdout pick accuracy is slightly lower than the tuned baseline, but log loss and Brier are better
- this is a good sign because the app ultimately needs better probabilities more than slightly better thresholded pick rate

## Open Questions
- What is the provenance of `data.csv`?
- Can we get reliable historical KenPom exports, or should we use Torvik / MasseyOrdinals first?
- Do we want the production model to optimize only for game-level probability quality, or also for bracket-pool diversity later?
- Are historical Vegas lines worth the extra sourcing effort, or should they wait for a later model version?

## Next Steps
- Decide whether to port the current best V2 coefficients into a TypeScript probability function.
- Before changing production, compare the V2 model and tuned baseline on a few tournament-specific sanity checks.
- If we ship V2, freeze the coefficients and training-time standardization constants in a compact JSON artifact.
- Keep `data.csv` out of scope unless its provenance and historical availability become clear.

## Affected Files
- [lib/tournament.ts](/Users/willsmart/dev/brackets/lib/tournament.ts)
- [data/tournament-2026.json](/Users/willsmart/dev/brackets/data/tournament-2026.json)
- [data.csv](/Users/willsmart/dev/brackets/data.csv)
- [scripts/normalize_kenpom.py](/Users/willsmart/dev/brackets/scripts/normalize_kenpom.py)
- [scripts/build_backtest_dataset.py](/Users/willsmart/dev/brackets/scripts/build_backtest_dataset.py)
- [scripts/backtest_current_model.py](/Users/willsmart/dev/brackets/scripts/backtest_current_model.py)
- [scripts/train_v2_model.py](/Users/willsmart/dev/brackets/scripts/train_v2_model.py)
- future offline model artifacts under `model/`
