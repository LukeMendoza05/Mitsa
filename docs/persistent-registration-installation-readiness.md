# Mitsa — Stage C installation-readiness review

**Current installed checkpoint:** the explicitly approved [corrective C1 installation passed](stage-c1-identity-boundary-installation-result-20261023.md) as migration `20261023134011`. Exact reviewed hashes, function privileges, forced RLS and preservation passed. No recovery followed success. [C2 disabled service deployment/private signer configuration](stage-c2-disabled-service-approval.md) requires separate approval. Strict Option A remains unresolved; registration/mail stay disabled. The original and prepared-state observations below are historical.

**Later 23 October outcome:** approved candidates committed, failed effective Auth schema USAGE postflight and underwent the authorized exact forward recovery. Original functions/data are preserved, controls closed, C1 not accepted. [Current installation/recovery result](stage-c1-installation-result-20261023.md) supersedes the readiness statements below. No C2/activation approval; do not rerun the original candidates.

**Current preflight — 23 October:** the [actionable installation checkpoint](registration-installation-next-steps-20261023.md) supersedes the dated hosted observations below. Fresh read-only catalog, migration, permission/collision and preservation checks pass. The user confirmed both existing Auth hooks enabled with the reviewed selectors; neither was changed. The two candidate SQL hashes remain unchanged. Inactive C1 is ready for its separate approval, with fresh drift/snapshot checks still required immediately before installation. Strict Option A remains unresolved and selected; no registration, worker or delivery activation is authorized.

**22 October checkpoint:** the exact SQL/config/Edge package still matches the reviewed manifest in an offline PostgreSQL execution and zero-cohort recovery check. New negative installation guards and current local checks are in [the follow-up report](registration-readiness-20261022.md). Supabase support was submitted by the user, with support access OFF. Hosted observations below are dated 16 October and must be refreshed immediately before any approved installation; this continuation performed no hosted inspection or mutation. Only Strict Option A is accepted.

16 October 2026. **Prepared for review; no live installation or activation authorized.** Stage B strict Option A is selected; the provider correction remains unresolved. A disabled installation can be considered separately, but cannot establish session-policy readiness or authorize signup/email.

## Exact package

| Order | SQL | SHA-256 |
|---|---|---|
| 1 | `supabase/prepared/20261016004927_mitsa_persistent_registration_inactive.sql` | `94ed8deb2f9f41e694b0d45721ef7e6e086919565e9832bd73d1b9c77b393422` |
| 2 | `supabase/prepared/20261016005221_mitsa_persistent_registration_hooks_inactive.sql` | `9ce542c21d00dc350f43b7e72fba2083d43042f2d001361cb9940e4120290ae7` |
| Forward recovery | `supabase/prepared/persistent-registration-forward-recovery.sql` | `556516507c2331b0500c7a3542511a1296f2379a685fe7431571e87798782a58` |
| EXCLUDED session proposal | `supabase/security-proposals/one-hour-development-session.sql.txt` | `d75e725a24782ce301b8a766f1ff4e25cfe059b7a97977253746a70d5eb136dc` |

All four SQL sources are unchanged from Stage A. The updated manifest `artifacts/persistent-registration-stage-c-manifest.json` now covers eleven files and seventeen effective functions. The preserved Stage A manifest reference is `artifacts/persistent-registration-stage-a-manifest-reference.json`.

The configuration proposal changed only to record the confirmed hook/quota and retire the unnecessary proposed callback addition. Its current SHA-256 is `1155238fb166d044ea0674a83064e7861ed8d09b6160446671f2320c86f98f31`. The new pinned Edge `deno.lock` hash is `ce70e91004a0d31208a73048996e177b3adebb246cc1a422ace2c4e247d9b825`. These are review changes, not deployed settings. No numbered migration was regenerated or replaced.

## Installed-target verification

Read-only checks matched project `mjtejwafxriwntweussc` and marker `fireworks-foundation-proof-01a12e38`. The existing actor and both hook/Terms/finalization definitions, owners and ACLs match their five-function baseline. All release gates and the old pilot remain closed; there are three historical SMTP claims and zero custom refresh-table triggers. Persistent controls are not installed and the new private service is not deployed.

The original developer preservation baseline still matches the account, verified factor and eleven application/history rows. Yuno's verified identity, trusted factor, sole workspace ownership, membership/location identifiers and creation audit also match. The latter is an invariant audit, not a full-row historical snapshot. No retained session was replayed or revoked.

| Integration question | Current evidence | Remaining condition |
|---|---|---|
| Hook pointer/quota | User read-only dashboard confirmation: `private.mitsa_isolated_send_email`; 100 Auth emails/hour. Before-user hook remains `private.mitsa_before_user_created`. | Recheck immediately before installation; change neither pointer. |
| Redirect correlation | Dashboard Site URL is exact loopback origin; reported-version source preserves its query into the hook payload. Existing `/auth/confirm` and `/auth/email` callbacks remain. Canonical parser rejects other ports/schemes/paths, IPv6 and duplicate parameters. | Actual hosted hook round trip with an approved new fixture. No allowlist addition is proposed. |
| Real encryption | SELECT-only hosted pgcrypto encryption decrypted correctly with the private key kept local. | New hook/capture/dispatch/worker chain with an approved fixture, not just cryptographic interoperability. |
| Edge compatibility | Deno 2.9.7 checks the locked package; two actual-entrypoint fail-closed tests pass with network/run denied and only public module graph/cache readable. | Approved Supabase bundling/deployment and hosted runtime smoke checks. Local Deno is not an attestation of the hosted Edge build. |
| Privileges/RLS/recovery | Exact candidates execute in offline PGlite; three new private tables have forced RLS; original actor is unchanged; zero-cohort and retained-cohort recovery are covered. | Recheck grants, object collisions, constraints and actor/business RLS after any approved installation. |
| Session boundary | Fresh catalog graph finds all 42 authenticated-only RPCs reaching the actor; separate review-only tests exercise owner/RLS denial after one hour. | Stage B decision and signed-JWT tests across affected paths. No age policy is installed. |

The provider remains signup-enabled with mandatory confirmation, six-digit/3,600-second OTPs, 3,600-second JWTs and reuse detection/ten-second interval. Global CAPTCHA remains off while Mitsa's server validator and strict signup hook provide the reviewed path. Secure email change is on. The separately approved current-password requirement is now retained on after all ten hosted compatibility checks passed; secure-password-change remains off. Do not toggle global CAPTCHA or password settings under a Stage C database approval.

## Effects, permissions and installation order

The first candidate adds three private forced-RLS tables, nullable intent extensions, a non-login non-bypass-RLS command role and tightly scoped command/worker functions. Controls default false with no generation, policies, worker or transport readiness. The second replaces only the existing hook bodies and cohort-aware Terms/finalization, preserving legacy definitions and pointers. There is no account/cohort backfill, Auth-table write, managed trigger, membership/ownership change or business RLS rewrite.

Effective owners, ACLs and security paths are itemized in [the exact approval package](persistent-registration-stage-c-approval.md) and manifest. Public clients receive coarse readiness only; the new role cannot assign policies or write Auth accounts; the private service requires its distinct project-bound HMAC/replay checks. Operator worker permissions remain separate from Next and workspace roles.

Before an approved installation: recheck exact target/marker, SQL/config hashes, installed definitions/ACLs, migration history and object collisions; take and validate a fresh encrypted preservation/recovery baseline covering both retained accounts and workspaces; confirm no unexplained data changes and all controls closed. Stop on drift. Apply candidate 1, verify its transaction and closed defaults, then candidate 2 and verify compatibility/permissions. Never use a broad push of all prepared SQL. Do not include the session proposal or rejected Auth trigger.

Private-service deployment, protected secret configuration and synthetic compatibility tests are separately reviewable operations. A database-only approval must not be interpreted as authorizing them. Neither database installation nor a disabled service deployment authorizes assigning live policy versions, launching a worker or opening admission/delivery.

## Recovery and acceptance

Both candidates are transactional. A failed candidate rolls itself back; do not continue to the next one. Prepared forward recovery stops controls, retains all evidence and restores legacy hook bodies; cohort-aware consent/finalization remain when new cohorts exist. Do not delete tables/history, reset accounts, roll back to an app that strands pending accounts, or remove a later approved session bound without denying the affected cohort. Shutdown cannot recall SMTP mail or revoke provider sessions.

Installation acceptance requires unchanged retained data/actor/business RLS, exact privileges, forced RLS, empty prospective cohort/dispatch state and every control still disabled. Operational acceptance belongs to separately approved Stages D–F. This review does not claim general registration, recovery inbox delivery or persistent production readiness.
