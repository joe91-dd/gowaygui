# Design QA — Pearl battle HUD

Status: passed

Date: 2026-09-27

## Reference and scope

Approved first concept: output/hud-review-20260927/01-pearl.png. Compare its top battle viewport against the implemented game, not the bottom presentation sheet. Scope is the ivory/pearl/gold HUD, ground pads, reward cards and approved recruitment economy. Existing map, turtle assets, routes and standing coordinates remain authoritative.

## Visual verification

Reference and final implementation were displayed together for comparison. Final evidence:

- output/pearl-hud-20260927/prep-final.png (1280×720)
- output/pearl-hud-20260927/mobile-final.png (844×390)
- output/pearl-hud-20260927/blessings-final.png

Matched visual hierarchy: short top plaques, illustrated bottom dock, prominent gold recruit and orange start, five original circular skill illustrations, separate manual/auto and one-click controls. Ground pads have no numerals and render below characters. Three blessing cards use large distinct art with concise readable effects and details buttons. Mobile preserves aspect ratio with side margins.

## Fixed during QA

- Atlas sprites initially used source sizes: explicit custom dimensions restored.
- Ground station material rendered white: textured shader mode corrected.
- Pads were too upright: flattened into ground perspective.
- Reward effects and world boss damage text clipped: layout/text corrected.
- Toast contrast insufficient: dark text on cream corrected.
- Skill illustrations undersized: increased final diameter to 90.

No remaining P0/P1/P2 issue observed in the tested views. P3/intended differences: existing game font and real actor assets retained; skill rims are simpler than concept art; no ornamental full-screen frame. Real ledger displays 0 after the initial two recruits rather than the concept's illustrative 90.

## Functional evidence and limits

Typecheck and script build passed. Focused economy tests passed, including old save compatibility, independent cooperative ledgers, recruitment limits and atomic failures. All 57 map/slot configurations compare unchanged with the prior build. Browser verified recruitment, start, 2X, first-boss rewards, manual targeting, raid preparation and world boss battle. Arena reached successful results, but its active HUD was not separately captured. These are representative UI checks, not an exhaustive full campaign playthrough. Final browser error log was empty.

Playable build: http://127.0.0.1:7662/?preview=all-maps&all-modes=1&balance=coast&map=0&cache=20260927pearl-final

## Approved VFX integration — 2026-09-27

Status: passed for the tested views and event paths. Detailed scope, assets, tests and limits: output/approved-vfx-20260927/README.md.

Compared the approved frost, healer and enemy atlas pages with runtime rendering. Increased open-center area volumes after the first pass looked too small. Added curved per-ally healing links, corrected bounce origins, retained actual 2/3/4 projectiles under particle pressure, and fixed arena opponents using generic enemy attacks. Native warning geometry has consistent red fill and edge. Short floating values remain readable over the battlefield. Existing pearl HUD/map composition retained.

Proof: multi4-final.png, frost-final.png, heal-final.png and warning-runtime.png under output/approved-vfx-20260927. All images are actual Cocos-rendered captures; the VFX acceptance view exposes the same production renderer. Representative chapter and arena combat observed, with focused compiled-simulation tests for skills/world boss. Not an exhaustive all-enemy/all-level manual walkthrough or mobile-device performance certification.

Final cross-mode checks: endless recruited and started; local raid completed wave 1 and opened blessing choices; world boss started and displayed actual damage and skill effects. Healer hostile pending attacks now pass both direct and JSON-restored snapshot validation. No new console error in the final world-boss run; earlier intentional server restart interrupted loading and was recovered by reload. Live two-device co-op was not retested.
