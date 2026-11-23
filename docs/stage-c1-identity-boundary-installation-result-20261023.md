# Mitsa — Corrective Stage C1 installation: PASSED

23 October 2026. Only the explicitly approved isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`, was changed. Corrective C1 is accepted as inactive infrastructure. General registration is not operational. Stop before C2.

## Installed source and provenance

- Source: `supabase/prepared/20261023122336_mitsa_registration_identity_boundary.sql`.
- Exact local and stored migration-source SHA-256: `f9e47b2203b5ebf6ac5761a240e51dc1186113a1b21302ba43cfe710e4a276b0`.
- Recorded migration: `20261023134011_mitsa_registration_identity_boundary`; history stores one complete source statement. History now has 24 entries. Original C1 and its forward recovery remain unchanged; none was rerun.
- One private identity helper was added and five reviewed function bodies replaced: registration command, Before User Created, Send Email, current Terms and registration finalization. Exact final definitions, owners, ACLs and settings match all 23 entries in `artifacts/stage-c1-identity-boundary-manifest.json`. The manifest and reviewed SQL were not regenerated.

## Preflight and postflight

The healthy target and marker passed. Thirteen reviewed source hashes, all 22 recovered function baselines, migration order, owner capabilities, managed Auth ownership/ACLs, role attributes, helper absence and disabled controls passed before installation. Exact offline source/recovery checks passed. Both retained-account audits passed without signing in or mutating either identity.

Immediately before installation, a new uniquely named encrypted snapshot was created and decrypted/digest-verified. Its live comparison passed before and after the transaction: all rows across 41 private/foundation tables, server-computed whole-row Auth account/factor digests, relation ownership/grants, policies and column grants are identical. The private snapshot remains under ignored `.secrets`; no credential/factor secret was retrieved or printed. This is preservation evidence, not a full provider restore rehearsal or session-token backup.

Read-only postflight passed at 13:40:30 UTC; preservation passed at 13:40:38 UTC. Existing developer/Yuno accounts, verified factors, D Extacy Fireworks/L.F Fireworks ownership, memberships, locations, consent and historical rows are unchanged. No new account, encrypted-mail capture, dispatch or SMTP claim was added. No SMTP/worker/Auth experiment ran.

Both Auth hooks remained enabled before and after in the refreshed dashboard. Before User Created visibly identifies `private.mitsa_before_user_created`; the Send Email function field is browser-redacted, so its name `private.mitsa_isolated_send_email` is based on the user's same-day read-only confirmation, paired with refreshed enabled status. Redaction was not bypassed. No hook selector or provider setting was written. Hook-body compatibility is supported by exact installed definitions and offline role tests, not a new live provider hook/sign-in experiment.

## Database security

The helper is owned by existing `postgres`, SECURITY DEFINER with empty search path and row security on. Its only EXECUTE ACL entries are owner `postgres` and `app_registration`. Effective execution is false for `anon`, `authenticated`, `service_role`, `supabase_auth_admin` and `app_workspace`; PUBLIC has no grant. `app_registration` has no managed Auth-schema USAGE or private-schema CREATE, and remains NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT/NOCREATEROLE/NOCREATEDB. Managed Auth ownership/table/column grants remain unchanged. No managed Auth table or trigger was changed.

`registration_control`, `account_registration_policy` and `auth_mail_dispatch` all retain enabled and forced RLS. Anonymous, authenticated and service-role direct SELECT privileges on them remain absent. Prior business policies are unchanged. Admission, delivery, transport and session readiness remain false; generation/policies/sender/worker bindings remain null. Release and historical pilot/SMTP gates remain closed. The local engine remains legacy.

## Tests, warnings and recovery

- Fresh focused suite: **18 passed, 4 files**; JSON: `artifacts/stage-c1-installed-regression-results.json`.
- Fresh `npm run typecheck`: passed.
- Source generation `--check` and offline package/recovery `--check`: passed, no regeneration.
- Fresh hosted SELECT-only preflight, postflight, preservation and retained-account invariants: passed.
- Earlier complete suite **458 passed, 65 files** remains historical; no full suite/build/browser/live Auth experiment was repeated for this installation-only step. PGlite limitations in the approval document remain applicable.

One supplementary read-only catalog query used `generation` instead of `approval_generation` and returned SQLSTATE 42703; the corrected query passed. It changed nothing and did not indicate installation failure. The independent reviewed postflight and preservation already passed.

Security Advisor retains the existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No password setting changed. **Strict Option A remains BLOCKED** under support ticket SU-519045; neither this correction nor local test success resolves terminal refresh-family revocation. No one-hour exception is accepted.

**Recovery applied: none.** The reviewed incident recovery source remains unchanged at SHA-256 `1318721e5760988c24e169f8dcfde570496cbd9aa3f95311787a826e1833d4d6` and was not run after success. Its guarded zero-cohort/no-drift boundary remains mandatory for an actual incident; it is not routine uninstall permission.

## Next boundary

Review [Stage C2 disabled service approval](stage-c2-disabled-service-approval.md). No Edge service deployment, new secret, worker, external email, new account, engine switch, security-readiness assignment or registration activation was performed. Later provider-correlation/encryption/recovery tests and delivery/activation require separate exact budgets and approval. Strict security resolution is a separate prerequisite for activation.

Machine-readable results: `artifacts/stage-c1-identity-boundary-installation-results.json`, `artifacts/stage-c1-identity-boundary-preflight.json`, `artifacts/stage-c1-identity-boundary-postflight.json`, and `artifacts/stage-c1-identity-boundary-preservation.json`. The final function hashes remain in the unchanged reviewed manifest.
