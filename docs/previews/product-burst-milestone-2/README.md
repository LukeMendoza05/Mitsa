# Milestone 2 visual comparison

This scene uses **neutral proxies**, including the Dragon P22 target hero. Its dimensions, packaging form and artwork are unverified. No authentic Dragon asset has been implemented. See `docs/assets/dragon-p22/README.md` for the missing six-face photographs, measured dimensions, identity evidence and image-use rights.

## Compared with Milestone 1

| Aspect | Milestone 1 | Milestone 2 |
| --- | --- | --- |
| Hero | Similar emphasis across generic packages | One larger, readable, front-facing neutral hero |
| Choreography | Spread to 50%, late gathering after 72% | Cluster 0–15%, burst 15–45%, hold 45–60%, converge 60–85%, grounded hold 85–100% |
| Camera | Strong pullback made spread small | Close studio framing with extra distance only for narrow desktop aspect ratios |
| Depth | Restrained central arrangement | More than six scene units of depth; foreground supports and two smaller background forms |
| Reassembly | Apparent intersection near 85–95% | Ordered lateral destinations; independently swept oriented boxes do not intersect at 2,001 sampled positions |
| Final display | Floated above offset shadows | Box bases meet the same studio floor by 85%, with contact shading |
| Static view | Displayed a misleading 0% | Explicit static storyboard; live percentage appears only while animation is running |
| Asset authenticity | Generic neutral packages | Still neutral; Dragon P22 is a documented intake target, not a branded or measured model |

The initial cluster deliberately permits projection overlap to establish a dense hero composition. That is distinct from physical mesh intersection. All seven silhouettes are readable at maximum spread in the 1440px capture. Desktop tests check each projected box corner at 0/25/50/75/85/100% at 1024/1280/1440px with a framing margin. This is not a physical-device certification or proof over every possible browser size.

## Performance comparison

Installed Edge 155.0.4283.45, Windows, ANGLE/AMD Radeon Graphics via Direct3D11; 900px viewport height; DPR 1; 180 active-scroll samples at each width. Development build, unthrottled. P95 browser frame cadence:

| Width | Milestone 1 | Milestone 2 |
| --- | --- | --- |
| 1280px | 16.8ms | 17.1ms |
| 1440px | 17.1ms | 17.0ms |

Cadence remains similar within ordinary run-to-run variation, below the 33ms target. Draw calls increased from 15 to 22 and renderer textures from three to four for contact shading; geometry count remains two. This increases rendering work even though a meaningful cadence regression was not observed in this run. Numbers are browser scheduling measurements, not GPU timer queries, field performance or sustained physical mobile tests. The recording's 25fps is its encoding rate, not this measured renderer cadence.

## Evidence

`0.png`, `25.png`, `50.png`, `75.png`, `100.png`, `mobile-static.png`, `forward-reverse.webm`, `performance.json` and `recording-status.json`. The video includes slow forward and reverse scrolling with a pause at maximum spread. Milestone 1 evidence remains preserved separately.

Visual limitation: no real artwork, folds, seams, measured product proportions or authentic finish can be judged yet. Soft directional shadows remain stylized studio shading. Development diagnostics may include the existing CSP-blocked React stack reconstruction warning and the dependency's Three.Clock deprecation; security headers have not been weakened to remove them.

Next step is user review of this motion composition and provision of the documented Dragon P22 intake. Broader modeling, public integration and deployment remain gated.

## Verification limitation

The experiment's eleven-test browser suite passed; an additional security-header case also passed. Final build/typecheck, seven security tests, production experiment 404/header checks, and isolated synthetic reconciliation passed. Full `npm run test` is **not green**: both aggregate attempts passed 55 unit and 26 integration tests but finished with 51/52 production browser tests passing. The unchanged public landing's direct-story progress case failed on desktop in the first run and mobile in the second; three separate unchanged desktop rechecks passed. Its cause is unresolved, and the public landing/test were not modified within this milestone. See the packaged execution report for exact commands and results.
