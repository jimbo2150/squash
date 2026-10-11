# Fix loading of threaded Emscripten encoders

## Goal

Keep runtime capability detection and single-threaded fallback intact, make threaded AVIF, JXL, and WP2 Emscripten encoders load their pthread workers when codec JavaScript is emitted under a hashed Rollup filename, and ensure the production deployment enables the existing capability check.

## Findings

- JXL correctly selects its MT+SIMD branch in `src/features/encoders/jxl/worker/jxlEncode.ts:25–33`.
- The generated MT codec main module posts `Module["mainScriptUrlOrBlob"]` to each pthread worker, but does not initialize that field.
- The generated worker falls back to a literal relative import such as `import("./jxl_enc_mt_simd.js")` when that field is absent (`codecs/jxl/enc/jxl_enc_mt_simd.worker.js:1`).
- Rollup emits the codec module and pthread worker with hashed names (for example `jxl_enc_mt_simd-CwYKeVX0.js`), so the fallback's unhashed URL returns 404. `import.meta.url` is transformed to the AMD module's `module.uri`, which is the emitted hashed module URL.
- The same Emscripten pthread worker pattern is present in AVIF, JXL (SIMD and non-SIMD), and WP2 (SIMD and non-SIMD). OxiPNG uses a different Rust/WASM threading path.
- Dev selects MT, but the live URL selects ST. `checkThreadsSupport()` depends on the actual worker's WASM thread probe and nested `Worker` support (`src/worker-shared/supports-wasm-threads.ts:3–16`); browser support alone is insufficient if the deployed page is not cross-origin isolated.
- The static build emits COOP/COEP directives in `_headers` (`src/static-build/index.tsx:97–109`), but the live host must deliver them on the document response for `crossOriginIsolated` and shared WebAssembly memory to work.

## Implementation plan

1. Verify the live document response includes `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, then confirm `crossOriginIsolated` and `checkThreadsSupport()` in the encoder worker. If the headers are absent, update the relevant deployment/header configuration; retain the existing generated `_headers` rules.
2. Add a focused Rollup transform in `rollup.config.mjs` for browser Emscripten MT codec entry modules that use `Module["mainScriptUrlOrBlob"]`. Initialize that field from `_scriptDir` immediately after the generated module initializes `Module`; in the emitted AMD module, `_scriptDir` resolves to `module.uri`, the actual hashed codec module URL.
3. Limit the transform to the AVIF, JXL, and WP2 browser MT encoder modules; do not change ST modules, worker fallback selection, runtime thread detection, or OxiPNG.
4. Keep the transform build-time so regenerated Emscripten codec artifacts receive the fix without editing generated outputs by hand.
5. Build the app and inspect emitted MT codec chunks to confirm they assign their own emitted URL before creating pthreads. Confirm the worker receives that URL and no longer requests an unhashed `*_mt*.js` fallback.
6. Browser-smoke-test JXL MT+SIMD encoding in Firefox, then MT AVIF/JXL/WP2 variants where supported. Confirm local and live builds select MT when supported and finish encoding, while unsupported environments continue to use the ST fallback.

## Acceptance criteria

- The JXL SIMD worker no longer requests `/c/jxl_enc_mt_simd.js`; it imports the hashed codec module URL passed from the parent.
- Browser MT AVIF, JXL, and WP2 modules use their own emitted URLs for pthread initialization.
- Existing capability detection and ST fallbacks are unchanged.
- The live document is cross-origin isolated and its encoder worker's thread check passes, so supported browsers select MT on production.
- `npm run build` succeeds and browser encoding succeeds through the JXL MT+SIMD path.
