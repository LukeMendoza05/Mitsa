# Mitsa — Supabase support dependency

## Current status — 22 October 2026, Asia/Manila

The user reports that the prepared private request was successfully submitted on **22 October 2026**, and Supabase confirmed: “Support request sent.” Awaiting the Auth team's technical guidance. This is a user-confirmed submission record, not a provider API inspection or a technical resolution.

The user subsequently confirmed acknowledgement under private ticket **SU-519045**. This reference is documented at the user's request; do not publish it or include it in public artifacts. An acknowledgement is not technical guidance or proof of a correction.

The user turned **Allow support access to your project OFF**. Support access remains unauthorized; Codex has not enabled it, submitted another ticket or changed any provider setting. No personal information, credentials or tokens are stored here.

**Strict Option A remains mandatory. No residual session-security risk or one-hour exception is accepted.** The historical failed refresh-family regression remains failed. Stage A is implemented; Stage C preparation can continue locally. Hosted installation, new service/secrets, account fixtures, external mail and activation each need separate approval. No completed live test budget may be reused.

## Guidance needed from Supabase

1. Explain terminal non-parent ancestor reuse in the hosted legacy path: rejection of R0, family revocation with a retained session, immediate renewal from formerly current R3, and continued actor acceptance of an otherwise valid bearer. Distinguish intended parent/concurrent grace exceptions from this sequence.
2. Identify the supported correction and exact release/configuration/rollout mechanism. Confirm whether the newer upstream path using `LogoutSession` is supported for this hosted project, and how legacy sessions are handled. An upstream code path alone is not a verified hosted correction.
3. State the atomicity and guarantees for terminal renewal denial and session termination observable by Mitsa's protected direct RPC/RLS checks. Clarify whether any service retains independent JWT acceptance; do not infer blanket revocation across every Supabase service.
4. Describe compatibility and rollback for concurrent legitimate refresh, parent retry, MFA, recovery and independent sessions. No resets, backfills, factor changes or paid upgrades are authorized by the support request.

## When guidance arrives

Review the non-sensitive technical reply and supported change first. Prepare an exact, budgeted synthetic protocol and obtain approval before any hosted mutation or Auth experiment. Require immediate and delayed renewal denial, former bearer denial at protected application and direct RPC/RLS boundaries, valid concurrent/parent retries, independent-session preservation, MFA/recovery compatibility and retained-account integrity. Stop on unexpected outcomes. Never install the rejected trigger or edit managed Auth tables.

See `strict-refresh-provider-resolution.md` for historical evidence and `support/supabase-refresh-reuse-request.txt` for the submitted request text. Keep that text as submission evidence rather than silently rewriting the sent report. Use the existing private ticket for follow-up; do not submit duplicates.

## Follow-up preparation — not sent

The user reviewed the original 256-word draft and explicitly instructed that it remain saved **without sending**. The Evidence section has since been clarified to separate the initial post-R0 state from the subsequent immediate-R3 replacement. The revised **266-word** draft passes the local nine-section/word-count and known-private-value/pattern checks. It is not the unchanged previously reviewed version and remains unsent. No substantive technical response has been received.

Read and apply Supabase's official [formatting guide](https://supabase.com/kb/troubleshooting/formatting-support-requests-for-faster-resolution): Summary, Impact, Expected behaviour, Actual behaviour, Steps to reproduce, Environment, Troubleshooting completed, Evidence, Request. Aim below 300 words, prioritize verified facts, preserve exact errors and evidence dates, label uncertainty, and exclude repetition, speculation and sensitive data.

`support/supabase-refresh-reuse-follow-up.txt` is a concise review draft for the existing ticket, not a new submission. Its body deliberately omits the ticket/project/account identifiers because the private thread already supplies that context. Do not send merely to acknowledge the acknowledgement; hold it until clarification is needed or the user approves a reply. Refresh only facts actually established by new evidence, then rerun the private local check and manually review. Do not change the historical submitted request to match this new format retroactively.

No current independent application task or C1 installation was newly authorized by the support-formatting request. Existing local preparation is complete; Stage C1 approval and the provider response remain separate boundaries. Keep Strict Option A blocked until a supported correction passes the separately approved hosted regressions.

## Evidence timeline clarification

| Observation point | Immediate-R3 run | Delayed-R3 run |
|---|---|---|
| Immediately after terminal R0 rejection | Session row retained; zero unrevoked family records. | Session row retained; zero unrevoked family records. |
| Subsequent R3 request | Sent immediately after R0 rejection; replacement issued, restoring one live family record. | Sent after a separate twelve-second wait; R3 rejected and no live family record restored. |
| Protected identity check | Existing bearer remained accepted. | Existing bearer remained accepted. |

The zero-unrevoked count describes the first observation point in each independent run, not the immediate-R3 run's final state. These are historical experiments, not new live checks or a verified provider fix. See `authentication-final-checkpoint-20261023.md` for completed work and remaining approvals.
