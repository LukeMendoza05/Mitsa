# Mitsa development/test setup

Product identity: **Mitsa**, a fireworks inventory and business management platform. Current visual implementation and verification are documented in [mitsa-redesign.md](mitsa-redesign.md). Historical cinematic studies are superseded. Runtime routes and environment variable names have not changed.

The sole approved remote target is Fire_Inv, ref mjtejwafxriwntweussc, Sydney (user confirmed this target). No production or unrelated project is authorized. The target guard pins API host, database host/pool username and purpose. A database ownership marker is checked before test fixture writes. There is no reset command.

## Tooling

Node 24 and npm 11.19.0. Run npm ci with lifecycle scripts disabled by .npmrc. Dependencies are exact and package-lock.json is authoritative. Inspect dependency scripts before explicitly running any required binary installer. Use npm run typecheck, npm run build and npm run test. Aggregate tests fail when hosted proof credentials are missing; they do not silently skip.

## Credential boundaries

`.env.local` holds the publishable Supabase URL/key, APP_ORIGIN, separate MFA/auth-flow encryption keys, the private registration server-signing key and controlled testing modes. It never holds administrative Supabase/database credentials. Next.js must never receive TEST_AUTH_ADMIN_KEY, a service-role key or TEST_DATABASE_URL. Test/operator credentials live in gitignored `.secrets/operator.env` and are loaded explicitly by test/setup tools only. Do not paste credentials into chat or commit them.

Create `.secrets/operator.env` for the approved isolated project:

```dotenv
TEST_PROJECT_REF=mjtejwafxriwntweussc
TEST_SUPABASE_URL=https://mjtejwafxriwntweussc.supabase.co
TEST_PUBLISHABLE_KEY=the-project-publishable-key
TEST_DATABASE_URL=the-project-direct-or-session-pooler-postgresql-connection-string
TEST_AUTH_ADMIN_KEY=the-project-secret-api-key
```

Use the session pooler if direct IPv6 connectivity is unavailable. Copy the URI on port 5432 without query options or a fragment; the test tools enforce TLS verification themselves. Never use credentials from another project. Database/admin credentials are test/operator capabilities, not deployed application configuration. The future invitation function will hold its own admin secret separately; that feature is not implemented in Tasks 1–3.

The database tools trust only the public Supabase Root 2021 CA in `config/supabase-ca.crt`, downloaded from the certificate link in Fire_Inv's Database Settings. Its SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`; expiry is 2031-04-26. This certificate is public, not a credential. Hostname and certificate verification remain enabled. No machine-wide trust store changes are required. See [Supabase SSL documentation](https://supabase.com/docs/guides/platform/ssl-enforcement).

PostgreSQL `28P01` means database authentication failed. Use the project's database password, not the Supabase account password or API key; percent-encode special characters in the URI password. A valid API key does not prove a database password is valid. Never log either value while diagnosing failures.

Remove template square brackets surrounding the password; they are not part of the connection string's password syntax. Credentials and verified TLS work for Fire_Inv. The custom business roles intentionally have no managed Auth schema USAGE. The separately approved, read-only `private.current_actor()` adapter resolves that hosted compatibility boundary; see `auth-adapter-repair.md`. A migration history entry containing GRANT does not prove the grant took effect. Do not retry managed-schema GRANT blindly or add a service-role runtime.

## Hosted configuration gate

Public application signup and anonymous users remain disabled. Separately approved provider email signup is enabled behind strict registration-intent and encrypted Send Email hooks, with mandatory confirmation, an exact synthetic allowlist and one separately approved private developer email. Only approved loopback callbacks are used. All release gates are false. Admin test setup and native controlled signup are distinct paths; workspace roles are never self-selected. Do not toggle provider settings to make a test pass.

Apply only version-controlled migrations to the approved project. Before first migration, inspect identity and absence of conflicting business objects. After setup, verify the pinned database marker before fixture changes. Test cleanup targets its own UUID records only; no project/database reset or truncate.

The one-time `scripts/apply-reviewed-adapter.mjs` records the exact approved repair's execution mechanism: hash/project/marker pinning, explicit same-client transaction, baseline record/security checks, migration-history insertion in that transaction, and no automatic retry after an uncertain commit. Its `--rollback-proof` and `--apply` modes were executed in that order. It intentionally refuses to run again once migration 20261012070606 exists; future changes require a separately reviewed forward migration. Do not use this tool as a general migration runner.

## Isolated registration Edge configuration

The user separately approved and completed deployment/configuration of `mitsa-registration-intent` in `mjtejwafxriwntweussc` only, then approved strict hook activation and controlled captured-mail signup. Public registration, external mail and legal publication remain disabled. See [the completion ledger](auth-completion-ledger.md) for current state and [the security audit](registration-intent-security-audit.md) for the earlier function audit.

After explicit approval, `node scripts/setup-registration-intent.mjs` generates/preserves a separate private 32-byte signing key in ignored `.env.local` and `.secrets/registration-intent.env`. The latter holds only the three custom Edge settings; it contains no administrative credential. Configure those settings in the approved project's Edge secrets, verify their digests match, and never put the signing key in a browser bundle, logs or source control. Do not run this setup for production or silently rotate an existing value.

Run `npm run test:integration -- --run tests/integration/registration-edge.test.ts tests/integration/auth-settings.test.ts` for deployed smoke checks. They fail explicitly without the private test configuration, verify the pinned project and database marker, allowlist only their synthetic recipient, preserve generated histories and disable that recipient afterward. Tests create intents only; they do not enable native signup or send email. Ordinary Next must never inherit `.secrets/operator.env`.

Before any live business use: separate production configuration, complete the remaining Stage 1 tasks, pass all release tests, and prove restoration of a backup in an isolated environment. This isolated checkpoint is not production-ready.

## Access the actual local application

Run `npm run dev -- --port 3000`; open `http://127.0.0.1:3000/login`. Existing authorized credentials, workspace URL and TOTP setup key are private in `.secrets/signup-access.json` (`owner`) or `.secrets/development-access.json`. Open those files privately on this computer, add the stored key to your own authenticator, sign in, then choose **Verify authenticator** and enter a current code. Never paste these files into chat or commit/share them. Existing setup scripts preserve credentials and factors rather than resetting them.

To register a fresh approved synthetic account, `node scripts/auth-mail.mjs prepare-identities` prepares/preserves the documented Owner/Admin/Staff test identities and exact allowlist. It does not create accounts or enable signup. Use a not-yet-registered identity at `/signup`, explicitly accept the isolated agreement, then run `node scripts/auth-mail.mjs read owner` (or the corresponding label) to decrypt its captured messages into ignored `.secrets/auth-mail/messages/`. Open the latest private message file and use its local URL. GET stages verification; the explicit verification button consumes it. Enroll MFA before Owner onboarding. Invited Admin/Staff accept the actual issued invitation; never enter a requested workspace role in the signup payload.

Support access is separate: the already approved two identities are in `.secrets/support-access.json`; `node scripts/provision-review-access.mjs` verifies existing setup instead of adding scopes. Sign in, verify MFA and confirm password/authenticator within five minutes, then visit `/operator/requests`. Reviewer and executor cannot act on their own case or perform each other's step. No reset/deletion is enabled.

Controlled full browser journeys use `npx playwright test --config playwright.journeys.config.ts` against the running port-3000 development server and separate browser contexts. For production regression, build first, then set `$env:MITSA_E2E_PORT='3001'` and run the relevant `npx playwright test` files. The production test server uses port 3001 so the user's app/tab remain intact. Captured signup email callbacks stay pinned to port 3000; do not run signup-link journeys against another origin without separately reviewed configuration.

The local Resend foundation is documented in [mail-integration.md](mail-integration.md). No external worker, SMTP credentials or webhook endpoint is activated.

## Your approved developer account

The user separately approved the exact private email in ignored `.secrets/developer-registration.json`; the reviewed isolated migration and operator activation are complete. The address is never printed by the setup tools. No account/password/workspace is created by authorization. Use `npm run auth:developer -- status` for boolean status, then register through port-3000 `/signup`, using your own password and explicit agreement acceptance. If the status already reports an account, continue verification or sign in rather than repeatedly registering.

Run `npm run auth:developer -- inbox` to decrypt captured messages into ignored `.secrets/developer-mail/`. Open `latest.json` privately and use its `url`, then choose **Verify email**. Retrieving a message does not consume it; the explicit confirmation action does. Do not share the URL or private message file. No external delivery is configured. Enroll and verify your authenticator, then create a workspace with a fictitious business name beginning **Synthetic**, for example **Synthetic Developer Workspace**, and fictitious location details. Sign out, sign in again, verify MFA and select the workspace.

The singleton approval cannot be replaced with another address through a browser or ordinary client. A new identity, hook/provider setting change or production activation requires separate scoped approval. The private local hash in `.env.local` is only a preliminary form defense; hosted allowlisting, signed intents, hooks, verification and all authorization checks remain authoritative. See [the developer handoff](developer-registration-handoff.md) for screenshots, exact changes and verification results.

MFA setup now expires with the original five-minute password confirmation rather than granting another five minutes after QR generation. Wait for **Identity confirmed**, generate a fresh QR, and enter its code in **New authenticator code** before that confirmation expires. Cancel an expired unverified setup before recreating it. If an authenticator is provider-verified but its Mitsa setup did not finish, the page shows a recovery-review state; a password alone cannot replace it. See [the MFA repair report](mfa-enrollment-repair.md) and separately scoped [developer recovery approval](developer-mfa-recovery-approval.md). Never reuse an exposed QR/setup key or reset an existing verified factor without explicit approval.

## Stage A persistent registration safety

The new registration engine is inactive local source. Keep the actual private environment on its existing legacy engine. Do not select `persistent-v1`, start a worker, deploy the private service or apply prepared SQL without the separate approvals in [the Stage C package](persistent-registration-stage-c-approval.md).

Use `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run registration:package` and the synthetic `playwright.persistent-registration.config.ts` suite for Stage A. Do not run broad `npm test`, integration or hosted onboarding commands under this scope: they may create live fixtures. Only the specifically reviewed read-only checks are authorized here. See [the Stage A report](persistent-registration-stage-a-report.md) and [worker operations](persistent-registration-operations.md) for exact scope and results. Never paste private configuration, OTPs, passwords, tokens or QR codes into chat or reports.
