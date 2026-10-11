# Update libjxl and surface codec versions

## Goal

Continue the work tracked in [upstream issue #1402](https://github.com/GoogleChromeLabs/squoosh/issues/1402) by updating the pinned libjxl source and generated JXL artifacts while preserving the existing single-threaded and threaded builds and automatic capability-based selection. Also show each codec's verifiable semantic version next to its name in both codec selectors. Generate version metadata during codec builds, querying the compiled codec when it exposes a version API; do not initialize every codec WASM module in the browser just to render the selector. Do not add a user-facing threading option.

## Findings

- `codecs/jxl/Makefile:1–6` pins libjxl to `9f544641ec83f6abd9da598bdd08178ee8a003e0` and currently defines only `mt` and `mt-simd` CMake build directories.
- `codecs/jxl/Makefile:23–29` builds the nominally single-threaded encoder and decoder against the `mt` CMake build. This is the coupling that must be removed to ensure the baseline WASM is genuinely built without pthread support.
- Upstream libjxl v0.12.0 (latest release found during planning) defines `JPEGXL_ENABLE_WASM_THREADS` and conditionally adds `-pthread` to CMake compile/link flags. This appears to address the configuration problem, but the Emscripten builds must verify it.
- The JXL adapter already chooses the `mt`, `mt-simd`, or baseline encoder at runtime (`src/features/encoders/jxl/worker/jxlEncode.ts:23–36`); the application decoder uses `dec/jxl_dec.js`.
- The selector renders each encoder's static `meta.label` in `src/client/lazy-app/Compress/Options/index.tsx:253–265`; it appears in both comparison-side option panels. Metadata is sourced from each feature's `shared/meta.ts` through the generated registry.
- Version labels must match the codec artifact actually built, not a manually duplicated TypeScript string. Avoid browser-time WASM initialization solely to populate the dropdown; generate lightweight version metadata as part of codec builds.
- WebP and MozJPEG already expose native version functions, though their TypeScript declarations do not. AVIF/JXL should use upstream version APIs or generated headers when available; OxiPNG can use the resolved crate version from `Cargo.lock`. WebP2/QOI have only source commits identified, while browser-native encoders have no Squash-controlled codec version.
- Version display policy: show verified semantic versions; omit suffixes when only an opaque commit or browser-provided implementation is available.

## Implementation plan

1. Confirm the upstream release/commit to pin at implementation time (v0.12.0 was the latest release found during planning) and review its release notes/API changes against Squash's bindings.
2. Split the JXL Makefile's CMake configurations into a true non-threaded build (`JPEGXL_ENABLE_WASM_THREADS=OFF`), a threaded build (`ON`), and a threaded SIMD build (`ON` plus the current SIMD flags). Keep build outputs isolated so generated artifacts cannot link against the wrong `libjxl.a`.
3. Link `enc/jxl_enc.js` and `dec/jxl_dec.js` against the non-threaded build. Link `enc/jxl_enc_mt.js` and `enc/jxl_enc_mt_simd.js` against the corresponding threaded builds and `libjxl_threads.a`. Preserve the existing artifact names and runtime selection where possible.
4. Adapt `enc/jxl_enc.cpp`, `dec/jxl_dec.cpp`, and adapter typings only where the upstream API or headers changed. Ensure the baseline encoder wrapper does not instantiate/use a threaded pool and the baseline decoder does not require WASM pthread imports.
5. Rebuild all JXL artifacts with the repository's pinned Emscripten toolchain. Check that ST outputs are usable without WASM threads/SharedArrayBuffer and that MT outputs include the required pthread worker/runtime dependencies. If the latest libjxl cannot build with the current Emscripten version, identify the minimum toolchain adjustment and keep it limited to what the JXL upgrade requires.
6. Keep service-worker artifact selection and the JXL worker adapter in sync if output names or dependency lists change (`src/sw/to-cache.ts:34–38, 119–126`; `src/features/encoders/jxl/worker/jxlEncode.ts:23–36`). Retain automatic feature detection and fallback; add no mode setting or UI.
7. Generate lightweight codec-version metadata during codec builds. Prefer invoking a version API from the just-built codec/module where available (including adding missing wrapper exports and TypeScript declarations when needed); otherwise derive the value from authoritative pinned package metadata, lockfiles, generated headers, or release tags. Make the generated manifest correspond to the artifacts built and consumed by the app, so updates do not require manually editing labels in `shared/meta.ts`. Do not load each codec WASM module in the browser just to show the versions. Show verified semantic versions only; omit suffixes for commit-only QOI/WebP2 and browser-native encoders.
8. Render the generated version alongside `meta.label` in `src/client/lazy-app/Compress/Options/index.tsx:253–265`. Apply the same formatter to both comparison-side dropdowns, and leave unknown versions as the existing codec name without a fabricated suffix.
9. Add `docs/codec-versions.md` documenting how the selector obtains version data, which codec/version sources are available or unknown, how to regenerate metadata when updating/rebuilding a codec, and why browser-provided versions are not shown. Link it from `docs/native-codecs.md`.
10. Validate clean JXL codec builds and root `npm run build`, then browser-smoke-test JXL decode and encode through baseline, threaded, and threaded-SIMD paths, including existing fallback where threads are unavailable. Verify generated version metadata matches rebuilt artifacts and appears in both selectors. `docs/native-codecs.md:13–15, 29–37` notes codec artifacts are built separately and the app build alone does not rebuild them.

## Acceptance criteria

- libjxl is pinned to the selected current upstream revision, and generated artifacts correspond to that revision.
- A genuinely non-threaded JXL encoder and decoder build and run without relying on pthread-enabled WASM.
- Existing threaded JXL encoder variants build and run where supported; the existing automatic selection and fallback remain unchanged.
- Both codec selector dropdowns append verified semantic versions for codecs where known; version metadata is generated from the rebuilt codec or authoritative build input and is not manually duplicated in UI metadata.
- The app does not initialize all codec WASM modules merely to display versions; unknown and browser-native versions have no fabricated suffix.
- `docs/codec-versions.md` documents version sources and regeneration steps.
- No user-facing threading preference/control or unrelated codec/processor threading work is introduced.
