# Mitsa — current email and registration readiness

Updated 2026-10-15T08:35:54.930Z. The latest user authorization permits isolated open registration and necessary user-initiated authentication emails after security and controlled onboarding checks. Older indefinite prohibitions are superseded. Production, deployment, legal publication and account reset remain unauthorized.

Six-digit provider codes retain a 3600-second expiry. The completed Gmail milestone remains intact: two inbox receipts, fresh code verification, compromised old-code rejection, replay protection and cooldown; its window is closed.

Both real Turnstile credentials are configured. Regular-browser server verification and replay rejection passed. The latest timed live run rejected an unusable held token with invalid-input-response; the expiration-specific result is unconfirmed. Mocked browser tests do not replace that result.

Current local mode: **development-open**; pilot open: **true**. No new controlled account or mail was created during preparation. The fresh approved sender +alias is privately stored and was confirmed unregistered and not developer-allowlisted.

The development-open path, CAPTCHA-backed signed intent, fresh worker heartbeat, short database lease, durable SMTP claims and conservative mail caps are implemented locally. The recovery-hook extension is prepared and applied. See [exact approval candidate](development-recovery-approval.md) and [current implementation, tests and next steps](isolated-open-registration-progress.md).

The existing developer account, verified MFA, D Extacy Fireworks workspace, membership, location and history pass their encrypted preservation comparison. The current private-output audit passes with 449 files inspected and all 14 landing files unchanged. Leaked-password protection remains a documented launch concern.

No general registration activation is claimed until the controlled real-email and complete onboarding evidence passes. General activation already has conditional authorization; the additional reviewed hook delta has now been separately approved and applied.
