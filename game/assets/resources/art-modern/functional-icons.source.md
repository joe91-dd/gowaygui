# Modern functional icons atlas

- Saved asset: `game/assets/resources/art-modern/functional-icons.png`
- Generated with the built-in imagegen tool, 2026-09-11.
- Source final: `C:/Users/Administrator/.codex/generated_images/01a0910b-24f7-7520-a07d-4f3b45c15889/exec-49f54155-677b-41ed-a054-38db48cfde65.png`
- SHA256: `06884AC874F1622594B9E2F7688051B839D668CFFCEE9EB542DCAEC1FB0BBDA2`
- References: approved `output/modern-art-directions-20260911/08-approved-home.png` (primary modern style), `09-battle-cohesive-composition.png` (skill motifs).
- Actual dimensions: **1254 × 1254**, RGB, **opaque cream background**, no alpha.
- Intended consuming components: home/secondary-page functional buttons and battle active-skill row; Cocos slices the atlas, this is not a page screenshot.
- The first generation and one targeted correction produced painted checkerboard RGB. Those are rejected and NOT copied as runtime assets. Parent directed opaque cream fallback; final has no checkerboard.
- Background is visually cream and near #FFF8EA, with slight generator variation. Sample RGB values at corners/gaps: (253,248,231), (254,249,234), (254,248,234), (252,246,228). It is not perfectly numerically uniform and must not be treated as exact chroma-key input.

## Slice order

Four columns and four rows, row-major. Use normalized quarter-tile UVs. If the Cocos rect API requires integer pixels, use boundaries **[0, 314, 627, 941, 1254]** on both axes; widths/heights alternate 314,313,314,313. All icon silhouettes have clear gaps from these boundaries.

| index (zero based) | row | column | id | content |
|---|---|---|---|---|
| 0 | 0 | 0 | turtles | Turtle head |
| 1 | 0 | 1 | synthesis | Three synthesis pearls |
| 2 | 0 | 2 | shop | Red-white canopy shop |
| 3 | 0 | 3 | trade | Balance scales |
| 4 | 1 | 0 | rental | Rental cottage |
| 5 | 1 | 1 | friends | Three friend busts |
| 6 | 1 | 2 | rankings | Gold trophy |
| 7 | 1 | 3 | stages | Palm island |
| 8 | 2 | 0 | endless | Infinity loop |
| 9 | 2 | 1 | dungeon | Rocky cave |
| 10 | 2 | 2 | arena | Crossed swords |
| 11 | 2 | 3 | skill-stone | Rock with shield |
| 12 | 3 | 0 | skill-spike | Leaf arrow |
| 13 | 3 | 1 | skill-crystal | Water vortex |
| 14 | 3 | 2 | skill-leaf | Golden lantern |
| 15 | 3 | 3 | skill-bubble | Cyan anchor |

## Visual QA

Inspected the final built-in result. Exactly 4 × 4 distinct icons in required sequence. Style is soft-sculpted modern 3D, predominantly cyan/navy with cream and gold, with green reserved for leaf skill. No words, frames, cut-off silhouettes, overlap across tiles, or visible checkerboard. Skill icon motifs are recognizable. Use on cream UI surfaces as requested by parent. No source code, importer meta, or browser modified by this asset task.

## Initial prompt

Use case: stylized-concept. Asset type: production game sprite atlas, ONE square 2048 x 2048 RGBA PNG with a genuinely transparent background. Reference Image 1 is the approved modern home screen: MATCH its soft-sculpted premium 3D functional icon language, turquoise/navy, warm cream, golden accents, rounded tactile forms, clean broad surfaces. Reference Image 2 supports the five role skill motifs only. Do not reproduce either page or any UI frame. This deliverable is just isolated sprites.

CRITICAL EXACT LAYOUT: four equal columns and four equal rows, 16 equal square tiles, strict row-major arrangement. Invisible 512 x 512 tile boundaries. Centers x=256,768,1280,1792 and y=256,768,1280,1792. Keep each entire icon including its subtle highlights within the central 350 x 350 area of its own tile, generous transparent padding. All icons similar perceptual size. Nothing crosses tile boundaries. No visible grid, no rectangles, no button discs, no labels, no lettering, no scene/background, no contact shadow floor, no watermarks. Actual transparent alpha, not a checkerboard drawing.

Row 1 from left to right:
1. friendly turquoise turtle HEAD portrait with cream cheeks, simple open friendly eyes, no body or square.
2. three polished synthesis pearls clustered as a triangle, two turquoise pearls below and one small warm gold pearl above, like the bottom navigation synthesis icon of reference 1.
3. a small cream shop front with red-white striped canopy, tiny rounded turquoise door, clean toy sculpture, no sign or text.
4. turquoise/navy balance scales with a gold pivot, very readable trading symbol.

Row 2 from left to right:
5. tiny turquoise-roofed cream rental cottage containing a single warm gold five-point ornament in the doorway, no text.
6. three rounded turquoise/navy friend bust silhouettes, one central larger and two smaller behind, not detailed people.
7. golden trophy cup with two handles and modest cream plinth.
8. stylized tiny cream island with two turquoise palms and blue sea rim, simple island adventure symbol.

Row 3 from left to right:
9. thick sculpted turquoise infinity loop, unbroken recognizable infinity, slight cream highlights.
10. dark blue-gray arched rocky cave entrance made from five broad faceted rocks, open transparent center.
11. two crossed short fantasy swords, blue-gray blades and restrained gold guards, friendly symbolic nonviolent icon.
12. rock defense SKILL symbol: broad faceted gray stone protected by a smaller cyan crystal shield accent, sturdy clear silhouette.

Row 4 from left to right:
13. green leaf arrow SKILL symbol: one luminous lime leaf-shaped arrowhead with two short leaf fletch trails pointing diagonally upper-right, compact, no background disk.
14. blue water vortex SKILL symbol: sculpted cyan-blue curling wave spiral with a few integrated rounded droplets, compact silhouette.
15. warm golden lantern HEALING SKILL symbol: small glowing amber lantern with navy handle, warm cream light inside; glow contained inside tile.
16. cyan ship anchor CONTROL SKILL symbol: thick aqua anchor with round top ring and upward curved flukes, clear navy volume and pale cyan edge highlight.

Render all sixteen from the same gently elevated front view and upper-left studio light, polished modern mobile 3D game assets matching reference 1, legible at 48 pixels, clean material transitions. Avoid old beveled metal plaques, wood signs, busy engraving, fine texture noise, realistic grit, rings/frames behind skill sprites, mockup screenshots, UI text. Exactly four rows and four columns.

## Rejected transparency correction prompt

Use case: background-extraction. Edit target: the attached icon sprite atlas. Preserve all 16 icon designs, colors, materials and exact row-major order. Fix only the background and atlas packing. The current image has an INCORRECT painted checkerboard and is 1254px, which is not usable as transparent art.

Return a TRUE RGBA PNG image with genuinely transparent alpha outside the icon silhouettes, not painted transparency, not a checkered white-gray background. There must be zero visible background pattern. Exact square output 2048 by 2048 pixels, divisible evenly into 4 columns by 4 rows of 512px tiles. Center each icon at (256,256),(768,256),(1280,256),(1792,256) etc for four rows. Scale icon within its own tile to max 350px wide/high, leaving at least 80px of transparent padding on each edge. Remove the previous checkerboard from holes in infinity/cave/anchor/scales as well. Do not add shadows extending outside silhouettes. No grid line, no text, no title, no frame. All sixteen existing icons remain 4 by 4 in the same sequence. Actual alpha channel required.

## Final accepted cream-background prompt

Use case: precise-object-edit. Edit the provided 4x4 game icon atlas. KEEP the same sixteen icon designs and same four by four row-major sequence. CHANGE ONLY BACKGROUND AND PADDING: replace all checkerboard pixels with absolutely uniform solid flat cream #FFF8EA. OPAQUE cream background, NO transparency requested. Remove the checker pattern completely including holes in infinity, scales, cave entrance and anchor. No gradients, no texture on the background. No lines between tiles. No frames or text. Keep the full image square. Each of the sixteen tiles occupies exactly one quarter of image width and height, all icons centered on evenly spaced grid centers. Shrink each icon about 18% within its existing tile so no silhouette touches a tile edge. Maintain the very polished modern sculpted 3D turquoise/cream/gold mobile game icon style. Do not generate a UI page. Final product is a single 4 columns x 4 rows icon sheet on perfectly uniform cream. All sixteen icons: turtle head, synthesis pearls, shop, scales / rental cottage, friends, trophy, island / infinity, cave, crossed swords, rock shield / green leaf arrow, blue water swirl, golden lantern, cyan anchor.

