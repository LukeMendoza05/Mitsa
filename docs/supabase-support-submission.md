# Mitsa — private Supabase support submission

**Status update — 22 October 2026 (Asia/Manila): submitted by the user; awaiting the Supabase Auth team's technical guidance. Support access is OFF. Strict Option A remains mandatory; no residual risk is accepted.** See [the current dependency record](supabase-support-status.md). Do not submit a duplicate ticket. This guide is retained as the historical submission procedure; it authorizes no provider change, support-access grant or external message by an agent.

## Existing-ticket follow-up

The acknowledgement and private reference are recorded in the dependency record. Follow Supabase's [official formatting guide](https://supabase.com/kb/troubleshooting/formatting-support-requests-for-faster-resolution) for any later reply: nine prescribed sections, fewer than 300 words where possible, verified facts/exact errors, clear uncertainty and no private credentials or personal information. `docs/support/supabase-refresh-reuse-follow-up.txt` is a review draft only. Keep the originally submitted request unchanged; do not send the draft merely because the ticket was acknowledged.

Before any approved future reply, run `node scripts/verify-supabase-support-request.mjs --follow-up`, then manually review facts and privacy. This checks the draft's structure/word count against the guide plus the existing known-private-value/pattern checks. It sends nothing, copies nothing to the clipboard and grants no approval. A passing result does not authorize external submission or raw attachments.

## Historical initial-submission procedure

The request separates expected behavior, actual behavior, reproduction, evidence dates, test results and source-level inference. It does not assert a confirmed vendor vulnerability. The earlier privacy report is historical because this draft has changed; rerun the local checker below before copying it. The checker compares the two outgoing text files against configured local private values and bounded patterns, prints only categories and SHA-256 hashes, and makes no network request. It is a scoped check, not proof against every possible secret or approval to upload other files.

```powershell
Set-Location -LiteralPath 'C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory'
node .\scripts\verify-supabase-support-request.mjs
```

The current refined draft passed the check: `artifacts/supabase-support-request-review-final-1792152229096.json`. Its checker has twelve passing focused tests and a passing TypeScript check. These results concern document privacy tooling, not resolution of the provider behavior.

Continue only when it reports `"passed":true` and `"completePrivateContext":true`, then manually review the request. A failed check prints categories without the matching content. Do not paste private values here to resolve it.

## Submit through the official private channel

1. In your regular browser, sign in to [Supabase Support](https://supabase.com/support) and choose **Open support ticket**. Its official destination is [the dashboard support form](https://supabase.com/dashboard/support/new).
2. Select the existing isolated Mitsa development project in the form. Do not select a separate production project. Let that private project selector provide the project context; the request body contains no project identifier.
3. If a category is offered, choose the closest Auth/session or technical-support category. Explain that this is a private behavior/security clarification. Do not assert an outage, confirmed exploit or CVE. Form fields and available categories may vary; this guide has not inspected your signed-in form.
4. Use the subject and body in `docs/support/supabase-refresh-reuse-request.txt`. Copy the Subject line into the subject field and the remaining text into the description. Read it before selecting Submit.
5. Initially attach nothing. In particular, do not upload `.secrets`, `.env*`, raw artifacts, Auth-table exports, screenshots, browser HAR files, cookies, request bodies, SQL dumps or a project archive. Local evidence can contain identifiers even when it contains no credentials.
6. Submit the private ticket yourself. Keep the ticket number privately. When sharing their reply back with Codex, omit personal addresses, project/account/session identifiers, private attachments, credentials and token values. The Auth guidance and any proposed configuration changes are sufficient.

The [official support page](https://supabase.com/support) confirms that response times depend on plan and severity. No paid upgrade or guaranteed turnaround is assumed. If the form is unavailable, return through that official page; do not publish this report in GitHub issues or Discord as a fallback.

## Confidential security reporting if appropriate

Supabase's [official security.txt](https://supabase.com/.well-known/security.txt) directs vulnerability reports to [its HackerOne program](https://hackerone.com/supabase). If support requests security triage, or you decide to report this as a potential provider security issue, read the current program scope and submit privately there using the same sanitized body. Select classifications only supported by the evidence; no severity or vulnerability class is established by this review. Do not publicly disclose the report. A HackerOne report would also be submitted by you, not automatically by Codex.

## Private clipboard option

This command copies only the prepared sanitized request. It does not read credentials, contact Supabase, change settings or submit a ticket.

```powershell
Set-Location -LiteralPath 'C:\Users\Luke\OneDrive\Documents\ChatGPT\Fireworks_Inventory'
Set-Clipboard -Value (Get-Content -LiteralPath '.\docs\support\supabase-refresh-reuse-request.txt' -Raw)
```

After pasting the request into the private form and reviewing it:

```powershell
Set-Clipboard -Value ''
```

## Before any follow-up attachment

The approved initial submission is the request text only. Any additional test code or evidence must undergo a new content review, including its imports/configuration and incidental identifiers. Do not assume that a file is safe because its filename says “sanitized.” Never share an existing access/refresh token, even if believed expired or revoked. Provider clarification must precede implementation of a suggested change; current migration, MFA, signup and provider-setting approval boundaries still apply.
