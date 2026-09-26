# Home rock-tank hero keyed source

Generated 2026-09-12 with built-in image_gen. No Python/image postprocessing. Copied byte-for-byte from generated original.

Asset: `game/assets/resources/art-modern/home-stone-keyed.png`
Reference: `output/modern-art-directions-20260911/08-approved-home.png`
Original: `C:/Users/Administrator/.codex/generated_images/01a0910a-1b8c-73e1-a8be-3ca00e6f57fd/exec-c1493b5c-5641-4696-ba03-c1d8793e3577.png`

## Verification

- **1254 × 1254 pixels**, Format24bppRgb.
- One complete rock-armored golden turtle; no base, UI, ground or extra character.
- Self shadows and reference pose, head/body proportions, orientation and friendly expression preserved closely; generated recreation, not a pixel-identical extraction.
- Tall shell crystal, both fists, legs, all visible blue toe claws within image boundaries.
- Approximate content bounds from read-only 2px sampling: x **58–1216**, y **26–1188**. Character content height **1163 pixels**, exceeding 900px request.
- Safe full-body source crop could use x54,y22,width1167,height1171 (keep a few pixels around silhouette); do not crop the highest crystal.
- Opaque magenta chroma-key input; NOT alpha. Background sample RGBs (234,16,239), (247,4,250), (245,3,248). Reuse tolerant runtime keying rather than exact #FF00FF equality; feather boundary and suppress residual purple spill.
- Intended display ~460 × 430; source is sufficient without large upscaling.
- No source code, browser, or meta edits by asset producer.

## Prompt

Use case: background-extraction / identity-preserve.
Asset type: high-resolution single game character portrait for real-time chroma-key composition.

Reference image: the approved HOME SCREEN for original turtle game 哥喂龟. Extract ONLY THE LARGE ROCK-ARMORED YELLOW TURTLE in the center-right of this reference. This is an identity-preserving extraction, NOT a redesign. Ignore all small portraits, all UI, scenery and other elements.

Create one square image, ideally 1536x1536 or at minimum 1024x1024. The single turtle fills 88–94% of the canvas height, with ALL toes, feet, fists, shell crystals and top crystal tips included. At least 900 pixels of character height. Do not create a tiny character; this is the high-resolution main hero render for a 460x430 on-screen hero slot. Tight but safe full-body framing. Center the complete silhouette with a 3–5% safe margin. Exactly one turtle.

Preserve the approved reference turtle's exact appearance and natural proportions: huge broad warm yellow/ochre turtle body, creamy belly armor plates, friendly confident closed-mouth smile, amber/brown eyes, thick expressive brows, softly rounded wide face, compact sturdy legs with blue crystal toe claws, natural bare golden fists, chunky gray-brown faceted rock shoulder/forearm/ankle armor, bulky rock shell with several bright cyan/blue crystals including tall top crystal. The head/body ratio, facial features, pose and camera angle must match reference closely. Three-quarter view, body and face pointing slightly toward camera right. Feet wide apart, both arms bent loosely down by body, fists near hip level, chin slightly raised. Keep the exact friendly heroic attitude; no angry expression, no new costume or decorations.

Lighting/render: MATCH the reference's clean sunny high-quality modern stylized 3D rendering, warm clean face and belly, cool gray rock facets and translucent blue crystals, controlled highlights and clear broad readable shapes. Preserve self shadows on the character only.

Background MUST be perfectly uniform opaque RGB#FF00FF vivid magenta CHROMA KEY, not transparency. No checkerboard. No scene, no floor, no platform, no cast ground shadow, no horizon, no vignette, no gradients, no magenta lighting on the character, no extra particles, no halo, no text or logos, no UI. Clean crisp silhouette appropriate for real-time chroma key extraction. Every background pixel flat same magenta.

