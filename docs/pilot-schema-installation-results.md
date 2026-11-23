# Mitsa — disabled pilot schema installation results

Installed on 2026-10-14 after explicit approval, only in isolated Supabase project `mjtejwafxriwntweussc`. Pilot registration and SMTP remain disabled. No personal reset, provider configuration change, deployment or external delivery occurred.

## Applied change

- Hosted migration: `20261014124737_mitsa_controlled_pilot_relay_disabled`.
- Reviewed source: `supabase/prepared/20261014_mitsa_controlled_pilot_relay.sql`.
- SHA-256: `fb8a76b0ffbb57fe4f378c439e70028a094745c3165099a1235455c23c303dff`.
- Required marker: `fireworks-foundation-proof-01a12e38`.

The target, marker and exact reviewed file hash were verified before application. The saved OpenPGP recovery baseline was decrypted and its digest checked before proceeding. The audit found no unapproved real users or businesses under the explicit synthetic/developer classification. The actual developer workspace remains real pilot setup data, not disposable test data.

The exact candidate added the two private tables, the restricted invoker helper and the four documented recipient/policy changes. It included no existing-row deletion or update, role assignment, widened existing function grants, SMTP connection or Auth setting change. Hosted migration history confirms installation. The reviewed source is retained unchanged outside automatic migrations; its original preparation comment is historical. Do not apply it again.

## Preservation and access verification

The postflight compared the live database with the encrypted baseline and verified:

- All **4,755 original application/history rows** are preserved; tests added only separate synthetic records.
- The four existing function definitions differ only by the reviewed replacements. Their owners/grants and all original table permissions, RLS and policies are unchanged.
- Both new tables have RLS and FORCE RLS. Ordinary API roles cannot read or write them. The application and Auth hook roles have only the documented configuration read access and helper execution; they cannot write the configuration or read/write the ledger.
- All 11 new primary-key, foreign-key and check constraints are present and validated, including the exact loopback origin, bounded window, sender fingerprint and unique capture claim.
- Pilot and SMTP flags are false; approval, expiry, provider-expiry and sender fields are null; the helper returns false and the delivery ledger is empty. All global release gates remain false.
- A separate read-only comparison confirms the original developer identity, verified MFA factor, workspace, Owner membership, location, Terms and history remain unchanged. No personal session or factor was reset.

Recovery retains the encrypted prior function definitions, owners/grants and row/policy fingerprints in ignored private storage. If rollback is needed, restore only those four prior definitions through a reviewed isolated operation and retain the new tables/evidence; do not drop history or disable capture. Decryption and digest checks prove this snapshot is readable. They do not establish managed Auth/PITR restoration capability.

## Tests

Commands run against the approved isolated target:

```powershell
npm run typecheck
npm run test:integration -- pilot-disabled code-capture registration-edge registration-boundary workspace-security account-security auth-adapter auth-settings
npm run test:integration -- pilot-disabled
npx playwright test --config=playwright.email.config.ts
node scripts/pilot-relay-preflight.mjs check
node scripts/verify-reset-preservation.mjs
node --conditions=react-server scripts/pilot-mail-relay.mjs
```

Typecheck passed. The integration run initially passed 35/36 checks: the additional permission test tried to impersonate Supabase's protected `supabase_auth_admin` role, which the hosted connection cannot do. The test was corrected to inspect that role's effective privileges without granting impersonation. Its two targeted checks then passed. **All 36 distinct integration checks now have passing evidence; no schema change was needed to resolve the test failure.**

All **8 browser checks passed in one run** across desktop and mobile. They cover native/enhanced signup, actual encrypted Supabase code capture, invalid/expired/replayed code rejection, resend cooldown/provider limits, old-code invalidation, CSRF, missing context, offline feedback, MFA enrollment, Owner workspace creation and returning password/MFA sign-in. Accessibility, keyboard navigation, enlarged text and widths 320/390/768/1024/1440px passed within those journeys. Synthetic accounts were used throughout.

The previously passing production build and 166 unit checks remain the application-source baseline; this installation changed no application code. Current safe previews were refreshed using empty code inputs and an illustrative inactive email code. Actual Gmail/Outlook inbox rendering remains untested.

## Security advisor findings

- INFO: the delivery ledger has RLS without policies. This is intentional operator-only default denial, supported by revoked ordinary privileges; no permissive policy was added to silence the notice. [Supabase advisory explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- WARN: provider leaked-password protection is disabled. This remains a release consideration; no Auth setting or paid plan was changed under this schema approval. [Supabase password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No migration discrepancy was found. The permission-test assumption above was corrected without changing the schema. A final production-preview audit initially rejected its missing-context POST because the temporary port-3001 server still had port 3000 configured as its origin. Restarting only that preview with its matching origin resolved the test setup issue; both missing-context and cross-origin checks then passed. No application or database change was needed.

The final public-output scan passed across 358 files with zero private-value matches, including checks against protected SMTP values in memory. All 14 landing-page fingerprints remain unchanged. Desktop/mobile verification and light/dark email previews were refreshed and visually inspected using empty form inputs and an inactive illustrative code.

## Remaining approvals and limitations

The relay's read-only status is **Pilot window closed**, with zero SMTP connection attempts. Saved DPAPI credentials decrypt locally and match the dedicated sender, but SMTP authentication and real inbox delivery have not been tested. There is no sending worker or public send endpoint; the adapter is called only by the inactive operator relay.

Codes remain **8 digits, 3,600 seconds**. Separate approval is required for each of controlled Gmail delivery/activation, six-digit standardization, the personal account reset/workspace archive, and Vercel/public release. Do not delete the currently working account before an approved fresh-registration delivery route has been verified.

Evidence: `artifacts/pilot-schema-installation.json`, `pilot-relay-preflight.json`, `pilot-relay-postflight.json`, `developer-reset-preservation.json`, `pilot-schema-security-advisors.json` and `public-registration-preparation.json`.
