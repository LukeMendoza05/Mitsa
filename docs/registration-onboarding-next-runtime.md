# D/E isolated Next runtime — offline integration checkpoint

Later local checkpoint: [fixture/session probes and real-worker bridge](registration-onboarding-observers-worker.md). It supersedes only the unfinished-probe/worker-port items below; credential binding and the enclosing controller still remain incomplete. The 79-test result here remains preserved historical evidence.

**Managed Supabase remains selected; Strict Option A remains unresolved under SU-519045. No D/E execution approval or security exception exists.** This checkpoint implements the Next/process side of the acceptance harness. It does not claim complete real onboarding or production readiness, and does not repeat A/B/C-A.

## Implemented runtime

- `onboarding-next-runtime.mjs` uses the installed Next version's programmatic-server API inside a separate test process. It binds loopback only, authenticates private fixture contexts, strips test headers before Next/proxy/RSC, and uses AsyncLocalStorage to count outbound server requests against the right fixture. Unbound background work and unknown destinations fail closed. Cancellation immediately prevents further provider traffic; failed cleanup retains deny-all interception.
- `onboarding-next-process.mjs` filters the ordinary test-server environment, excluding operator/admin/database/SMTP credentials and NODE_OPTIONS. It reserves and records a source-bound launch before fork, uses a private handshake, observes readiness and acknowledged cleanup, checks actual exit/pipe closure/process absence, and treats startup/shutdown/watchdog termination as failure. It never resets the spent attempt.
- `scripts/onboarding-next-child.mjs` is a real but **inactive** child entry. It requires a new exact D/E review, private approval, proven strict trace, fixed target/root, compiled-build binding, matching parent/child identity and nonce. Standalone invocation and a foreign private root are rejected before Next or hosted work. The final execution review and real D/E authority have not been installed or created.
- `onboarding-browser-binding.mjs` adds the ephemeral test credential only to the exact loopback application origin. It removes those headers from Cloudflare traffic and blocks direct browser-to-Supabase/foreign destinations. Direct API negative tests must instead use the independently bounded Node probe adapter. This is acceptance-harness isolation, not a replacement for Mitsa Auth, CAPTCHA or RLS.

The ordinary app, package start command, existing Next config, Auth routes, database and hosted configuration are unchanged. This custom server is **not** the proposed public Vercel server; it is excluded from uploads by the existing scripts exclusion.

## Actual offline evidence

**79 OFFLINE tests across nine files passed; zero skipped**, plus TypeScript and Node syntax checks. Tests include the prior driver/budget components, real disposable IPC children, counted mock provider requests, loopback HTTP request isolation, header privacy, failed startup, expired/exhausted authority, idempotent shutdown and forced-stop rejection.

One disposable child loaded the **actual built Next application** with fake publishable/app keys and fake provider responses. A Node socket fence denied external destinations. Rendering `/signup` produced one counted settings call and one counted policy RPC, with zero attempted external sockets. The test then observed acknowledgement, natural zero-code exit, closed pipes and process absence. This proves the framework uses the interceptor on that rendering path; it does not prove every authenticated runtime path yet.

A separate fresh, headless **Edge** context verified that a synthetic Secure/HttpOnly enrollment-style cookie is stored and sent on HTTP `127.0.0.1`. Only an ephemeral loopback test page was used, with non-loopback page routes blocked. No retained profile, Mitsa credentials or account was used. This supports using the production build for isolated loopback acceptance without changing the working cookie policy; public deployment still requires HTTPS.

The first framework fixture timed out because its cleanup acknowledgement was attempted after IPC disconnect. The fixture now sends the acknowledgement before disconnect, and the parent observes exit as well as messages. That initial failure report is retained. The corrected actual-framework run passed. A sandbox CIM query was denied, so absence was subsequently checked in the normal Windows context using actual node.exe process names; no fixture processes remained. No broad process termination was performed.

## Budgets and remaining integration

`D-E-journey-v1` remains a **new, unapproved proposal**, not an extension to old scopes. In addition to its prior finite ceilings, it distinguishes 2,000 outgoing browser attempts from 2,000 incoming Next requests. Provider Auth/Edge/RPC/CAPTCHA requests remain separately counted. Its journal uses a bounded cross-process lock wait; stale locks fail closed and are never removed or refunded automatically.

The overall D/E runner is still incomplete. Remaining independent implementation is:

1. Fixture-only credential/response binding and real identity, session, trusted-factor, ownership, logout, recovery and cross-tenant probe adapters. Fresh browser contexts alone must not be treated as sufficient proof that retained credentials cannot be forwarded accidentally.
2. The controller that supplies encrypted continuation/inbox ports, the real existing mail worker and exact preservation/control cleanup. Validate the transition from an actually passing C-B postflight; do not accept another baseline automatically.
3. Full driver-to-runtime integration tests with fake provider/SMTP responses and finite request calibration. Then finish F's explicit restart/failure adapters and freeze the complete execution package.

No new hosted approval is requested until those bindings are executable and verified. C-B remains separately unauthorized and blocked by its strict-proven prerequisite. The completed diagnostic receipt, original preservation snapshots, historical Auth uncertainty and spent budgets remain intact.
