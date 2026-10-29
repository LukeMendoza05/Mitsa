# Environment handling

No real environment values or environment files belong in Git. Next.js must receive only the settings required by the reviewed clean deployment.

| Setting | Handling |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Approved clean project only. A publishable key grants no administrative authority. |
| `APP_ORIGIN` | Exact approved origin, HTTPS outside loopback. No wildcard, path or embedded credentials. |
| `AUTH_FLOW_KEY`, `MFA_ENROLLMENT_KEY` | Independent server-only cryptographic keys, generated privately. Never `NEXT_PUBLIC_`. |
| Registration service signer and Turnstile secret | Server/Edge settings only, provisioned separately when authorized. |
| `MITSA_REGISTRATION_MODE`, `MITSA_AUTH_MAIL_MODE` | `disabled` until separate activation approval. |
| `MITSA_REGISTRATION_SERVICE_ENABLED` | `false`. Deployment alone must not enable it. |
| `MITSA_EMAIL_OTP_LENGTH` | Six-digit email verification; this does not configure authenticator codes. |

Do not give the ordinary Next.js runtime service-role keys, Auth administrative keys, database connection strings, SMTP credentials, cloud management tokens, evidence decryption keys or operator configuration. The runtime rejects administrative credentials.

The checked-in ordinary target mapping is deliberately unconfigured and persistent profiles are null. The closed Preview may select its separately provisioned backend through the reviewed server-only binding below. This does not remove database/hook enforcement or approve authentication tests.

Use distinct preview and production projects, secrets, callback origins and mail authorization. Never copy retained users, workspaces or evidence into a preview. Rotate secrets through protected provider controls without putting values in shell arguments, logs or pull requests.

The build and public-safe unit tests use no live backend. Tests that use controlled fake settings must be identified as offline tests, not real authentication acceptance.

## Optional closed Preview origin policy

The server-only preview origin resolver may derive a canonical HTTPS origin from Vercel system deployment metadata only after the exact project, repository and commit have been approved. Its opt-in setting is MITSA_PREVIEW_ORIGIN_MODE=vercel-deployment-v1. MITSA_PREVIEW_VERCEL_PROJECT_ID and MITSA_PREVIEW_SOURCE_SHA must bind that approval; system variables must come from Vercel rather than manually forged overrides. MITSA_PREVIEW_SUPABASE_PROJECT_REF must match the approved new empty project's creation receipt and SUPABASE_URL exactly. The separate environment uploader must reject any retained development target. No generated project ID or secret is needed in the public source commit.

This option requires the Preview environment, closed registration/mail/service gates and the closed legacy engine. It rejects other hosts, production, conflicting explicit origins and unapproved metadata. Use the canonical generated Preview URL and relative browser form requests. Do not add a protection-bypass secret or put private settings in next.config.env. All Deployments protection and a separately approved clean backend remain required.

This resolver is a deployment-origin mechanism; it does not approve any registration activation or alter Supabase session guarantees.
