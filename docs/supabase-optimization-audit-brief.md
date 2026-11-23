# Mitsa — upcoming read-only Supabase optimization audit

This brief records outstanding evidence for a later audit. It does not authorize configuration changes, schema migrations, cleanup, paid upgrades or production access. Target only isolated project `mjtejwafxriwntweussc` after verifying marker `fireworks-foundation-proof-01a12e38`.

Read-only security advisors were refreshed on 2026-10-15. The same WARN and intentional INFO remain; see `artifacts/resumed-security-advisors.json`. No setting or privilege was changed to suppress either finding.

## Unresolved security warning

Supabase's post-install security advisor reported **Leaked Password Protection Disabled**. Evidence: `artifacts/pilot-schema-security-advisors.json`, collected after disabled migration `20261014124737`. No password-protection setting was changed during email work. The audit should reread the advisor and actual provider setting, verify applicable plan/configuration prerequisites, document impact and propose any change separately. Do not infer an approved paid upgrade or silently activate protection. [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Intentional default denial

The same advisor reports INFO for RLS with no policies on `private.pilot_mail_deliveries`. This is an operator-only ledger with ordinary grants revoked and RLS/FORCE RLS enabled. No API/client role should gain access. Adding a permissive policy to remove the notice would conflict with the approved design. Inspect effective privileges and callers before making any recommendation. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Preservation boundaries

Review query/index evidence, Auth settings and effective role/RLS behavior without modifying records. Keep pilot/public/SMTP gates closed unless a separately approved temporary delivery window is active. Preserve the developer identity, authenticator, memberships, locations, D Extacy Fireworks workspace and immutable history. Use catalog metadata and redacted aggregates; do not output personal emails, codes, token hashes, passwords, SMTP credentials or factor secrets. Reuse the existing encrypted preservation baseline; no new migration or reset is implied by an optimization finding.
