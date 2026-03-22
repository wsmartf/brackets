.PHONY: init install dev lint typecheck build analyze analyze-smoke collision-stats collision-stats-smoke bracket-stats bracket-stats-smoke backtest-current-model train-v2-model calibrate-v2 champion-probs bracket-stats-viz uv-sync verify replay-stub replay-smoke refresh-loop ops-status ops-refresh ops-refresh-no-espn ops-audit ops-espn-names test test-watch test-ui test-ui-headed test-ui-update test-all

init: install

install:
	npm install

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npm run typecheck

build:
	npm run build

analyze:
	npm run analyze

analyze-smoke:
	ANALYZE_NUM_BRACKETS=10000 ANALYZE_NUM_WORKERS=2 npm run analyze

collision-stats:
	npm run collision-stats

collision-stats-smoke:
	COLLISION_NUM_BRACKETS=10000 npm run collision-stats

bracket-stats:
	npm run bracket-stats

bracket-stats-smoke:
	BRACKET_STATS_NUM_BRACKETS=10000 npm run bracket-stats

backtest-current-model:
	uv run python scripts/backtest_current_model.py

train-v2-model:
	uv run python scripts/train_v2_model.py

calibrate-v2:
	uv run python scripts/calibrate_v2.py

calibrate-v2-holdout:
	uv run python scripts/calibrate_v2.py --holdout-only

champion-probs:
	uv run python scripts/champion_probs.py

bracket-stats-viz:
	uv run python scripts/bracket_stats_viz.py

uv-sync:
	uv sync

verify:
	npm run typecheck
	npm run lint

# Unit + integration tests (fast, no server needed)
test:
	npm test

# Unit tests in watch mode (for development)
test-watch:
	npm run test:watch

# All tests: unit/integration + e2e
test-all:
	npm test
	npx playwright test

replay-stub:
	node scripts/analysis/espn_stub.mjs

replay-smoke:
	node scripts/analysis/replay_tournament.mjs

refresh-loop:
	bash scripts/ops/refresh_loop.sh

ops-status:
	curl -s $(ADMIN_BASE_URL)/api/stats | jq .

ops-refresh:
	curl -s -X POST $(ADMIN_BASE_URL)/api/refresh \
	  -H "Authorization: Bearer $(ADMIN_TOKEN)" | jq .

ops-refresh-no-espn:
	curl -s -X POST "$(ADMIN_BASE_URL)/api/refresh?espn=false" \
	  -H "Authorization: Bearer $(ADMIN_TOKEN)" | jq .

ops-audit:
	curl -s "$(ADMIN_BASE_URL)/api/audit?limit=$(or $(LIMIT),20)" \
	  -H "Authorization: Bearer $(ADMIN_TOKEN)" | jq .

ops-espn-names:
	node scripts/ops/espn_name_audit.mjs

test-ui:
	npx playwright test

test-ui-headed:
	npx playwright test --headed

test-ui-update:
	npx playwright test --update-snapshots
