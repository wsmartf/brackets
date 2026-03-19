.PHONY: install dev lint typecheck build analyze analyze-smoke collision-stats collision-stats-smoke backtest-current-model train-v2-model verify replay-stub replay-smoke

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
	python3 scripts/backtest_current_model.py

train-v2-model:
	python3 scripts/train_v2_model.py

verify:
	npm run typecheck
	npm run lint

replay-stub:
	node scripts/espn_stub.mjs

replay-smoke:
	node scripts/replay_tournament.mjs
