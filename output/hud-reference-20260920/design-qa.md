# 战斗 HUD 图片还原验收

Source: F:/Codex/Projects/gowaygui/output/hud-reference-20260920/reference.png
Viewport: 1664 × 941 CSS px; reference 1664 × 941 pixels. Cocos uses a 1280 × 720 design canvas with physical edge anchoring.
Scope: combat HUD. Existing 3D actors, maps, portraits, skill illustrations and actual battle statistics are retained, as requested. The preparation/bench management screen is a different state from the combat reference.

## Comparison history
- Previous build: P1 horizontal miniature portrait cards, square spell frames, oversized top bar, missing status icons and rectangular automatic button.
- First reference build, in-app browser tab 3 at http://127.0.0.1:7626/?preview=all-maps&map=0&v=hud-reference-20260920 : full screenshot at wave 1, 0:01. Top status band and bottom roster/spell/switch proportions now align with the reference. P2: avatar lower edge overlaps names; cyan canvas bands visible behind top/bottom HUD.
- Revision 2: isolated rectangular portrait crop leaves a dedicated name row. Extended scenery behind HUD leaves the playable map, route UVs, actors and camera unchanged. Final capture: in-app browser tab 3, http://127.0.0.1:7617/?preview=all-maps&map=0&v=hud-reference-r2-20260920, 1664 × 941, wave 1 at 0:00 and 0:32. Avatar/name separation and scenery behind both HUD bands visibly verified.

## Fidelity checks
- Fonts: Microsoft YaHei; deep navy text; bold top status, names and numeric counters. Corrected speed/pause weight.
- Spacing: reference 800 × 54 px status band; implementation 793 × 55. Bottom tray approximately 1398 × 153 px, 5 portrait columns then 5 circular spells, thin dividers, switch.
- Colors: white/pearl surface, navy text, green/blue HP, cyan count dots; existing illustration colors retained.
- Assets: existing character/skill assets; Lucide status/badge icons from upstream SVG with ISC license in game/art-source/hud-reference. No rasterized HUD screenshot used.
- Content: names and health reflect actual companions; spell count is the actual learned count, not fabricated level values. HP and cooldown update in combat.

## Interaction checks
- Eight HUD/gesture/placement tests: passed. TypeScript check and Cocos built-core regression passed.
- Browser: new build enters chapter 1 and begins wave 1; round icons, automatic switch and status display observed.
- Console: existing enableRetina deprecation and browser autoplay timeout; no new HUD exception observed.

final result: passed
Final browser interactions: automatic switch changed from on to off, round cooldown countdown displayed, pause opened battle menu. Console error query returned []. Focused review of top icons/status text, portrait/name/HP rows and spell/switch regions found no remaining overlap or clipped controls. P3: library status icons have slightly different strokes from the illustration; existing portrait/skill artwork intentionally retained. Full-screen scenery and 3D models remain the existing game assets; this is HUD fidelity, not a replacement of world art. Browser screenshots are retained in the task tool results at the above URL.
