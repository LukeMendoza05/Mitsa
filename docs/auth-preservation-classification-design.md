# Mitsa — future Auth preservation classification proposal

27 October 2026. **Design only; not installed, adopted or applied to the historical baseline.**

## Current evidence and limitation

The historical and diagnostic snapshots retain account IDs and whole-row hashes. Exactly one hash differs; no historical per-column values/digests exist. Current metadata or audit context cannot reconstruct those missing values. Neither this design nor a plausible sign-in event proves a harmless change. Preserve both original ciphertexts/manifests, mismatch and consumed budgets indefinitely under existing retention controls; no original contents are regenerated.

## Proposed future evidence layers

| Layer | Capture proposal | Decision rule |
|---|---|---|
| Whole account row | Retain full-row cryptographic change detection. | Any mismatch remains visible; no silent ignore list. |
| Identity and status | Stable account key, keyed digests of email/phone/identity associations; verification/anonymous/SSO/role/status flags, deletion/ban state. | Change requires explicit review; creation/removal separately counted. No automatic normalization of identity changes. |
| Credentials and enrollment | Separately reviewed server-side keyed fingerprints of credential representations and relevant security fields; never return raw representations, tokens or keys to the collector. | Any change fails preservation pending review. Recognize legitimate rehash/rotation without presuming it. Exact field set, purpose and permissions require separate approval; this task reads none of them. |
| MFA and application authority | Retain factor integrity checks, trusted bindings, recovery state, MFA timestamps/status, memberships/roles/location restrictions/ownership, consent and audit records. | Unchanged integrity is required. Account creation alone still grants no workspace authority. |
| Activity metadata | Explicit sign-in timestamp plus update/verification/request-sent timestamps, with schema version and authoritative capture times. | Sign-in can explain activity; updated_at alone only indicates some write. Request/verification timestamps remain security-flow evidence, not blanket exclusions. |
| User/app metadata and schema | Preserve changes separately. Unknown JSON keys/new columns are unclassified. | Never classify arbitrary raw_user_meta_data or raw_app_meta_data as harmless volatility; some keys affect authorization/onboarding. Unknown fields fail closed until reviewed. |

A future keyed fingerprint requires separate secret lifecycle, access, canonicalization and rotation design. Unkeyed hashes of low-entropy personal data are not adequate privacy protection. New server-side functions/grants or changes to the collector are not authorized now. Canonicalization must be deterministic, versioned and tested for nulls, key/row ordering, timestamps, arrays, schema expansion and provider type changes. Preserve raw whole-row-change detection alongside the classification, rather than silently replacing it.

## Review rule, not automatic acceptance

An activity-only classification would require a complete future capture showing protected identity/credential/status/MFA/authorization layers unchanged, explicit activity-field differences and sufficient trusted context. An audit event alone cannot establish which historical column changed. Changes outside the declared activity set, missing fields, unavailable audit data, unknown provider schema and unexplained differences remain reviewable failures. Adoption of any automated activity-only allowance requires an explicit policy decision and tests; it must not weaken Strict Option A or access control.

## Tests required before adopting

1. Legitimate sign-in changes are visible and classified; an accompanying credential/status/identity change cannot be hidden by the activity event.
2. Email/phone changes, verification reversal, ban/delete/role changes, credential updates, MFA modifications and metadata authority changes fail protected-layer comparison.
3. Unknown/new columns or keys, missing snapshots, malformed arrays and unsupported serializer versions stop comparison; reorder-only differences are distinguishable without discarding values.
4. Key rotation/version mismatch stops automatic comparison; evidence contains no raw credentials, private identifiers in reports, or secrets in public artifacts/logs.
5. Old whole-row-only snapshots remain comparable only by the original rules. No retrospective activity classification or rebaselining.

## Prerequisites for a new baseline and transport retry

First complete the separately approved targeted investigation and report how far it attributes the change. If evidence remains insufficient, present the exact residual uncertainty for explicit human review; do not invent historical column evidence. A separate approval must authorize any new preservation reference and define retained sensitive invariants. Create it fresh under that approval, verify encryption/decryption/digests, retain both old snapshots and their mismatch, and record why it supersedes an operational comparison reference without erasing history.

Stage D needs its own newly approved source/manifest, budgets and single-run interval, refreshed preservation/closed-gate/process checks, transport-only limits and applicable recovery procedure. The spent original transport launch and diagnostic authorization remain spent. Passing this local parser correction or identifying plausible activity is insufficient to retry. Account-admitting activation still depends on the separate Strict Option A provider resolution and authorized regression evidence under SU-519045.
