# HUD preparation preview delivery — 2026-09-20

- Full preview: http://127.0.0.1:7617/?preview=all-maps&v=hud-prep-r2-20260920
- Battle: http://127.0.0.1:7617/?preview=all-maps&map=0&v=hud-prep-r2-20260920
- Build: F:/Codex/Projects/gowaygui/game/build/hud-prep-r2-20260920
- Source change: 「下波情报」→「当前出战」；「合成」→「战备/合成」。
- Verification: targeted HUD/gesture/edge/switch/pearl tests 28/28; TypeScript check passed; built-core regression passed.
- Cocos full rebuild: existing validated recovery build is `recovery-20260920`; this label-only package is a minimal patch because the restricted Creator subprocess could not write its engine cache.
- SHA256: cfd630f42181dc4d031e645dc938c052b5423c3640aaa2d04af3649e68da533f
- Health: `GET /api/health` returned `ok: true`; preview index returned HTTP 200.
- Report: `docs/PROJECT_PROGRESS_20260920.md`.
