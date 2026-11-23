# Mitsa isolated workspace migration recovery

Only `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`, is authorized. Production migrations remain prohibited.

Before applying, run `node scripts/workspace-preflight.mjs`. It refuses non-synthetic accounts, unexpected business names or Storage objects and saves the original private/probe rows, function definitions/owners/grants and migration history under ignored `.secrets/recovery/`. It never exports Auth password hashes, tokens, MFA secrets or sessions. Record its digest. The current migration changes no managed Auth rows.

The migration tool applies each migration transactionally; an error before commit must roll back that migration. Verify its history after an uncertain result; never blindly retry. Local PostgreSQL tests execute the actual migration and exercise constraint failures before hosted application.

After commit, do not reset or restore an entire project. If a regression occurs:

1. Stop new application commands and leave public registration/email/publication gates disabled.
2. Verify the target and migration history. Reconcile original IDs, relationships and probe history against the private snapshot.
3. Prefer a reviewed forward repair. Additive schema and original records remain available.
4. If reverting authorization is necessary, prepare a compensating migration from the captured function definitions and original per-membership roles. Restore each original membership's own role; do not globally map Admin to manager because new memberships could exist. Keep new records and audit evidence until an explicit disposal decision.
5. Revoke execution of new command entry points before reverting dependent helpers. Do not drop tables, delete new memberships, disable RLS or change managed Auth to make a rollback pass.
6. Test the compensating migration in disposable PostgreSQL and obtain approval for any destructive cleanup. Verify isolated integration/security suites and reconciliation before reopening development access.

This snapshot is an isolated migration recovery aid, not the production backup system. Production backup/restore and retention remain separate release prerequisites.
