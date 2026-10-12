# Foundation development/test setup

The sole approved remote target is Fire_Inv, ref mjtejwafxriwntweussc, Sydney (user confirmed this target). No production or unrelated project is authorized. The target guard pins API host, database host/pool username and purpose. A database ownership marker is checked before test fixture writes. There is no reset command.

## Tooling

Node 24 and npm 11.19.0. Run npm ci with lifecycle scripts disabled by .npmrc. Dependencies are exact and package-lock.json is authoritative. Inspect dependency scripts before explicitly running any required binary installer. Use npm run typecheck, npm run build and npm run test. Aggregate tests fail when hosted proof credentials are missing; they do not silently skip.

## Credential boundaries

`.env.local` contains only SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_ORIGIN. Next.js must never receive TEST_AUTH_ADMIN_KEY or TEST_DATABASE_URL. Test/operator credentials live in gitignored `.secrets/operator.env` and are loaded explicitly by test/setup tools only. Do not paste credentials into chat or commit them.

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

## Hosted configuration gate

Disable public signup and anonymous users; allow only local callback URLs for this proof. Expose API schema only after migration review. Create synthetic users with the Auth admin API from test tools. Initial operator bootstrap and the full invitation/password-recovery product flows remain Task 4; Task 3 proves the SSR callback/session boundary only.

Apply only version-controlled migrations to the approved project. Before first migration, inspect identity and absence of conflicting business objects. After setup, verify the pinned database marker before fixture changes. Test cleanup targets its own UUID records only; no project/database reset or truncate.

Before any live use: separate production configuration, complete the remaining Stage 1 tasks, pass all release tests, and prove restoration of a backup in an isolated environment. This checkpoint is not live-ready.
