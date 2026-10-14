# Android test APK compression

The compact package keeps the original native Cocos code, meshes, skeletal animations,
all 50 chapter maps and all 7 mode maps. It uses the same test certificate/package ID
as the full APK and can replace that installed test package. It is not a store release.

Source art is never resized, deleted, or overwritten. Only distribution resources change.

1. Build a fresh full APK with `build-android-test.ps1`, then `compile-android-test.ps1`.
2. Run `android-active-resources.cjs <output>/runtime-resources.json` with Node.
3. Run `compact-android-apk.py --apk <full-apk> --manifest <output>/runtime-resources.json --output <output>` with Python/Pillow.
4. Run `sign-compact-android.ps1 -OutputDirectory <output>` to align, sign and verify.
5. Run `verify-compact-assets.py <signed-apk> --output <output>`, then
   `test-compact-cocos-routing.cjs <output>` with Node.
6. Rerun the compactor with `--audit-only` on the signed APK into a separate verification
   directory; the dependency closure must contain no omitted files.

The active resource manifest is generated from ArtV2Assets and the current enemy catalog,
plus reviewed dynamic load families in BattleWorld, HomeWorld and UI/audio systems.
Update it when adding new resource-loading entry points. Do not reuse it blindly for a
new release. Cocos exported import dependencies are followed transitively, including
packed JSON and CCON v2 animations. Shared pack tables are kept in their original form;
only unused sections and their UUID index entries are removed.

ImageAsset's serialized native extension changes from PNG index `0` to WebP index `4`,
matching Cocos 3.8's native deserializer. The native engine must have `USE_WEBP=ON`.
The tests use the installed engine's actual Config class and native deserializer.
Android's `resources.arsc` must remain ZIP_STORED and start on a 4-byte boundary.
`verify-android-apk.py` checks both the central and local ZIP headers and the actual
data offset. Signature verification and `zipalign -c` alone do not detect an
incorrectly compressed resource table. This condition is required for apps
targeting Android 11 or newer and was added after a MIUI installer rejected the
first compact package. To repair that existing package without touching artwork,
run `repair-android-resource-table.py <apk> --output <output>`, then align/sign.
Albedo/maps use quality 93 at original dimensions; UI, FX, normal/material data maps
use pixel-exact lossless encoding. Alpha equality is checked for every image.
An encoding is used only when it is smaller than its PNG source.

Package validation is not Android device testing. Test startup, all modes, fusion,
transparent effect edges, audio and save persistence on the target phone before release.

## Native display regression (2026-09-28)

An installed MIUI build displayed only the home scenery. `ArtV2Backdrop` used camera
priority `-5`; native Cocos `scene/Camera.h` stores that field as `uint32_t`, and
`core/Root.cpp` sorts it ascending. The backdrop consequently rendered after the UI
and erased it. All cameras now use explicit positive ordering (background 0,
world 10, UI 20). The native viewport uses `FIXED_HEIGHT`; decorative home/loading
scenery covers the physical viewport uniformly. Authored battle geometry keeps its
registration and receives an ocean extension underneath its wide-screen margins.

Run `node --test tests/native-presentation.test.cjs` from `game`. To check the actual
compiled bundle, set `GOWAYGUI_PRESENTATION_BUILD` to the script-build directory and
run the same test. This checks bootstrap camera values with native unsigned ordering
and 16:9, 19.5:9, 20:9, and 21:9 layouts; it does not simulate GPU rendering.

For a script-only update, rebuild against `build/android-test-20260928/data` using
`build-expedition-scripts.cjs`, then run `patch-android-scripts.py <previous-apk>
--build <script-build> --output <output>` followed by `sign-compact-android.ps1`.
The patch tool verifies every unchanged APK payload and preserves the already
compressed resources. No new art or native components may be added this way without
a separate resource/native export.

## Redmi Note 9 loading investigation (2026-09-28)

The device reaches the home page but exits immediately after opening battle loading.
No device log is available; texture-memory pressure is a demonstrated risk, not a
confirmed crash diagnosis. Compressed APK size is not decoded image memory.

`android-phone-textures.py` creates a phone-only texture tier from the original
exported PNGs, using the previous compact package's `image-routing.json`. Model
textures are capped at 1024 pixels and whole monster codex portraits at 512. UI
atlases, map paintings, meshes, animations, resource UUIDs and gameplay data stay
unchanged. Albedo retains the existing q93 encoding policy; material data and
portraits are lossless after resizing, and all alpha channels are checked.
Use a separate output directory. Run without `--build` to prepare the cache/report,
then with `--build <fresh-script-build>` to compose the unsigned APK; sign and
verify with the tools above. The report's decoded RGBA totals cover affected
textures across the package and are **not** measured peak RAM.

Native runtime changes cap imports at two, use 30 FPS, skip the unused HomeWorld
behind the illustrated homepage, and load full-page/monster artwork on demand.
World-owned queues retire pending requests on cancellation and clean up partial
effect loads. Secondary-page backgrounds and touch veils use the visible viewport.
The Android trial's Settings → 加载诊断 retains the last eight loading stages across
process restarts. This trace locates the loading boundary; it does not replace a
system crash/tombstone log.

Run `native-resource-loading.test.cjs`, `battle-arrival.test.cjs`,
`native-presentation.test.cjs`, and the compiled-art demand-loading check. Device
acceptance still requires home → continue adventure, repeated battle entry/exit,
rank 2/3 fusion, all modes, and secondary-page layout on the Redmi itself.
