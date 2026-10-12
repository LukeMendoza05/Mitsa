# Task 3 private authentication adapter

Approved scope: repair and verify Tasks 1–3 only. This does not authorize Task 4 or deployment.

## Investigation and decision

Inspection of Fire_Inv's deployed function definitions, ACLs, role memberships, policies, Auth columns and authenticator settings confirmed the missing managed-schema USAGE. Both business roles remain NOLOGIN/NOBYPASSRLS. The existing postgres operator can read the needed Auth columns but cannot delegate schema USAGE. No additional managed-schema grants or role inheritance are proposed.

One additive migration introduces `private.current_actor()` owned by postgres. This is a deliberately elevated **authentication-only** exception: the function contains fixed, qualified SELECTs against Auth, accepts no parameters, returns one UUID or null, performs no mutations, and references no business table. Its owner bypasses Auth RLS; business authorization and mutations continue in the original non-bypass roles with FORCE RLS. Existing applied migrations are unchanged.

Only authenticated, app_authz and app_command receive EXECUTE (plus the owner). The adapter is outside the only exposed API schema. Anonymous/PUBLIC have no grant. No role gains CREATE on its schema, function ownership, SET ROLE, Auth table access or business bypass privileges.

## Trusted request boundary

JWT signature validation belongs to PostgREST. The adapter additionally requires session_user=authenticator and transaction role=authenticated, then reads only request.jwt.claims (not legacy per-claim settings or request headers). Direct operator SET ROLE/copied-claim connections are deliberately denied. No exposed function accepts an actor/session argument or permits arbitrary SQL/GUC changes.

It validates claim types, authenticated role/audience, non-anonymous status, expiration and optional not-before. Actor/session UUIDs must join the same live Auth user/session. Deleted, banned, anonymous users and sessions whose not_after has elapsed are rejected; missing or revoked sessions return null. Malformed JSON/UUID/numeric values return null. No token/session row is returned or logged.

The identity wrapper and all actor-dependent business policies/functions use this adapter. The synthetic capabilities wrapper returns only two current-user booleans so owner-only price authority and manager discounts can be verified with real signed requests. It accepts business/shop identifiers, never an identity. It is not a product-management feature.

## Reviewed Auth cleanup and test boundaries

The migration removes only our obsolete foundation_current_session policy and its app_authz SELECT(id,user_id) grant. No platform policy, Auth function, table owner or RLS flag changes. Revocation/expiry tests alter only their synthetic user's session not_after or user status, restoring previous values in finally; real Auth sign-out proves actual session removal. Recovery expiry similarly backdates only a synthetic user's recovery_sent_at and restores it. No global Auth timeout or production data is changed.

Concurrency proofs send real user JWTs through HTTP while independent operator connections hold/observe database locks. They no longer treat copied claims on an operator connection as authenticated requests. Reconciliation must contain committed events and matching command results; an empty ledger fails.

## Residual trust and review gates

The operator, JWT signing authority and PostgREST infrastructure remain trusted. An operator able to replace functions or alter Auth state is outside the ordinary-client threat model. Future exposed RPCs must not permit arbitrary SQL, request-context setters, or caller-chosen identity; otherwise the context boundary would be compromised. No authenticated database login is supported. Revalidate adapter compatibility after Supabase Auth/PostgREST upgrades and restore drills.

The adapter checks state at the protected statement's snapshot; revocation denies subsequent requests, not transactions already in flight. Managed session not_after is enforced immediately; provider inactivity/single-session settings otherwise retain Supabase's documented refresh semantics. Backup restoration and all later domain release tests remain separate pre-live gates.

Sources: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [database function privileges](https://supabase.com/docs/guides/database/functions), [PostgREST authentication and verified claims](https://docs.postgrest.org/en/stable/references/auth.html). Current changelog reviewed; the PostgreSQL 17.11 notes concern extension indexes/operators and do not change this function approach.
