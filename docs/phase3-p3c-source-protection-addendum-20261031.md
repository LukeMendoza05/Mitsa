# P3-C completion addendum — one environment read and obsolete-field correction

Status: READY FOR EXPLICIT APPROVAL. No new project request or hosted change was executed during this research. P3-C remains INCONCLUSIVE pending the decision and bounded read below.

## Verified reason the field cannot be checked

The current official [Create Project API](https://vercel.com/docs/rest-api/projects/create-a-new-project) marks `publicSource` deprecated: “Accepted for backwards compatibility but ignored.” The [Find Project API](https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name) does not expose that property. The original approved false value was sent, but that cannot establish a persisted control. No repeated project GET or settings rewrite can prove this retired field is false.

Vercel's current [Build Features documentation](https://vercel.com/docs/builds/build-features#special-paths) describes `/_src` and `/_logs` as protected routes requiring Vercel authentication; anonymous third parties cannot read source or build logs through them. This is public provider documentation, not a hosted test of Mitsa. The existing project separately has verified All Deployments Authentication. No deployment currently exists for a runtime path check.

Proposed evidence correction: classify `publicSource=false` as an **obsolete, non-operative API-field check**, while retaining the actual requirement that anonymous visitors cannot browse deployment source or logs. Record the provider-documented current protection and verify anonymous denial of `/_src` and `/_logs` during separately authorized P3-D, within its existing 20 HTTP/browser checks. Do not claim those future runtime probes have passed now. This correction does not waive Strict Option A, change authentication policy, accept session risk or allow public access.

## Exactly one new hosted read, if approved

Scope: `P3-C-environment-completion-readonly-v1`.

Use only the native connected tool `mcp__codex_apps__vercel_filter_project_envs` with these exact arguments:

```json
{
  "idOrName": "prj_kd0rBsWC3pzvbY6LGeTUGUEwxiDD",
  "teamId": "team_C7i6iroBHmpUkM99weoPGnHw",
  "decrypt": "false"
}
```

Maximum **one read-only Vercel tool request**, zero CLI lookups, retries, pagination, project writes, environment writes, Git attachments, domain assignments, deployments, paid changes, Supabase calls, Auth requests or emails. Reserve the request durably before dispatch. Do not reset the historical 15-check allowance or the fully consumed five-check scope.

Before dispatch: verify the new manifest, unchanged original P3-C review, latest filtered project receipt and all prior evidence digests. The receipt must still show the exact project/team, approved build settings, All Deployments Authentication, disabled automatic Preview/domain assignment and empty latest deployments/aliases. Preserve P3-A/P3-B. If a prerequisite fails, stop before dispatch.

Expected result: `envs=[]` and `hiddenProductionEnvCount=0`, with no incomplete pagination. Do not request decrypted values. Do not print or retain unexpected environment values, encrypted payloads or keys. Retain only counts and a sanitized failure category if unexpected entries appear. An error, missing hidden-count field, any entries or incomplete result is INCONCLUSIVE and must stop; do not repair or retry.

If this single read passes **and the obsolete-field evidence correction is approved**, accept P3-C using the existing verified project settings and the new environment observation. Preserve all earlier INCONCLUSIVE reports as historical evidence; write a new acceptance record rather than rewriting them. P3-D still requires separate approval. The accepted snapshot is not continuous monitoring or registration-release acceptance.

## Exact approval wording

> I approve the P3-C source-protection addendum: classify the ignored, deprecated publicSource field as non-operative while retaining authenticated source/log access and P3-D anonymous-denial checks. Approve one native read-only environment-list request for prj_kd0rBsWC3pzvbY6LGeTUGUEwxiDD in lukemendoza, decrypt=false, with zero retries or writes. Preserve all consumed budgets. If it returns a complete empty inventory and the reviewed prerequisites match, accept and seal P3-C. Do not deploy or execute P3-D.
