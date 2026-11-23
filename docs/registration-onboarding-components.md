# D/E acceptance components — inactive local checkpoint

The user selected **managed Supabase with its supported session-terminating refresh path**. Preserve Strict Option A, existing Auth architecture and SU-519045. No self-hosted migration, one-hour exception, hosted test or provider change is approved. The preceding goal turn made concrete local implementation progress; this turn advances the missing acceptance driver without repeating A/B/C-A or provider experiments.

## Implemented

- `scripts/lib/onboarding-browser-driver.mjs`: normal signup and approved-notice forms, actual server-registration evidence, human inbox acknowledgement, provider-issued code entry, password reauthentication, new TOTP enrollment, trusted-MFA inspection, trusted workspace/initial-location creation, exact-session logout, returning password/TOTP sign-in and recovery using the retained authenticator. It never inserts an allowlist, uses Admin verification, binds a factor itself or bypasses the application workspace transaction. It pins the approved recipient and notice references and suppresses private field/URL/provider errors. Secret-bearing continuation goes only to the supplied encrypted-evidence port; public status omits credentials, codes and factor material.
- `scripts/lib/onboarding-counted-fetch.mjs`: injected provider transport classifies Auth, signed registration commands, RPC and server CAPTCHA operations; reserves before dispatch; blocks other targets/admin paths; forbids redirects; propagates cancellation; and performs no automatic retry. Importing never selects a default global fetch. This must be wired into Next's outbound traffic as well as direct probes: browser actions cannot count SSR Auth requests by themselves.
- `scripts/lib/onboarding-execution-scope.mjs`: source/fixture/notice/approval/strict-trace validation before ledger creation, exact recipient binding, immutable append-only budgets, no budget resets on restart, retained-identity denial, durable mail no-replay claims, absolute execution deadline, cleanup margin and exact reviewed SQL sets. It rejects one-hour/resource-only proof. It grants no security approval or baseline acceptance.

These are executable **components**, not a complete authorized hosted D/E runner. `hostedAcceptanceCompleted` remains false. All constructor dependencies in tests are OFFLINE injected ports; passing them is not evidence that a real inbox, browser, session, MFA binding, workspace or recovery succeeded.

## Verification

**56 OFFLINE tests / five files passed**, including real method sequencing against fake Page/transport ports, recipient/notice mutation, missing receipt, wrong server evidence, premature privilege assignment, untrusted MFA, incomplete logout, recovery replay/factor changes, error privacy, exhausted authority, source changes, no-replay claims, restart continuity, cleanup boundaries and SQL allowlisting. TypeScript and Node syntax checks pass. The earlier sandbox cache failure and failed TypeScript iterations remain in the execution history; the final normal-Windows test run and TypeScript check pass. No real browser, Next process, database, worker, Auth request or email was launched by these tests.

## Remaining local integration

1. A single supervised execution shell must supply all real adapters: exact fixture absence/collision checks; encrypted credential/continuation persistence; provider-issued encrypted message binding and human receipt; independent fixture/session/MFA/membership/ownership probes; logout and recovery negative probes; and direct tenant negatives.
2. Bind the counted transport to **every** outbound request made by the isolated test Next server, not merely a direct Supabase client. Pin the new Next/browser/worker supervisor and actual cleanup paths. Request errors must abort the protocol, preserve spent slots and never trigger account recreation or unconfirmed resend.
3. Integrate the existing real worker/control/preservation code and verify the C-B-to-D observation transition. Do not silently adopt a new baseline or erase original evidence. C-B must have actually passed before a D execution can be authorized; historical Yuno success is not that evidence.
4. Complete source-bound F restart/failure adapters and calibrate the finite request ceilings against the final real execution paths offline. Prepare the exact execution manifest only when this integration is complete. No new hosted approval is requested for incomplete bindings.

The old legacy journey helper inserts development allowlist rows and is therefore **not** used by the new driver. Existing old tests and helpers remain untouched as historical/legacy coverage.

## New D/E ceilings are a proposal, not a grant

The execution-scope source proposes a separately approved combined `D-E-journey-v1`: one direct database connection; 12,000 operator SQL / 10,000 write-capable calls / 12 transaction statements; 200 Auth, 120 signed-command, 600 resource, six server CAPTCHA, four Management and 240 console requests; six emails/five SMTP verifies; two new fixtures/factors/workspaces/locations; one worker, one isolated Next server and one browser launch; 5,400 seconds total with the last 120 reserved for closure. Internal provider SQL effects remain separately reconciled, not claimed as exactly observable operator statements.

These proposed ceilings account for server-side requests that the old browser-action specifications did not measure. They **do not** amend, reuse or extend any old approval, C-B allowance or spent attempt. The complete executable package still needs review, and no actual D/E authority record exists. Cleanup cannot send mail, create accounts or launch processes. Actual Management payloads must remain restricted by the reviewed service-flag adapter; a counter alone does not authorize arbitrary provider changes.

After a supported managed correction and separately approved strict regressions pass, the existing C-B package remains the next hosted acceptance boundary. Until then, continue only the independent local integration above. Registration, external delivery and public release remain unapproved and inactive.
