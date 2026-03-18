.PHONY: install dev lint typecheck build analyze analyze-smoke collision-stats collision-stats-smoke verify

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

verify:
	npm run typecheck
	npm run lint
