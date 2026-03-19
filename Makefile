.PHONY: install dev lint typecheck build analyze analyze-smoke collision-stats collision-stats-smoke backtest-current-model train-v2-model calibrate-v2 champion-probs verify replay-stub replay-smoke refresh-loop ops-status ops-refresh ops-refresh-no-espn ops-audit ops-result ops-db

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

backtest-current-model:
	python3 scripts/model/backtest_current_model.py

train-v2-model:
	python3 scripts/model/train_v2_model.py

calibrate-v2:
	python3 scripts/model/calibrate_v2.py

calibrate-v2-holdout:
	python3 scripts/model/calibrate_v2.py --holdout-only

champion-probs:
	python3 scripts/model/champion_probs.py

verify:
	npm run typecheck
	npm run lint

replay-stub:
	node scripts/analysis/espn_stub.mjs

replay-smoke:
	node scripts/analysis/replay_tournament.mjs

refresh-loop:
	bash scripts/ops/refresh_loop.sh

ops-status:
	bash scripts/ops/admin.sh status

ops-refresh:
	bash scripts/ops/admin.sh refresh

ops-refresh-no-espn:
	bash scripts/ops/admin.sh refresh-no-espn

ops-audit:
	bash scripts/ops/admin.sh audit "$(LIMIT)"

ops-result:
	bash scripts/ops/admin.sh result "$(ACTION)" "$(GAME)" "$(ROUND)" "$(TEAM1)" "$(TEAM2)" "$(WINNER)"

ops-db:
	bash scripts/ops/db.sh summary
