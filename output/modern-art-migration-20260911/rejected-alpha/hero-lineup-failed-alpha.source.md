# Hero lineup asset provenance

Status: **REJECTED FOR TRANSPARENT RUNTIME USE — alpha generation failed.**

Requested destination: `game/assets/resources/art-modern/hero-lineup.png`.
Built-in image_gen used; no API/CLI fallback, no Python image editing, no source code/meta changes.

## Inputs and generated originals

Approved home style and identity reference:
`output/modern-art-directions-20260911/08-approved-home.png`

First original:
`C:/Users/Administrator/.codex/generated_images/01a0910a-1b8c-73e1-a8be-3ca00e6f57fd/exec-25fe09d2-2416-458d-9691-96491b6da0cb.png`
2158 × 729, Format24bppRgb.

Corrected original (copied byte-for-byte into requested destination):
`C:/Users/Administrator/.codex/generated_images/01a0910a-1b8c-73e1-a8be-3ca00e6f57fd/exec-f3ba25c9-2910-4660-a6ac-b36f1a6fd3c9.png`
2157 × 729, Format24bppRgb.

## Visual and technical inspection

- Exactly five complete original turtles, left to right stone / spike / crystal / leaf / bubble.
- Identities, modern stylized 3D materials, clothing, broad lighting and expressions follow approved home.
- All bodies and equipment visible; no scenery or UI.
- Characters do not overlap one another.
- **FAIL: gray checkerboard is baked into RGB, not alpha.** Corner alpha returns 255; format has no alpha channel.
- **FAIL: strict equal-width tile layout not achieved.** First tank wider than its 20% cell. Must not slice into five equal cells.
- This image is retained as a source candidate, not an integration-ready transparent atlas. Do not load directly over the home environment. Alpha extraction and cell repacking would need a separately authorized workflow or successful regeneration.

## Initial prompt

Use case: stylized-concept.
Asset type: production game CHARACTER LINEUP ATLAS for original mobile game 哥喂龟.
Input image 1: approved HOME visual and character identity reference only. Reproduce its clean high quality stylized 3D character materials, appealing expressions and designs, not the interface or scene.

Create ONE genuinely TRANSPARENT RGBA PNG with exactly FIVE complete independent upright anthropomorphic turtle heroes in one horizontal row on a completely empty alpha background. Wide 3:1 canvas, intended 3000 x 1000 if possible. Divide mentally into 5 equal-width vertical tiles. Place centers at 10%,30%,50%,70%,90% of image width. All five complete bodies and all held objects confined within their own tile with generous transparent margins, at least 5% tile width between silhouette and each tile border. No overlaps. All feet on same baseline around 88% image height, entire silhouettes including headgear/weapons within 12%–88% height. Similar head height, consistent render scale; tank broader and others slim. Full front three-quarter poses turned slightly toward camera right, faces visible. Identical neutral daylight studio lighting and subtle self-shadow. NO floor, base, stand, ground-shadow, background glow, circle, tile, labels, text, UI, scenery, watermark or framing.

Left to right EXACT order:
1 stone 岩盾 tank: sturdy warm yellow ochre turtle skin and cream belly plates, chunky friendly rock shell and forearm armor, few bright blue crystal facets, big determined amber/brown eyes and confident friendly smile. Closely match the large central turtle in reference.
2 spike 叶灵 archer: bright green hood, simple layered leaf cloak over green turtle shell, warm yellow green face, expressive amber eyes, wooden bow held compactly vertically at side with arrow visible, competent adventurous friendly expression.
3 crystal 珊歌 mage: turquoise skin, ivory and royal-blue hooded robe with minimal warm trim, aqua blue eyes, compact wooden staff with one blue water spiral at top; playful curious face; no sprawling particle trail.
4 leaf 阳光 healer: warm golden yellow turtle, modest straw hat with tiny leaf accent, simple sage-green tunic and shell, one warm amber lantern held close, welcoming smile.
5 bubble 潮行 controller: turquoise turtle, compact navy armor and shell, small pale gold details, anchor-shaped staff held compactly upright, friendly alert blue-eyed face, no spikes extending outside tile.

Keep these SAME original recognizable home identities. Modern crisp stylized 3D with broad readable shapes, moderate detail, polished soft gradients, controlled specular, no photoreal skin, no ornate medieval ornament. Must be suitable for cropping into five equal cells and displaying individually on a modern cream/cyan home UI. Real alpha transparency, not a checkerboard picture and not white matte. Exactly five characters, all fully visible with their feet and equipment.

## Targeted correction prompt

Use case: background-extraction and precise-object-edit.
Input image: exact FIVE original turtle characters to preserve.
Deliver a production sprite atlas with REAL RGBA ALPHA transparency. The input accidentally contains a gray checkerboard; REMOVE ALL CHECKERBOARD PIXELS and replace with fully transparent alpha. Do not draw a checkerboard, gray, white or other background. Export actual transparency.
Layout correction only: Keep all five character identities, costumes, expressions, rendering and left-to-right order. Arrange on a 3:1 canvas in five STRICTLY equal-width cells centered at x=10%,30%,50%,70%,90%. Reduce the first rock turtle enough to fit entirely between x=2% and18%, including crystals, hands and feet. The second completely between x=22% and38%; third x=42%–58%; fourth x=62%–78%; fifth x=82%–98%. The tank can be shorter than others if necessary to preserve its broad natural shape. Every character must fit their specified equal cell without touching an adjacent one. Keep all feet at around y=86%, with plentiful empty alpha above and below. No ground shadows, no ground planes, no added elements, no text. Thin magical details remain confined to cell. Fully transparent background PNG with meaningful alpha channel.

