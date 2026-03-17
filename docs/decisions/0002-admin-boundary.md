# 0002: Admin Boundary

- Status: accepted
- Date: 2026-03-17

## Context
The site will be publicly reachable, but only the owner should be able to mutate results or trigger expensive analysis.

## Decision
Keep read-only/public access narrow and protect mutating routes with a single shared admin token.

Public:
- `GET /api/stats`
- `GET /api/results`

Admin only:
- `POST /api/refresh`
- `POST /api/results`

## Consequences
- Very small auth surface for V1
- CLI and `curl` remain the primary admin interface
- No user accounts, sessions, or UI auth flows
