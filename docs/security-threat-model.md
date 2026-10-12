# Foundation threat model

Assets: Auth tokens, staff/shop authority, future customer and financial data, administrative credentials and test-environment isolation.

| Boundary | Abuse case | Required proof |
|---|---|---|
| Browser -> Next.js | Forged cookie, metadata role, CSRF or malformed input | Signature/user validation, same-origin rejection, allowlisted input |
| Next.js -> Supabase | Shared client leaks another identity; response caches refreshed tokens | Concurrent distinct sessions, request-scoped clients, no-store and cookie tests |
| JWT -> RLS | Signed-out/revoked member or session retains token | Live session/membership lookup; revocation tests |
| Invoker -> private command | Direct RPC bypasses app permission | DB role/shop checks and no public/anonymous execute |
| Definer -> tables | Table ownership/BYPASSRLS bypasses policy | Catalog inspection and forced-RLS negative tests |
| Authorization helper -> membership | Recursive RLS or arbitrary-user lookup leaks access | Narrow grants, current actor only, cross-business tests |
| Concurrent command -> history | Double effect or partial write | Real connection barriers, idempotency and injected-failure rollback |
| Test tooling -> remote project | Production URL/ref or pooler user accidentally used | Explicit allowlist plus DB marker before fixture mutation |
| Test admin -> application | Admin secret bundled or loaded by Next.js | Separate operator file, environment/bundle review; publishable runtime only |
| Auth callback -> redirect | Open redirect/token replay | Fixed destination, expiry/replay tests; no token response bodies |

Invitation dispatch will have an independent owner-authorized intent boundary in Task 4. No invitation feature is implemented at this checkpoint. Supabase built-in Auth rate limits remain enabled; no custom distributed limiter/infrastructure is added here.

Dependency scripts are disabled. Exact versions and npm lockfile are required. High/critical audit findings cannot be silently accepted. Errors shown to users are generic and never include credentials or SQL internals. Browser traces/screenshots with authenticated secrets are disabled in automated proof runs.
