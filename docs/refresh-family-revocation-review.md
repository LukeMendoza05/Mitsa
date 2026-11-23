# Mitsa — review of the proposed Auth refresh trigger

**Recommendation: keep the current candidate unapplied.** The user has not approved installation. This review changes no provider configuration, existing account, MFA, workspace, membership, RLS policy or historical business record. Signup, delivery and production remain outside scope.

## 1. Exact SQL and privilege review

The complete, byte-for-byte candidate and rollback are reproduced at the end. Candidate SHA-256 remains `2e0ca4bf89cbda71b83564a268291e6666f097cb65c39da554986c213619d875`. No correction was silently substituted for the reviewed file.

- Creation requires `current_user='postgres'`, so the function would be owned by `postgres`. Read-only inspection confirms this project role has `BYPASSRLS` and is not a superuser. Managed Auth tables are owned by `supabase_auth_admin` and have RLS enabled.
- `SECURITY DEFINER` makes the trigger run with the function owner's privileges. `row_security=on` **does not remove BYPASSRLS**. This is an elevated Auth write path; calling it merely a private function understates the privilege. [PostgreSQL RLS rules](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- `search_path=''`, qualified table names and no dynamic SQL prevent caller-controlled object resolution. No token value, password or MFA secret is selected. The function accepts no arbitrary session argument.
- `REVOKE ALL` removes public/client/provider-role execution. PostgreSQL's trigger execution path still invokes it; the offline provider-writer test demonstrates this without granting direct function execution. The creation/revoke/trigger statements must be installed atomically; the file itself contains no explicit BEGIN/COMMIT wrapper.
- The UPDATE matches both `NEW.session_id` and `NEW.user_id`; it does not update by user alone. Different-user and same-user separate-session tests preserve the unrelated sessions. A mismatched refresh-row user causes no session update.
- **Preflight weakness:** the file uses PL/pgSQL ASSERT. These checks can be disabled. An offline test installed this unchanged candidate against an intentionally wrong marker with `plpgsql.check_asserts=off`. An installable revision should use explicit exceptions and independent operator target/hash checks. [PostgreSQL assertion behavior](https://www.postgresql.org/docs/current/plpgsql-errors-and-messages.html).

## 2. What was reproduced, and what is normal

Rotation is enabled and the reuse interval is 10 seconds, as read by the user without changing settings. Synthetic signed sessions exercised an old ancestor token, not merely the immediate parent of the active token.

1. Outside the interval, the ancestor request received HTTP 400 / `refresh_token_already_used`.
2. Metadata immediately afterward showed all four family records revoked, but the session row retained.
3. Inside the new post-revocation interval, use of the previously current token could obtain a replacement. After a separate 12-second wait, it was rejected.
4. An already-issued bearer still passed the existing Mitsa actor/session check while that retained row remained active.

An access JWT remaining cryptographically valid until `exp` is standard Supabase behavior, not by itself a provider vulnerability. Legitimate interval reuse and immediate-parent retries are also documented safeguards for unreliable networks and SSR. The specifically observed post-family-revocation refresh outcome warrants provider clarification; it is **not a confirmed vendor advisory/CVE**. My earlier broad "vulnerability" wording was too strong. [Supabase sign-out](https://supabase.com/docs/guides/auth/signout), [reuse and session semantics](https://supabase.com/docs/guides/auth/sessions).

The gap is relative to Mitsa's stricter requirement to deny a compromised session immediately after detected family reuse. The current read-only validator checks JWT provenance, user eligibility, session existence and `not_after`. Family revocation in this observed legacy provider path does not remove the session or set that expiry, so that particular check cannot distinguish it.

## 3. Supported alternatives tested

| Approach | Result / limitation | Managed Auth trigger needed? |
|---|---|---|
| Existing `signOut({scope:'local'})` / supported own-session logout endpoint | Tested after family revocation: exact session and refresh records removed, old Mitsa bearer denied, newest refresh rejected, second session preserved. It solves explicit logout. It does not automatically observe a direct-provider reuse attempt. | No |
| `getUser()` | Live synthetic probe still returned the correct user after the family was revoked. It verifies provider identity; in this case it is not a family-revocation detector. | No |
| Existing server-side `session_id` and expiry check | Already blocks confirmed logout immediately because the session row is gone. It cannot identify the retained active row in the observed reuse path. Keep it. | No |
| Add a read-only “has unrevoked refresh” check | Would reject the zero-live-token state, but a grace-period replacement can make it pass again. Useful only as a partial guard, not a complete fix. Requires separate review of the application validator. | No |
| Application-owned revocation ledger | Can permanently deny sessions when Mitsa records a trustworthy revocation event, with enforcement in every protected API/RLS path. Needs a reliable event source and race/coverage design. Cannot be claimed implemented or sufficient yet. | No Auth-table write trigger; separate application migration would be needed |
| Bounded JWT lifetime plus existing provider semantics | Limits the already-issued bearer window; does not promise immediate revocation or solve an unexpectedly renewable family. Requires an explicit risk/configuration decision. Current JWT lifetime was not reverified here; the email OTP's 3600 seconds is a different setting. | No |
| Provider-supported correction/release | Preferred way to address provider lifecycle semantics without taking ownership of internal Auth writes. Availability and compatibility for this project need confirmation; no undocumented setting or upgrade is assumed. | No custom trigger |

Use local scope for ordinary sign-out. Switching to global scope would unnecessarily revoke other legitimate sessions and would still require detecting the security event first. Do not replace the current working logout flow.

Evidence: `artifacts/refresh-revocation-alternatives.json`, the two interval reproductions, normal concurrent-refresh/parent-retry baseline and actual Yuno session-correlation report. No human credential was retained or replayed for the alternatives test.

## 4. Rotation, concurrency, MFA, recovery and upgrades

The nine original offline cases model normal revoke-and-replace in one deferred transaction. The unmodified provider's concurrent normal refresh and delayed legitimate-parent retry also passed. **Neither proves that this uninstalled trigger is compatible with all live Auth paths.**

The additional adverse test demonstrated a false expiry: when a normal rotation transaction uses `SET CONSTRAINTS ALL IMMEDIATE`, the trigger runs after revocation but before replacement insertion. The new token then exists, but the session has already been expired. PostgreSQL explicitly allows deferred constraint triggers to be forced immediate. This has not been observed in the current provider; it is a demonstrated compatibility dependency. [Constraint trigger timing](https://www.postgresql.org/docs/current/sql-createtrigger.html).

MFA and password recovery can rotate or revoke provider credentials. The trigger cannot identify the reason; it interprets any fully revoked family as terminal. The exact new trigger has not been tested through hosted MFA/recovery because installation is not approved. Existing successful MFA/recovery tests are baseline evidence, not tests of this trigger.

Supabase permits custom triggers on `auth.refresh_tokens`; permission to create one is not a promise that its internal lifecycle is stable. Supabase warns that managed columns, constraints and other objects may change. A newer provider token format may not update these legacy rows at all. The trigger would then be ineffective rather than automatically becoming compatible. [Allowed customizations](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025), [managed-object compatibility warning](https://supabase.com/docs/guides/auth/managing-user-data).

## 5. Scope, locking and performance

The target UPDATE can affect at most the matching session primary-key row; separate same-user and different-user sessions are preserved in offline tests. Ordinary clients lack Auth-table write access and direct function execution, so they cannot supply a different NEW row through normal APIs.

The existing `(session_id, revoked)` index supports the live-token existence check. Normal rotation adds one deferred row event and an indexed lookup. A fully revoked family also updates/locks its session row, writes WAL and may wait for concurrent Auth work. Multiple matching row events can repeat the lookup; exact overhead under project load is unmeasured. No latency or throughput guarantee is justified.

The absence check and session UPDATE are separate statements. There is no explicit session lock before the check or predicate lock preventing another transaction from inserting a replacement. Correctness relies on provider transaction and lock ordering. Current upstream refresh code uses locked lookups, but that source is not a pinned proof of every path in this deployed service. An added refresh-row-to-session write can introduce contention or lock-order/deadlock risks with maintenance or other Auth flows. Those risks were not disproved by the offline single-connection tests. DDL installation/removal can also briefly block Auth writes.

The trigger introduces a new synchronous dependency in provider transactions. Permission errors, schema drift, timeouts or SQL errors can fail refresh/authentication transactions; broad exception swallowing would instead hide failed security enforcement. Neither is an acceptable substitute for compatibility evidence.

## 6. Rollback and remaining limitations

The exact rollback drops only the new trigger and function. It deletes no account, factor, membership, workspace or business record and restores the original schema behavior for future transactions. Normal untouched sessions remain valid.

**It cannot restore the previous `not_after` of a session already expired by a false positive.** The candidate stores no previous value, and the encrypted snapshot is catalog recovery, not a backup of future sessions. Such a user would need ordinary sign-in again with the same MFA. Therefore I cannot confirm the stronger guarantee that rollback will preserve every legitimate session if the trigger misclassifies one. Resetting factors, re-creating accounts or blindly clearing expiries is not an acceptable rollback.

Even a successful trigger would not alter JWT signatures/`exp`, cancel requests already in flight, protect an endpoint that omits the session check, cover unrelated services solely validating JWTs, or prevent theft of an active device/session. It observes only the specified legacy revoked-flag transition and performs no historical backfill. MFA, tenant RLS, enumeration resistance, rate limits and leaked-password protection remain separate concerns.

## 7. Recommendation and evidence

Keep this candidate unapplied. Retain the working supported local logout and current read-only session validation. Prepare a sanitized provider reproduction for clarification of the family/grace outcome; no support message has been sent or authorized. If immediate application-wide revocation remains mandatory, review an application-owned enforcement design and dependable event source before choosing an Auth-table write trigger. Merely reducing token lifetime or checking getUser must not silently be counted as satisfying immediate revocation.

Do not waive the registration security gate in this review. No new installation approval is requested while the current draft has the demonstrated preflight/timing weaknesses and rollback limitation.

### Deployed version and safer-alternative follow-up

Read-only inspection of the isolated Auth health endpoint reports **v2.197.0**. The matching upstream release resolves to commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`; public source files and their hashes are recorded in `artifacts/auth-provider-version-review.json`. The deployed binary was not checksum-verified against upstream, so source correspondence remains a qualified inference.

That source includes a legacy path which revokes family records and a newer-format path which deletes the session on disallowed reuse. No supported hosted-project switch or guaranteed corrective rollout has been established. Do not modify undocumented provider settings based on this source inspection.

The [sanitized provider reproduction](supabase-refresh-reuse-reproduction.md) is ready for review and has **not been sent**. The [application-owned alternative assessment](application-revocation-alternative-feasibility.md) explains why a denylist without a complete, trustworthy provider-event source cannot yet satisfy immediate denial for direct Auth requests. Both documents preserve the distinction between normal JWT lifetime and the stricter Mitsa terminal-revocation requirement. No external message, installation or activation is included.

Review validation: 13 offline assertions passed, including **two successful reproductions of adverse conditions**, not 13 safety approvals. The live supported-API alternatives probe passed with one new example.invalid identity and no email. Current target/absence/closed-gate checks confirm the function and trigger remain uninstalled. The original protected account/workspace baseline remains the preservation reference.

Commands:

```powershell
npx vitest run --project unit tests/unit/refresh-revocation-guard.test.ts
npx vitest run --project integration tests/integration/refresh-revocation-alternatives.test.ts
node scripts/verify-refresh-revocation-candidate.mjs
node scripts/verify-reset-preservation.mjs
npm run typecheck
```

## Appendix — exact unchanged SQL

The following source is inserted directly from the reviewed files, without reformatting.

```sql
-- UNAPPLIED REVIEW CANDIDATE. Requires separate explicit approval.
-- Approved isolated target only; no account, factor or business-data mutation.
do $$ begin
 assert current_user='postgres','approved operator required';
 assert (select marker='fireworks-foundation-proof-01a12e38' from foundation_probe.environment_identity where singleton),'isolated target marker mismatch';
 assert (select encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')='587affbee9b5b7bf9cfd3b8bf343eda75626ec0fb9b886b9f3c370995182d652' from pg_proc where oid='private.current_actor()'::regprocedure),'actor definition differs from reviewed baseline';
 assert to_regclass('private.session_revocations') is null,'revocation ledger already exists';
 assert not exists(select 1 from pg_trigger where tgrelid='auth.refresh_tokens'::regclass and not tgisinternal),'Auth refresh trigger set changed';
end $$;

create function private.mitsa_expire_revoked_refresh_family() returns trigger
language plpgsql security definer set search_path='' set row_security=on as $$ begin
 if TG_TABLE_SCHEMA<>'auth' or TG_TABLE_NAME<>'refresh_tokens' or TG_OP<>'UPDATE' then raise exception 'invalid trigger context' using errcode='42501'; end if;
 if NEW.session_id is not null
 and not exists(select 1 from auth.refresh_tokens r where r.session_id=NEW.session_id and not r.revoked) then
  -- A fixed expired instant avoids provider/application clock skew reopening
  -- the already-revoked session. This does not change code or JWT lifetimes.
  update auth.sessions s set not_after='1970-01-01 00:00:00+00'::timestamptz
   where s.id=NEW.session_id and s.user_id::text=NEW.user_id::text
   and (s.not_after is null or s.not_after>'1970-01-01 00:00:00+00'::timestamptz);
 end if;
 return NEW;
end $$;
revoke all on function private.mitsa_expire_revoked_refresh_family() from public,anon,authenticated,service_role,supabase_auth_admin,app_workspace,app_authz,app_command;
-- Deferred until the provider transaction completes: normal rotation has a
-- replacement token; family revocation commits with none. No token value is read.
create constraint trigger mitsa_refresh_family_revocation
after update on auth.refresh_tokens deferrable initially deferred
for each row when (OLD.revoked=false and NEW.revoked=true)
execute function private.mitsa_expire_revoked_refresh_family();
```

Exact rollback:

```sql
-- Close registration/delivery before rollback.
-- Remove only the new Auth write dependency. Keep already-expired sessions
-- expired: restoring revoked access is not a valid rollback. New password
-- sign-in creates an independent session using the existing authenticator.
drop trigger if exists mitsa_refresh_family_revocation on auth.refresh_tokens;
drop function if exists private.mitsa_expire_revoked_refresh_family();
```
