# Mitsa — acceptance register and internal-development handoff

27 October 2026. Preparation is separate from hosted acceptance. Latest authority is `artifacts/registration-completion-status.json` plus cited execution artifacts; do not use a proposal's status as evidence it ran.

| Requirement | Current status | Evidence needed to finish |
|---|---|---|
| A / C1 / C2 / C3A / C3B(a) existing implementation | PASSED for recorded scopes | Preserve existing source/evidence; no reinstall or replay. |
| Current-state preservation collector and historical bridge | READY locally | Approved fresh capture, encrypted verification, current invariant checks, explicit acceptance decision. Historical Auth cause remains unknown. |
| New persistent Gmail connection/worker lifecycle | READY locally; earlier transport preflight FAILED | Approved B real TLS/login, acquire/heartbeat/shutdown, rollback, process termination and preservation. No success is inferred from legacy SMTP tests. |
| New persistent verification email and resend | NOT STARTED hosted | C/D: actual provider OTP, encrypted dispatch, inbox receipt, recipient binding, verification, invalid/expired/replayed codes and rate limits. |
| New persistent MFA/onboarding/returning sign-in | NOT STARTED hosted | D/E actual new-fixture journey. Prior Yuno/legacy success remains historical, not new-engine acceptance. |
| New persistent recovery | NOT STARTED hosted | E real authorized recovery email, one-use/expiry checks, current-password compatibility and retained MFA. Prior synthetic hardening is not a delivery test. |
| New tenant/role security acceptance | NOT STARTED for new engine | Two new tenants, anonymous/AAL1/direct API/RPC/RLS/role and location denial; audit historical Admin/Staff/financial branch evidence without inventing new grants. |
| Operational stability | READY code/protocol; NOT STARTED hosted | F actual process/worker restart, stale heartbeat, shutdown, capacity and uncertain-delivery preservation. |
| Strict Option A | BLOCKED | Supported correction under SU-519045 plus approved passing regression. No one-hour exception selected. |
| Ordinary-business legal and scalable delivery | BLOCKED on decisions | Adopted applicable notices/operator/contact/eligibility/retention; suitable email service, monitoring and plan/security decisions. Test notices are insufficient. |
| General registration enabled | NOT STARTED; disabled | Separate H approval after actual functional/security/operational results. |

## What current local tests establish

The new SQL is exercised in in-memory PostgreSQL with pgcrypto; credential/token changes alter protected fingerprints, declared activity changes are separately visible, unknown fields fail or remain protected, and duplicates retain multiplicity. The historical bridge is tested using PostgreSQL JSON canonicalization. One-shot entrypoints deny missing approvals before connection/key creation/worker launch. These are **OFFLINE tests**, not proof the hosted HMAC permission, new baseline, persistent SMTP or onboarding works.

The normal bounded-mail implementation already provides signed fixture/job scope, immutable claim reservations, no uncertain-send replay, DB-clock freshness, provider-issued code/recipient binding and heartbeat/fencing. The new `registration-final-budget.mjs` adds an append-only SQL/HTTP operation ledger: unknown SQL is conservatively write-capable, arguments are never journaled, failed calls remain consumed and restarts cannot refund capacity. Future C–F execution still needs that wrapper connected to the exact source-bound browser/Auth protocol and reviewed against the approved security decision. Finite specifications and a wrapper alone are not a complete operational test runner.

## Operational constraints and provider path

Keep credentials in the existing DPAPI/private-server stores, comparison keys only in encrypted preservation evidence, and all client bundles free of private keys. Future operator workers need one durable authority record and independent admission/delivery switches, not recurring signup windows. No Windows startup task, service install, scheduled job or deployed supervisor is approved by this package. Prepare its exact hidden current-user action and stop/recovery behavior before any later installation.

Gmail remains a low-volume development sender with application caps of ten attempts/hour, twenty/day and sixty seconds/recipient, including uncertain claims and other sending paths. [Google's documented limits](https://support.google.com/mail/answer/22839?hl=en) mention personal-account blocking above 500 messages/day or 500 recipients/message and possible temporary restrictions. Those are not an account-specific capacity guarantee or a target. Failed login, throttling, bounce/suppression uncertainty or unavailable capacity must close admission as appropriate; do not increase quotas to finish a test.

Before ordinary-user scale, prefer a dedicated transactional service with a verified owned sender domain, delivery/bounce/suppression events and cost monitoring. [Resend's current plan page](https://resend.com/pricing) lists a 100/day free limit; do not infer that its test sender can deliver to arbitrary customers without verified sender-domain prerequisites. Mitsa currently has no approved owned sender domain. A future migration would keep Supabase Auth as OTP authority, replace only the transport adapter, verify recipient/action/idempotency and webhook signatures, then run delivery/recovery regressions with separate approval. No provider purchase/switch, SMTP change or API key creation is authorized now.

Emergency registration closure is not session revocation. Stop admission first for capacity/transport failures while allowing already-issued valid verification where secure; stop delivery/generation for compromise/correlation failures, retain uncertain claims, and follow the approved supported incident-session procedure. Never delete retained business/account records as cleanup.

## Internal development readiness

The existing workspace shell, identity/MFA/membership checks, tenant model and design direction are available for separately scoped local work using the existing approved login/test environment. Public registration readiness and independent local UI readiness are separate. This package implements no dashboard, inventory or POS module and exposes none publicly.

Before implementing those modules, obtain the actual product/stock unit hierarchy, permitted operations and role/location/financial boundaries, inventory mutation/audit/idempotency rules, first real dashboard metrics and data-source contracts. Reuse current routes and tenant authority. Preserve editorial typography, flat surfaces, adaptive mobile records, functional chart tooltips, side-by-side desktop analytics and quick-view plus dedicated record pages. Do not create fictitious operational pages or redesign completed authentication screens.

A clean handoff after authentication acceptance must include the accepted registration/security policy, hosted functional evidence, active configuration and shutdown owners, approved legal versions, provider limits, remaining production exclusions and API/RLS contracts. If only the external Strict A dependency remains, local feature work can proceed under its separately authorized scope without calling registration released or weakening the failed guarantee.
