# Cocos and preview recovery — 2026-09-20

The earlier diagnosis of a missing graphics runtime was unconfirmed. The log at game/temp/build-logs/20260920-010911.stderr.log explicitly shows EPERM writing the editor engine import-map cache under C:/ProgramData/cocos. The subsequent engine query errors were downstream failures.

Run the installed Creator outside the restricted subprocess environment. Do not install arbitrary DLLs, disable antivirus, or retain --no-sandbox flags. The build tool now restores normal graphics selection and gives large asset builds a 900-second timeout.

The original 7617 preview service was stopped. It has been restarted outside the restricted execution environment. Rebuilding uses a separate recovery-20260920 output, preserving web-mobile as a rollback package. Full build result is recorded in game/temp/build-logs/latest-build.json.
Verified result: Creator exit code 36; complete build passed at 09:27 on 2026-09-20 (11m25s). Built-core regression passed against recovery-20260920. Port 7617 now serves that build; HTTP bundle SHA256 equals 23691d5d078e54f313425a3abb51ae60226673b6e89a29acfa756aa83e6ac0e5. GPU process ran normally outside the restricted environment. Play-Game.cmd starts/reuses the verified server and opens the browser; no firewall, driver, authentication or OS security setting was changed.
