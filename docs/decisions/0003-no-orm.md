# 0003: No ORM

- Status: accepted
- Date: 2026-03-17

## Context
The schema is small, stable, and local to one SQLite file. The project is time-sensitive and operational simplicity matters more than abstraction.

## Decision
Use direct SQL via `better-sqlite3` instead of introducing an ORM or migration framework for V1.

## Consequences
- Fewer moving parts and easier debugging on the live machine
- Schema changes must be handled manually and carefully
- DB access remains explicit in `lib/db.ts`
