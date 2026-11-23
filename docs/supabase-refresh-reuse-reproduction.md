# Supabase Auth refresh-family terminal revocation — sanitized reproduction

**Draft only. Not sent to Supabase, GitHub or another recipient.** No credentials, addresses, project identifiers, raw session IDs, tokens, TOTP secrets or personal/business data belong in this report. The underlying tests used new disposable example.invalid accounts in an isolated environment. Public registration and SMTP were closed.

## Environment and provenance

- Auth health endpoint reports **v2.197.0**.
- Matching upstream release: [v2.197.0](https://github.com/supabase/auth/releases/tag/v2.197.0), commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`.
- Client versions: `@supabase/supabase-js 2.117.3`, `@supabase/ssr 0.12.7`.
- Dashboard settings, read without modification: refresh rotation enabled; reuse interval 10 seconds.
- The observed cloud binary has not been verified against an upstream binary checksum. A reported version plus source tag is provenance, not proof that every deployed build option/patch matches upstream.
- JWT lifetime was subsequently verified read-only as 3600 seconds. Email OTP expiry is separate. Current-password hardening is now on and tested; it is not a terminal-reuse correction.

## Reproduction

Token labels below are conceptual labels, never actual credentials.

1. Create a new synthetic Auth identity using the supported administrative test API; create no business membership or privileged role. Sign in to obtain session A; establish a separate session B for isolation checks.
2. Refresh A serially three times, observing four distinct refresh tokens R0→R1→R2→R3. Retain access/refresh values only inside the isolated test process.
3. Wait at least 12 seconds, then present old ancestor R0. It is no longer the immediate parent of the active token.
4. Observe HTTP 400 / `refresh_token_already_used`.
5. Read metadata only: A's session row remains, its four refresh records remain, and zero are unrevoked immediately after the rejection.
6. In one independent run, immediately present R3 inside the new post-revocation interval. A replacement token pair is returned; metadata shows one live refresh record again.
7. In another independent run, wait another 12 seconds after step 4 before presenting R3. It is rejected as `refresh_token_already_used`; no live refresh record remains.
8. In both runs, A's existing access bearer still passes an application check which validates signed JWT provenance, user eligibility, session existence and `not_after`. This is reported separately from cryptographic JWT validity.
9. A further supported-API comparison confirms `getUser()` still returns the correct synthetic identity after family revocation. Explicit local logout using A's own bearer succeeds, removes A's session/refresh records, rejects its former application bearer and refresh token, and preserves session B.

These observations do not claim a confirmed vendor vulnerability/CVE. Continued cryptographic JWT validity until expiry is documented. The question concerns the expected terminal state of a detected refresh-family reuse event, especially replacement issuance immediately after family revocation.

## Source-level hypothesis, not a deployed-binary proof

The [matching token service](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/tokens/service.go#L375) handles legacy refresh reuse using the token's updated time and calls `RevokeTokenFamily` outside its allowed interval. The [matching family revocation implementation](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/models/refresh_token.go#L87) changes live records to revoked with a new updated timestamp, retaining the session. This is consistent with a fresh grace interval applying to the newly revoked current record.

The [newer-format branch](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/tokens/service.go#L562) instead calls `LogoutSession` for disallowed reuse. Its separate algorithm/upgrade configuration is implementation detail here; availability as a supported hosted-project setting is not established. We have not changed it or assumed it can be enabled.

Follow-up: the user selected strict Option A on 16 October; no one-hour exception is accepted. Fresh public-source/API and read-only target findings, proposed provider correction and regression criteria are in [strict provider resolution](strict-refresh-provider-resolution.md). The report remains unsent.

## Questions for Supabase

1. Is issuing a replacement from R3 inside the interval after R0 has caused family revocation intended legacy behavior?
2. Is the retained active session row after terminal legacy reuse expected? Which supported API/state is authoritative for an application's immediate session-revocation check in this case?
3. Is there a supported correction/release or managed rollout that aligns terminal legacy reuse with the newer session-deletion behavior?
4. Is newer-format issuance available/supported for this hosted project, and how should existing sessions be handled without resetting accounts/MFA or changing legitimate concurrent-refresh behavior?
5. Is application code expected to rely only on bounded JWT expiry after this event, or is immediate terminal-session denial supported?

## Evidence available for private review

Sanitized counts, bounded error categories and test outcomes are retained locally. They contain no token values, addresses, account IDs or private keys. Source files are pinned by commit and SHA-256 in `artifacts/auth-provider-version-review.json`. The exact test code can be provided after checking it contains no embedded deployment secrets; private operator/configuration files must never accompany it.

No Auth-table trigger or migration was installed. No user/session metadata was manually changed in the reuse/alternative reproductions; the provider generated its own rotation/revocation changes. No support message or public issue has been submitted.
