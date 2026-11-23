# Mitsa — authentication and workspace UI refinement

## Scope and finishing criteria

Refine the current interface, retaining routes, information architecture, native POST forms, server-managed sessions and authorization. Done means the implemented authentication/account/workspace views have a consistent visual hierarchy, spacing and feedback; the requested seven widths reflow; keyboard and automated accessibility checks pass; and TypeScript, unit and production-build checks pass. This is a presentation task, independent of the unresolved provider refresh-family question.

No Supabase configuration, Auth hook, database policy, migration, account, factor, membership, workspace record or mail-delivery gate is changed. Existing completed onboarding is not repeated. No inventory, POS, reporting or other unfinished module is added. Landing-page presentation and motion remain unchanged.

## Reference lock and decisions

The supplied Steep style document and the existing Mitsa implementation are the primary visual targets. Before screenshots are in `docs/previews/ui-refinement/before`. Live Refero style/screen/flow research was attempted and returned `NO_SUBSCRIPTION`; no subscription purchase is required. Bundled Refero form/focus/touch/accessibility guidance and the existing approved redesign record provide the fallback references. React quality guidance supplements implementation review, not visual direction.

Preserve Source Serif 4 regular headings, Inter controls/body, white/fog/mist surfaces, dark pill actions, 16px input corners and 24px cards. Keep peach in its existing landing-page role. No new decorative accent, illustration, gradient, icon dependency or animation system is introduced.

| Decision | Source / role | Application |
|---|---|---|
| Retain editorial typography and neutral surfaces | Supplied Steep reference; approved Mitsa identity | Smaller application section headings retain the serif while improving working density |
| 4px spacing scale | Supplied reference; user's spacing requirement | Shared `--space-*` variables instead of unrelated form/card gaps |
| 224px desktop workspace rail | Existing implemented navigation and user's sidebar requirement | Same routes and role-conditioned links, active-page marker and separate account actions |
| Native mobile disclosure | Bundled keyboard/progressive-enhancement guidance | Menu works as HTML details; Escape returns focus with JS; selection closes it |
| Consistent field/helper/error rhythm | Bundled form guidance; captured account-password spacing defect | 8px label gap, 20px field separation and correctly placed password help |
| Compact member rows | Captured oversized equal-height member cards | Identity alongside editing controls on wide screens; stacked on smaller screens |
| Readable four-step setup context | User's existing onboarding sequence | Account → Email → Authenticator → Workspace; no fake business progress or new backend state |
| Honest managed CAPTCHA status | User's automatic-verification requirement | Explains that verification may complete automatically; callbacks and validation unchanged |

## Audit and corrections

| Area | Observed issue | Implemented correction |
|---|---|---|
| Workspace navigation | Long wrapped underlined link lists; no current-page state | Desktop rail; `aria-current="page"`; accessible mobile menu; switching/security/sign-out grouped together |
| Workspace hierarchy | Generic global H2 reached 64px inside working pages | Scoped 28–36px introductions and 26px section headings |
| Account password fields | Workspace label margins compounded the reusable field spacing | Shared field-label override removes the extra gap; password toggle retains input clearance |
| Member management | Short Owner card stretched to the height of editable member forms | Content-sized rows with identity/control columns at 1280px+, stacked below |
| Account navigation | Different destinations/order on each account page | Shared profile/security/agreement/privacy/recovery navigation with active state; assigned operator link remains permission-conditioned |
| Registration feedback | Previous attempt's message persisted while editing | Summary clears on edit; field errors and fresh submission validation remain; pending/failure focus and entered values preserved |
| Sign-in feedback | URL error and client error could become disconnected | Initial server message enters the same interactive feedback state; corrected flagged fields clear locally |
| Password help | Signup requirements appeared after confirmation | Help sits directly under the password and remains linked through `aria-describedby` |
| Recovery layout | Forgot/reset pages used a different narrow presentation | Existing auth layout supports recovery, keeping the same brand, form width and labels |
| CAPTCHA | Prompt implied a manual challenge was always necessary | Automatic-verification wording; expired/error callbacks still clear the proof |
| Resend | Ready button accompanied by text implying more waiting | Distinct ready/countdown/delivery-closed wording; readiness announcement without announcing every second |
| Form submission | Generic errors and pending text had no shared treatment | Scoped feedback surfaces; focusable error; stale request failure clears on edit; shared pending locks preserved |
| Application footer | Authenticated pages returned marketing navigation and Sign In | Application footer links to implemented workspace/account and draft policy destinations; landing footer unchanged |
| Loading | No scoped account/workspace loading fallback | Lightweight server-rendered loading views announce loading without inventing identity, records or metrics |
| Tables and lists | Wide data needs a safe mobile boundary | Keyboard-focusable contained horizontal table scrolling; readable padding and identifiers; document itself does not overflow |
| Empty/denied/error states | Needed consistent comparison with the rest of the interface | Included in source/browser audit; shared surfaces, type and recovery links retained |

An early visual review found that simply forcing descendants of closed details to display did not reveal desktop navigation in current Chromium. The implementation now uses separate CSS-selected desktop and native mobile containers, with only the relevant navigation exposed. Account actions are inside the mobile disclosure to avoid pushing workspace content far down the page.

## Tokens and component standards

`src/app/globals.css` defines 4/8/12/16/20/24/32/40/48/64px spacing variables, 52px control height, 16px control radius, 24px surface radius, a 464px maximum form width, 64ch reading width, distinguishable control borders and semantic error colors. Existing 48/32/20px page gutters remain. Tiny decorative preview typography is intentionally separate from real form/control sizing.

Workspace content uses a maximum 1200px shell; standalone account pages cap at 1040px. Desktop navigation is 224px with a 48px content gap; below 1024px it becomes a disclosure. Below 768px cards stack and form actions fill the available width. Buttons remain at least 44–48px high; text inputs/selects are 52px. Reusable password fields keep 84px of toggle clearance. Focus rings and reduced-motion rules remain active.

## Verification method and privacy

The test-only Vite renderer in `tests/visual` imports the actual page/component/CSS source and supplies deterministic synthetic data through local aliases. It is not a Next.js application route, authorization bypass, live CAPTCHA test or substitute for hosted security verification. It never loads environment files, replaces the live Auth client, or reaches real provider accounts. Its loopback-only server rejects non-GET mutations; browser tests block external requests. No real account, verification email, MFA factor or workspace is created or recreated. Synthetic QR/setup-key screenshots are masked.

The suite covers sign-in/signup, email verification and resend states, forgot/reset password, account settings, MFA setup/enrollment/challenge, security/recovery/privacy/agreement, onboarding/selection, workspace overview/locations/members/settings/permissions/ownership/history, operator review, invitation, denied/not-found/error/loading and empty selection states. Widths: **320, 375, 390, 768, 1024, 1280, 1440px**. Automated WCAG A/AA-tagged checks run at 320 and 1440px. Extra interaction cases cover stale errors, keyboard password visibility, confirmation mismatch, pending locks, network failure, navigation/role-conditioned links, resend availability, 200% text and a JavaScript-disabled menu using serialized rendered fixture HTML. That native-menu check does not claim a fresh end-to-end authentication test.

Before-and-after images are in `docs/previews/ui-refinement`; per-route images are in its `routes` subdirectory. Desktop, tablet and mobile screenshots were visually inspected. No screenshot contains existing account/workspace data.

Commands:

```powershell
npm run typecheck
npm run test:unit
npm run build
npx playwright test --config playwright.ui-refinement.config.ts
node scripts/capture-ui-refinement.mjs after
```

The fixture server is started by the Playwright configuration when needed. To inspect it manually, run `node node_modules/vite/bin/vite.js --config tests/visual/vite.config.mjs`, then open `http://127.0.0.1:3107/signup` or `/w/visual-workspace/members`. This is a synthetic visual preview; the real application remains at `http://127.0.0.1:3000`.

## Changed files

- Tokens: `src/app/globals.css`.
- Shared controls/layout: `src/components/site/{AuthForm,PasswordField,PostForm,Site,SetupProgress}.tsx`, `site.module.css`.
- Authentication: `src/components/auth/{AuthLayout,SignupForm,SignupChallenge,ResendCodeButton}.tsx`, `auth.module.css`; `src/app/{login,signup,verify-email,forgot-password,reset-password,onboarding}/page.tsx`.
- Workspace/account: `src/components/workspace/{WorkspaceShell,PageNavigation,PageLoading}.tsx`, `workspace.module.css`; `src/app/settings/account/page.tsx` and its `{security,privacy,recovery,terms}/page.tsx`; `src/app/w/[workspaceSlug]/members/page.tsx`; account/workspace `loading.tsx` files.
- Local verification only: `tests/visual/*`, `tests/e2e/ui-refinement.spec.ts`, `playwright.ui-refinement.config.ts`, `scripts/capture-ui-refinement.mjs`, generated audit evidence/screenshots.

## Limits and remaining concerns

These are UI/component checks, not a renewed claim that all authentication security has passed. Live Turnstile/provider hooks, RLS and session-reuse behavior are unchanged. The refresh-family clarification and general-registration gate remain documented separately in `docs/authentication-security-signoff.md`. No new real inbox, native live registration, hosted recovery or existing-user MFA challenge was run during this audit.

Automated accessibility checks and keyboard/text testing do not constitute a full manual screen-reader certification. Long permissions/history tables intentionally scroll inside their labeled regions on narrow screens. Legal text remains draft/test material. Review the actual authorized workspace with normal use, and report any content-dependent issue that synthetic fixtures cannot reproduce; no further backend or account action is needed merely to inspect the refinements.

Final verification: **289 unit tests across 43 files, TypeScript, production build and 34 browser cases passed.** The browser suite exercised 29 route/state views at seven widths (203 layout checks), with 58 automated accessibility scans reporting zero violations. Initial failures came from the fixture's signed-in verification state, a client error component invoked outside React, and a native-menu locator; those fixture defects were corrected and the complete final suite passed. The first sandbox unit attempt failed during module loading; the unchanged suite passed outside sandbox file virtualization. The final verification-disclosure fixture adjustment also passed its two targeted checks.

The real loopback Sign In page returned HTTP 200 with Mitsa metadata and its native POST action. The fixture server returned 405 for a mutation and 403 for private-file access. Twenty-seven compiled public JS files contained no fixture code. The bounded results and scope are recorded in `artifacts/ui-refinement-results.json`.

### Exact application source paths touched

```text
src/app/globals.css
src/app/login/page.tsx
src/app/signup/page.tsx
src/app/verify-email/page.tsx
src/app/forgot-password/page.tsx
src/app/reset-password/page.tsx
src/app/onboarding/page.tsx
src/app/settings/account/page.tsx
src/app/settings/account/privacy/page.tsx
src/app/settings/account/recovery/page.tsx
src/app/settings/account/security/page.tsx
src/app/settings/account/terms/page.tsx
src/app/settings/account/loading.tsx
src/app/w/[workspaceSlug]/members/page.tsx
src/app/w/[workspaceSlug]/loading.tsx
src/components/auth/AuthLayout.tsx
src/components/auth/SignupForm.tsx
src/components/auth/SignupChallenge.tsx
src/components/auth/ResendCodeButton.tsx
src/components/auth/auth.module.css
src/components/site/AuthForm.tsx
src/components/site/PasswordField.tsx
src/components/site/PostForm.tsx
src/components/site/Site.tsx
src/components/site/SetupProgress.tsx
src/components/site/site.module.css
src/components/workspace/WorkspaceShell.tsx
src/components/workspace/PageNavigation.tsx
src/components/workspace/PageLoading.tsx
src/components/workspace/workspace.module.css
```

`playwright.config.ts` excludes the separate fixture suite from ordinary hosted tests; `playwright.ui-refinement.config.ts` runs it explicitly. No application dependency was added. The test renderer uses Vite already installed through Vitest.
