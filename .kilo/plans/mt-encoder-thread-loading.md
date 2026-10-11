# Fix loading of threaded Emscripten encoders

## Goal

Keep runtime capability detection and single-threaded fallback intact, make threaded AVIF, JXL, and WP2 Emscripten encoders load their pthread workers when codec JavaScript is emitted under a hashed Rollup filename, and ensure the production deployment enables the existing capability check.

## Findings

- JXL correctly selects its MT+SIMD branch in `src/features/encoders/jxl/worker/jxlEncode.ts:25–33`.
- The generated MT codec main module posts `Module["mainScriptUrlOrBlob"]` to each pthread worker, but does not initialize that field.
- The generated worker falls back to a literal relative import such as `import("./jxl_enc_mt_simd.js")` when that field is absent (`codecs/jxl/enc/jxl_enc_mt_simd.worker.js:1`).
- Rollup emits the codec chunk as AMD, while the generated pthread worker loads `urlOrBlob` with native dynamic `import()`. Passing the AMD chunk URL causes `ReferenceError: define is not defined`; pthreads need a native ESM module URL.
- The raw Emscripten module uses relative `.worker.js` and `.wasm` names, so dedicated ESM/worker/WASM sidecars must be emitted with content-hashed filenames and their references rewritten together. The current transform passes the ESM sidecar URL to pthreads and tracks its worker/WASM sidecars as dependencies.
- The same Emscripten pthread worker pattern is present in AVIF, JXL (SIMD and non-SIMD), and WP2 (SIMD and non-SIMD). OxiPNG uses a different Rust/WASM threading path.
- Dev selects MT, but the live URL originally selected ST because its document response omitted COOP/COEP. The static build emits both directives in `_headers` (`src/static-build/index.tsx:97–109`), but GitHub Pages did not apply that file.
- Cloudflare now adds COOP `same-origin` and COEP `require-corp`; the live browser confirms `crossOriginIsolated === true` and `SharedArrayBuffer` is available. `checkThreadsSupport()` still relies on the WASM thread probe and nested `Worker` support (`src/worker-shared/supports-wasm-threads.ts:3–16`).

## Implementation plan

1. Keep the generated `_headers` COOP/COEP rules and confirm the live Cloudflare response and `crossOriginIsolated` state remain correct.
2. Add a focused Rollup transform in `rollup.config.mjs` for browser Emscripten MT codec entry modules. Emit each original ESM codec module plus its same-directory worker and WASM sidecars, set `Module["mainScriptUrlOrBlob"]` to the ESM asset URL, and reference the sidecars for service-worker precaching.
3. Limit the transform to the AVIF, JXL, and WP2 browser MT encoder modules; do not change ST modules, runtime thread detection, or OxiPNG.
4. Keep the transform build-time so regenerated Emscripten codec artifacts receive the fix without editing generated outputs by hand.
5. Build the app and inspect emitted assets to confirm the main codec sidecar is native ESM, its worker/WASM sidecars resolve, and the AMD feature-worker module passes the ESM URL to pthreads.
6. Browser-smoke-test JXL MT+SIMD encoding in Firefox, then MT AVIF/JXL/WP2 variants where supported. Confirm local and live builds select MT and encode successfully, while unsupported environments continue to use the ST fallback.

## Acceptance criteria

- The JXL SIMD worker receives a URL to the native ESM sidecar rather than attempting to import the AMD feature-worker chunk.
- Browser MT AVIF, JXL, and WP2 modules have same-directory ESM/worker/WASM sidecars available for pthread initialization.
- Existing capability detection and ST fallbacks are unchanged.
- The live document is cross-origin isolated and its encoder worker's thread check passes, so supported browsers select MT on production.
- `npm run build` succeeds and browser encoding succeeds through the JXL MT+SIMD path.
