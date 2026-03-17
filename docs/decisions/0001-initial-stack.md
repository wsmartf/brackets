# 0001: Initial Stack

- Status: accepted
- Date: 2026-03-17

## Context
The project needs to be built quickly, run on a single self-hosted Mac, and remain easy to debug during the tournament.

## Decision
Use:
- Next.js app router for UI and API routes
- SQLite for local persistence
- `better-sqlite3` for synchronous DB access
- Node worker threads for parallel bracket analysis
- a monolithic app instead of split services

## Consequences
- Simple deployment and low operational overhead
- Easy local inspection of runtime state
- Analysis work stays on the web host unless changed later
- Not designed for horizontal scaling
