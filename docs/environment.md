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

The checked-in target mapping is deliberately unconfigured and persistent profiles are null. Supplying environment variables does not approve a target or remove database/hook enforcement. A reviewed mapping and a separately provisioned clean schema are required before authentication can be used.

Use distinct preview and production projects, secrets, callback origins and mail authorization. Never copy retained users, workspaces or evidence into a preview. Rotate secrets through protected provider controls without putting values in shell arguments, logs or pull requests.

The build and public-safe unit tests use no live backend. Tests that use controlled fake settings must be identified as offline tests, not real authentication acceptance.
