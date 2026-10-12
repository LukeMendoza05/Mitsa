# Foundation Tasks 1–3 Implementation Plan

> For agentic workers: use Superpowers executing-plans, test-driven-development and verification-before-completion. Execute only Tasks 1–3 and stop at the checkpoint.

**Goal:** Record the approved design, bootstrap the application, and prove hosted security/server-only SSR compatibility without implementing domain modules.

**Architecture:** Next.js server with request-scoped user Supabase clients. Private PostgreSQL commands owned by non-login, non-bypass roles enforce RLS; isolated proof records test the boundaries without sales/inventory functionality.

**Tech Stack:** Node 24, npm 11, Next.js App Router, TypeScript, Supabase SSR/Auth/PostgreSQL, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-12-foundation-design.md

## Global constraints

- Tasks 1–3 only; preserve all three first-release stages.
- No existing/unrelated project access, production reset or live deployment.
- No runtime administrative Supabase credential or service-role fallback.
- Tests must use a new project and a pinned, explicit allowlist plus database identity marker.
- Dependency install scripts disabled; inspect and run only required approved tooling scripts.
- Real hosted proof is mandatory; missing credentials/infrastructure must fail visibly.

## Review focus

- A malicious target URL/ref must fail before any test mutation or privileged setup.
- Spoofed role metadata and revoked memberships must not grant access.
- Auth cookie refresh/callback errors must not leak tokens or omit no-store headers.
- Invoker wrappers must not turn private definer commands into authorization bypasses.
- Duplicate/concurrent proof commands must show one atomic effect, with rollback on failure.

### Task 1: approved documentation

- [x] Record design, traceability, decisions, scope and architecture/state diagrams.
- [x] Validate Archify candidates and inspect rendered output.
- [x] Review every first-release requirement against stage assignments.

### Task 2: bootstrap and isolated tooling

- [x] Pin dependencies, disable lifecycle scripts and commit lockfile.
- [x] Write failing target-guard tests (unapproved project, production purpose, URL/DB mismatch).
- [x] Implement fail-closed target validation and pass unit tests.
- [x] Add minimal Next.js foundation page, configuration and desktop/mobile E2E.
- [x] Use only the isolated hosted project explicitly confirmed by the user (Fire_Inv supplied by user; no project created by agent).
- [x] Add environment examples, migration/test instructions and isolated marker.

Interfaces: assertTestTarget(config) returns validated target or throws before network mutation. Runtime env contains only project URL/publishable key/site origin; privileged test/operator env stays outside app runtime.

### Task 3: database and SSR proof

- [ ] Write failing real PostgreSQL/JWT tests before creating the proof schema.
- [x] Generate migration using Supabase CLI, implement membership/RLS roles/helper/command and inspect privileges.
- [ ] Prove owner/manager/cashier, cross-shop/business denial, direct DML denial, metadata spoof, revoked membership/session denial, idempotency, rollback and concurrent row locks.
- [ ] Write failing HTTP/browser tests for signed-out/signed-in SSR, cookies, refresh, logout, forged cookies and same-origin enforcement.
- [ ] Implement only the minimum authentication compatibility harness and pass real tests.
- [ ] Run npm run test, npm run test:e2e, npm run build, npm run typecheck, npm run test:integration, npm run db:reconcile and npm audit.
- [ ] Review security boundaries and report exact evidence/blockers; stop before Task 4.

## Checkpoint evidence

List created files, configuration, executed test commands/results, grants/RLS evidence, build/typecheck outcomes and unresolved blockers. Do not claim unexecuted tests pass. No product/inventory/checkout endpoints are part of this checkpoint.
