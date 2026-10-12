# Fireworks operations foundation

Next.js App Router, TypeScript and Supabase foundation. Only Stage 1 Tasks 1–3 are authorized. Product management, inventory and checkout are not implemented. All three first-release stages remain in the approved design.

- [Approved architecture](docs/superpowers/specs/2026-10-12-foundation-design.md)
- [Requirements and stages](docs/requirements-traceability.md)
- [Implementation plan](docs/superpowers/plans/2026-10-12-foundation-proof.md)
- [Diagrams](docs/diagrams.md)
- [Local setup and credential boundaries](docs/local-setup.md)
- [Execution ledger](docs/progress.md)
- [Tasks 1–3 verification checkpoint](docs/foundation-checkpoint.md)

Use Node 24 and npm 11.19.0. Run `npm ci`, `npm run typecheck`, `npm run build`, then `npm run test`. Lifecycle scripts are disabled. `npm run test:e2e`, `npm run test:integration`, `npm run test:security` and `npm run db` (alias of `npm run db:reconcile`) are independently runnable. Hosted tests require the explicit isolated target and operator credentials; missing configuration fails rather than silently skipping.

No live deployment, database reset or production testing is authorized. The synthetic foundation probe is not an inventory or sales module and does not prove future checkout correctness.
