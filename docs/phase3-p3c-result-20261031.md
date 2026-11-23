# P3-C — created and protected; final settings verification INCONCLUSIVE

## Actual hosted result

Created exactly one project, `mitsa-fireworksinventory`, ID `prj_kd0rBsWC3pzvbY6LGeTUGUEwxiDD`, owned by `lukemendoza` (`team_C7i6iroBHmpUkM99weoPGnHw`). The connected owner was verified before creation. The exact pinned creation and settings bodies were used once each.

Creation, settings and independent project-read responses all report Vercel Authentication enabled with `deploymentType=all`. The settings response and independent read report Node.js `24.x`, Next.js, no live deployment and no domains. Creation initially returned provider-default Node.js 26.x; the separately approved settings update changed it to the reviewed 24.x. No extra update occurred.

The deployment listing is empty. The environment listing is empty, including zero hidden Production variables. There were no deployment, environment, Git-attachment, domain/alias, Supabase, account, email or paid-resource writes.

## Why the whole milestone is not PASSED

The native connector summarizes project responses and omits persisted `installCommand`, `buildCommand`, `rootDirectory`, `outputDirectory`, `publicSource`, `previewDeploymentsDisabled`, `sourceFilesOutsideRootDirectory`, `autoAssignCustomDomains`, `autoExposeSystemEnvs` and Git-link details. The accepted bodies explicitly requested the approved values, but acceptance alone is not independent verification of persistence.

The local CLI fallback failed first with `fetch failed` in the restricted network environment. With network access it returned the exact error `You do not have access to the specified account`. Native connector ownership works; the CLI connection is not established as authorized for this team. No alternative mutation or automatic repair was attempted.

Therefore: **INCONCLUSIVE — hosted creation/protection and zero-deployment/environment checks passed, remaining settings cannot yet be independently confirmed.** Do not repeat creation or the settings write.

## Cost and hostname

The connected account reports active Hobby billing. Current official documentation says All Deployments Vercel Authentication requires no paid add-on: https://vercel.com/docs/deployment-protection . No subscription or paid setting was changed. This does not approve or quote future deployment usage.

The native project and alias preflights returned 404. Independent public hostname probes were inconclusive because of network/tool reachability. The created project reports no domains. `https://mitsa-fireworksinventory.vercel.app` is the requested eventual production URL, not a currently assigned or live website. No replacement hostname or explicit alias assignment occurred.

## Budget and preservation

- Project creations: **1/1**, successful.
- Settings updates: **1/1**, successful.
- Read-only allowance: **15/15 charged/reserved**, including failed reachability/CLI checks and conservative CLI authorization/auxiliary reservations. Eight native Vercel read tool calls completed; two public hostname checks and two CLI invocations were attempted. Internal CLI HTTP request counts were not available, so do not misreport all 15 reservations as successful API reads or refund unused reservations.
- Deployments, environment writes, Git attachments, explicit domain/alias writes and Supabase operations: **zero**.

The attempt is sealed locally. Existing P3-A/P3-B result files and evidence are unchanged; no new checks or writes targeted either Supabase project. Retained users, MFA and businesses were outside the execution path. Private creation/settings and postflight receipts remain in `.secrets/phase3-p3c-20261031-v1/`. Original publication, database and historical evidence remain intact.

## Next boundary

Correct the local Vercel CLI login/team access privately, then approve only the five-read verification scope in `docs/phase3-p3c-verification-only-approval-20261031.md`. Do not disclose tokens. The current budget is consumed; the next scope is separate, not a reset. No further hosted operation was executed.

P3-D is prepared conditionally in `docs/phase3-p3d-protected-preview-approval-20261031.md` and remains unapproved. Strict Option A remains BLOCKED under SU-519045. Registration and mail remain disabled; no settings were changed in either Supabase project.
