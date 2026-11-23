# Mitsa — Stage C1 installation and scoped recovery

**Superseded hosted checkpoint:** the explicitly approved [corrective identity-boundary installation passed](stage-c1-identity-boundary-installation-result-20261023.md) as migration `20261023134011`. This report preserves the original C1 failure/recovery history; its recovered-state observations are historical. Registration and delivery remain disabled. No incident recovery followed the successful correction.

23 October 2026, Asia/Manila. **The exact approved candidates committed, but C1 failed postflight acceptance. The approved forward recovery succeeded. Stop before C2. General registration is not operational.** Strict Option A remains unresolved under ticket SU-519045; no session exception was accepted.

## Exact operations and source provenance

Only isolated project `mjtejwafxriwntweussc`, marker `fireworks-foundation-proof-01a12e38`, was used. Supabase recorded the following migrations. Each history entry stores one complete statement source; SHA-256 of the stored source exactly matches its reviewed file, including the recovery source.

| Recorded version | Name / source | SHA-256 |
|---|---|---|
| `20261023120006` | `mitsa_persistent_registration_inactive` — `supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql` | `94ed8deb2f9f41e694b0d45721ef7e6e086919565e9832bd73d1b9c77b393422` |
| `20261023120032` | `mitsa_persistent_registration_hooks_inactive` — `supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql` | `9ce542c21d00dc350f43b7e72fba2083d43042f2d001361cb9940e4120290ae7` |
| `20261023120921` | `mitsa_persistent_registration_c1_forward_recovery` — `supabase/prepared/persistent-registration-forward-recovery.sql` | `556516507c2331b0500c7a3542511a1296f2379a685fe7431571e87798782a58` |

No unrelated historical migration, one-hour proposal, managed Auth trigger, deployment or provider-setting change was applied. The reviewed source files, manifest and configuration proposal were not rewritten. Their original “prepared/not installed” labels are historical source-review labels; this result and hosted history describe the current state. Do not rerun the original CREATE ROLE/table candidates against the retained inactive objects.

## Preflight evidence and the missed prerequisite

The implemented checks passed: healthy exact project/marker; twenty prior migrations; five baseline function definition hashes/owners/ACLs; absent new tables/role/columns/functions and no collisions; role creation/private/API schema creation and workspace-role assumption; closed release/pilot controls; zero custom refresh triggers. Both original preservation audits passed. No actual registration/mail worker was running (the audit's own PowerShell process was excluded).

A fresh repeatable-read, read-only snapshot covers every existing private/foundation table row, function/security catalog, and server-computed Auth user/factor row digests. Passwords and TOTP secrets were not retrieved. The snapshot was encrypted locally, decrypted and digest-checked; its manifest is Git-ignored. No unknown account outside the existing signed-registration/synthetic/private-identity evidence or unexpected business was found. This is a preservation snapshot with tested forward recovery, not a full provider disaster-restore rehearsal.

**Preflight was incomplete:** it did not test whether the installing operator could grant USAGE on the managed `auth` schema. That omission allowed the approved transaction to commit before the missing effective permission was discovered. `scripts/stage-c1-installation-audit.mjs` now requires `has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION')` before installation; false or unknown stops locally. A regression test covers that guard. It does not manufacture the missing privilege or silently revise the approved SQL.

## Actual installation failure

The candidate requests `GRANT USAGE ON SCHEMA api,auth TO app_registration`. Hosted `auth` is owned by `supabase_admin`. The installing operator has USAGE but lacks its grant option, so the requested Auth schema grant was ineffective without aborting the transaction. Read-only postflight proves:

- `has_schema_privilege('app_registration','auth','USAGE') = false`.
- `has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION') = false`.
- New command functions that read `auth.users` cannot be accepted as operational under that role.

This is a separate C1 permission failure, not the refresh-family security issue and not an account/MFA corruption. It is not fixed by selecting the new engine or deploying the Edge function. No substitute grant, role escalation, schema-owner change or new helper was installed.

Other initial comparison stops were audit representation differences: pg returns `name[]` policy roles as text while PGlite returns arrays; PostgreSQL 18 catalogs NOT NULL separately while hosted 17 uses `attnotnull`; and a non-superuser CREATEROLE creator receives an automatic operator ADMIN membership. The audit normalizes role arrays, independently checks every NOT NULL column flag, and checks the exact operator grantor/ADMIN/SET/INHERIT rows. It still rejects actual changed principals/predicates. The automatic operator-only membership follows [PostgreSQL's documented role-creation semantics](https://www.postgresql.org/docs/17/role-attributes.html); it grants no browser, workspace or platform-user role. None of these audit corrections masks the missing Auth schema USAGE.

## Recovery and final database state

Before recovery, seventeen manifest function hashes/owners/ACLs and four legacy copies matched; the three new tables had disabled controls and zero cohorts/dispatches. The incident met the documented forward-recovery prerequisites. The exact authorized recovery transaction committed, without deleting tables/history or altering retained accounts.

Read-only recovery postflight passed:

1. All five original actor/hook/Terms/finalization definitions, owners, ACLs and settings are restored. Four legacy copies and thirteen other reviewed function definitions remain intact.
2. All previous private/foundation rows match the fresh encrypted snapshot (new intent columns remain null). Full Auth user and factor digests are unchanged. The older developer baseline and Yuno's independent identity/trusted-factor/sole-owner/location checks also pass.
3. All old policies/business RLS, existing grants, columns, constraints, indexes, roles and triggers remain unchanged. New private additions match the reviewed inactive package plus documented operator semantics; the missing Auth USAGE remains an explicit failed requirement.
4. All three new tables retain enabled/FORCE RLS. Browser and service roles have no direct new-table privileges; all twelve browser/service worker-execution checks deny. No custom Auth trigger exists.
5. Admission, delivery, transport and session readiness remain false; generation, policies, sender and worker remain unassigned. Recovery sets a stop timestamp. Cohort/dispatch tables remain empty; public readiness says admission/delivery `closed`. No account, captured message or SMTP claim was added. No worker, Edge service, signer or runtime-engine switch was activated.

Recovery acceptance is **not** C1 installation acceptance. `artifacts/stage-c1-recovery-postflight.json` deliberately records `passed:false`, `recoveryPassed:true`, `c1InstallationAccepted:false` and the unresolved permission finding. This prevents a restored safe state being mistaken for operational registration.

Both hook cards remain enabled; the visible Before User Created selector matches. Send Email's function value is redacted by the browser, so its name relies on the user's same-day read-only confirmation plus absence of any pointer/configuration write. Visible email settings match before/after: provider enabled, secure email change on, current-password requirement on, secure-password-change off, leaked-password protection off, six-digit OTP and 3,600-second expiry. No JWT/reuse/CAPTCHA/rate/SMTP/support-access setting was changed or claimed independently re-read when not exposed.

## Local verification and limitations

Final focused suite: **40 tests passed across five files** (package review, installation guards, original login independence, persistent SQL and new catalog/grant guard cases). TypeScript passed. The eleven-file package/source/zero-cohort offline-recovery check passed unchanged. Initial sandbox temporary-file failure was resolved by using an ignored writable test temp directory; no application assertion was removed. The new test's array-OID typing was corrected and TypeScript rerun successfully.

Anonymous GET `/login` and `/signup` both return 200; login fields render, signup is closed with a disabled fieldset. No form was submitted. Restored functions and route regressions support legacy compatibility; neither retained user's live password/MFA session was exercised. No new hosted Auth experiment, OTP, recovery link or external message was requested. Full application build/browser suites were not repeated for operator/test/documentation-only work.

Security advisor now reports the existing [leaked-password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), with no new RLS warning. The earlier pilot-mail no-policy informational notice disappeared because the reviewed package added its narrowly scoped registration-role SELECT policy. No setting was changed to suppress an advisor.

Evidence: `artifacts/stage-c1-preflight.json`, `artifacts/stage-c1-installation-result-20261023.json`, `artifacts/stage-c1-recovery-postflight.json`, `artifacts/stage-c1-local-pages.json`, both existing preservation reports, and the Git-ignored encrypted baseline. Intermediate catalog-comparison evidence is retained as diagnostic history, not current success evidence.

## Exact next boundaries

| Order | Needed work | Approval boundary |
|---|---|---|
| 1 | Review a corrective **forward** C1 permission design against retained inactive objects. Options are a provider-supported authorized schema grant or a narrowly scoped private identity-read function using an existing permitted role. Prefer reviewing the private boundary to avoid another managed-schema dependency; neither is implemented/approved here. Restore the reviewed persistent hook bodies only in the approved correction. | New exact SQL/hashes, effective grants, compatibility tests, snapshot and recovery review; explicit approval before hosted change. Original C1 approval must not be reused for altered SQL. |
| 2 | After corrected C1 passes, deploy only the disabled `mitsa-registration-service` and configure its private project-bound signer; preserve legacy service and hooks. | Separate C2 deployment/secret approval; disabled-by-default hosted smoke protocol. |
| 3 | Verify hosted signed-intent/callback/capture/dispatch binding, OTP/resend/recovery, direct bypass/tenant denial and MFA/Owner compatibility. | Separate disposable identities and bounded provider-request authorization; no retained account mutations. |
| 4 | Review worker supervision, transport health/quotas and approved recipient/attempt capacity; then real inbox, outage/restart and end-to-end tests. | Separate worker/external-email approval. No automatic mail or lease reopening. |
| 5 | Activate persistent ordinary-address admission only after the selected strict guarantee and all integration/security gates pass. | Strict Option A remains BLOCKED on SU-519045 and supported, separately approved hosted regressions. No residual risk, production or public hosting approval follows from C1. |

Stop after recording recovery and preservation. Do not proceed automatically to a corrective hosted migration, C2, new identities, email, a session-policy exception or activation.
