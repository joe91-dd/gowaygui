# Hero lineup keyed atlas provenance

Generated with built-in image_gen, 2026-09-11. User-approved style extended into original character assets. No Python/raster postprocessing, no source code or meta changes by asset producer.

Asset: `hero-lineup-keyed.png`
Source original:
`C:/Users/Administrator/.codex/generated_images/01a0910a-1b8c-73e1-a8be-3ca00e6f57fd/exec-ac8b8a82-f67b-4730-aab4-504da45f7aa6.png`
Dimensions: **2172 × 724**, Format24bppRgb. Copied byte-for-byte.

Reference: `output/modern-art-directions-20260911/08-approved-home.png`
Intermediate keyed original:
`C:/Users/Administrator/.codex/generated_images/01a0910a-1b8c-73e1-a8be-3ca00e6f57fd/exec-d26d5d00-3992-46d5-b7ae-c291da981c67.png`
Previous failed alpha versions moved outside consumable game assets to `output/modern-art-migration-20260911/rejected-alpha/`.

## Usage contract and inspection

This is an **opaque magenta chroma-key source**, NOT a transparent image. Parent implementation will remove background at runtime using a tolerant material.

Exactly five complete, visually checked turtles in order stone / spike / crystal / leaf / bubble. No scenery, UI, labels, bases or overlapping characters. Each silhouette fits entirely inside its equal-width 20% cell. Tank was intentionally shrunk by a targeted correction to fit its cell and must be fit using its content bounding box when shown next to other large hero models. Four other poses retained.

Background has tiny generated variation; sampled RGB values include (231,15,239), (243,7,248), (242,6,247). **Do not use exact equality with #FF00FF.** Suggested initial runtime key classification: R>180, B>180, G<90, R-G>100, B-G>100; tune edge feather and magenta de-spill after visual verification.

Approximate non-key content bounds from read-only 2px sampling; coordinates are top-left origin, bounds inclusive. Add a few pixels when constructing UV rectangles:

| Role | Equal-width cell x | Content x/y bounds |
|---|---|---|
| stone | 0–433 | 88,326 → 326,572 |
| spike | 434–867 | 542,240 → 834,590 |
| crystal | 868–1302 | 944,230 → 1228,590 |
| leaf | 1303–1736 | 1343,240 → 1643,592 |
| bubble | 1737–2171 | 1751,220 → 2071,592 |

All feet/weapons complete and no crossing the equal-width cell boundaries. Final image has different source content heights; runtime should scale each cropped character by intended displayed body height. No claim of final 3D animated models: this asset is a raster presentation atlas.

## Generation prompt

Use case: stylized-concept.
Asset type: GAME SPRITE ATLAS with opaque CHROMA KEY magenta background, not a UI mockup.
Input image: identity and rendering reference for exactly five original upright turtle heroes of 哥喂龟.
Create ONE wide 3:1 image with exactly five complete full-body turtle characters in one row. Background MUST be a perfectly flat, uniform, solid RGB #FF00FF magenta at every empty pixel. NO transparency request. NO checkerboard, no gradient, no shadow, no halos, no floor, no scenery. The game will remove the magenta color in a shader.

CRITICAL ATLAS COMPOSITION: Mentally divide the image into 5 equal-width cells. The heroes should look SMALL WITH LOTS OF EMPTY MAGENTA SPACE around every one, not filling the image. Center their whole silhouettes precisely at x=10%,30%,50%,70%,90%. Each whole silhouette including weapons, crystals, hat and cape MUST fit within a MAXIMUM width of 13% OF THE WHOLE CANVAS, leaving 3.5% canvas width pure magenta on either side inside each cell. Hard bounding limits for all character pixels:
1: x=3.5% to16.5%.
2: x=23.5% to36.5%.
3: x=43.5% to56.5%.
4: x=63.5% to76.5%.
5: x=83.5% to96.5%.
All feet at y=80%; heads and highest weapons below y=25%. These percentages are mandatory. It is better for the tank to be small with generous spacing than to extend into a neighboring cell. Wide tank gets smaller uniform scale; do not squeeze its body unnaturally. Absolutely no neighboring silhouettes touching. All five fully visible. Big magenta margin at top and bottom.

Same friendly modern stylized3D materials, sunny studio light, clean broad shapes, recognizable approved home character identities, polished 3D gradients on CHARACTERS ONLY, soft self-shadow but NO background cast shadows. Front three-quarter faces turned subtly to the camera's right. Same neutral camera.
Left to right EXACT:
1 stone: warm ochre/yellow rock-armored turtle tank with cream belly and blue crystals, matching reference giant hero, friendly confident amber eyes.
2 spike: leaf-green hooded turtle archer, green leaf cape, wooden bow held CLOSE vertically at side, yellow-green face, amber eyes.
3 crystal: aqua turtle mage, ivory/royal-blue hood and robe, wooden staff held CLOSE upright with compact cyan water spiral, cheerful blue eyes.
4 leaf: golden-yellow turtle healer with straw hat, sage-green simple tunic, one amber lantern held CLOSE, kind face.
5 bubble: turquoise turtle controller wearing navy armor with understated pale gold trim, compact sea-anchor staff held CLOSE upright, alert friendly blue eyes.
NO text, labels, logos, UI, bases, ground, vignettes, borders, frames, extra characters, particle trails or magical effects spilling outside the 13% width limits. Background is only uniform vivid #FF00FF.

## Targeted cell correction prompt

Use case: precise-object-edit.
Edit ONLY the FIRST LEFTMOST ROCK TURTLE in this atlas. SHRINK the entire first turtle uniformly to 68% of its current size and translate it LEFT so its center is exactly 10% of the canvas width. Keep its feet aligned with the other turtles at their current baseline. There must now be LOTS OF EMPTY MAGENTA SPACE around the first turtle, and a WIDE EMPTY MAGENTA GAP between it and the archer. The first turtle must be much smaller and no longer wider than the archer.
Do NOT change the other FOUR turtles at all: preserve their pose, size, position, appearance, spacing and equipment. Keep exact same canvas width and height. All five fully visible.
Background everywhere outside the turtles: perfectly flat solid RGB (255,0,255), HEX #FF00FF magenta. No gradients, grain, noise, tint, shadows or checkerboard. Pixel-uniform color for chroma key. No text, no added objects.

