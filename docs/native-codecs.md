# Native codecs and WebAssembly

Squash separates codec implementation artifacts from the browser-facing feature. Native codec code and its JavaScript/WebAssembly outputs live under [`codecs/`](../codecs/); TypeScript adapters under [`src/features/`](../src/features/) initialize and call those outputs. A codec format may have multiple variants for browser support, such as baseline, SIMD, or threaded builds.

## Codec source and build entry points

Each codec directory has its own layout and build instructions. Inspect its `package.json`, Makefile, Cargo manifest, and README before building; there is no single command that rebuilds every codec.

- C++ codec builds commonly use [`codecs/build-cpp.sh`](../codecs/build-cpp.sh) and [`codecs/cpp.Dockerfile`](../codecs/cpp.Dockerfile), which provide an Emscripten toolchain in Docker. For example, [`codecs/webp/package.json`](../codecs/webp/package.json) invokes the C++ wrapper, and [`codecs/webp/Makefile`](../codecs/webp/Makefile) describes source download, build variants, and output files.
- Rust/WASM builds commonly use [`codecs/build-rust.sh`](../codecs/build-rust.sh) and [`codecs/rust.Dockerfile`](../codecs/rust.Dockerfile). For example, [`codecs/rotate/package.json`](../codecs/rotate/package.json) invokes that wrapper.
- Other codecs may have distinct scripts, dependencies, or build inputs. Check the codec-specific files rather than assuming the C++ or Rust example applies.

These container wrappers require Docker. Individual Makefiles may download pinned upstream source archives, so building can also require network access. Codec builds are separate from the normal root web-app build: `npm run build` bundles the artifacts already present; it does not run every `codecs/*` build script.

Build artifacts such as generated `.js`, `.wasm`, and declaration files appear alongside codec sources in the relevant subdirectories (for example, [`codecs/webp/enc/`](../codecs/webp/enc/)). Follow each codec's existing conventions when deciding which outputs to regenerate and include in a change. The encoder selectors also show available version labels; see [codec version generation](codec-versions.md) for their sources and update workflow.

### OxiPNG

Build OxiPNG's single-threaded and parallel packages with `npm --prefix codecs/oxipng run build`. The default package uses the Rust 1.98.1 stable toolchain. The parallel package is the exception: it uses pinned nightly-2025-11-15 because `wasm-bindgen-rayon` requires nightly `build-std` to compile an atomics-enabled WebAssembly standard library. The build image installs both toolchains.

The release profile skips `wasm-opt` because the optimizer bundled with the pinned Emscripten 2.0.8 image cannot process the generated module's multiple tables. If the optimizer is upgraded, verify it accepts both OxiPNG variants before enabling optimization again. See the [OxiPNG README](../codecs/oxipng/README.md) for the codec-local build notes.

### MozJPEG

Build MozJPEG with `npm --prefix codecs/mozjpeg run build`. Its Makefile downloads the pinned v4.1.1 source and builds the static library with CMake through the Emscripten Docker wrapper. Rebuild this codec after changing its upstream version or wrapper, then run the root build to verify the generated artifacts are bundled.

## Connect a codec to the app

For an encoder, trace the WebP example through these layers:

1. Codec artifacts and option types: [`codecs/webp/enc/`](../codecs/webp/enc/).
2. Shared output metadata and defaults: [`src/features/encoders/webP/shared/meta.ts`](../src/features/encoders/webP/shared/meta.ts).
3. Worker initialization and encode call: [`src/features/encoders/webP/worker/webpEncode.ts`](../src/features/encoders/webP/worker/webpEncode.ts).
4. User-facing option controls: [`src/features/encoders/webP/client/index.tsx`](../src/features/encoders/webP/client/index.tsx).
5. Feature discovery and worker bridge generation: [`lib/feature-plugin.js`](../lib/feature-plugin.js) discovers the feature metadata and worker file during the web-app build.

Use the corresponding decoder worker and encoder/decoder dispatch paths when integrating decoding; decoder dispatch is explicit in `decodeImage()` in [`src/client/lazy-app/Compress/index.tsx`](../src/client/lazy-app/Compress/index.tsx), not inferred from a `shared/meta.ts` file.

When choosing among baseline, SIMD, or threaded variants, check the adapter's feature detection and initialization logic. For example, WebP checks SIMD support in `webpEncode.ts`; other codecs may check threads as well. Keep fallback behavior valid for browsers without the optional capability.

## Offline asset handling

Review [`src/sw/to-cache.ts`](../src/sw/to-cache.ts) when adding or renaming codec JS/WASM files or variants. It imports selected codec entry points explicitly and uses feature detection to choose which bundles to precache. Update both the asset imports and the relevant selection logic when the new artifact must be available offline. A successful Rollup build alone does not prove that the service-worker cache includes every intended variant.

## Build and verify

Run a codec's own build command only when changing its native source, bindings, or generated artifacts, and follow that codec's package scripts and build files. Then run the root `npm run build` to verify the app can bundle the outputs. For changes to codec selection, encoding/decoding, or options, also exercise the format in the browser with a representative image and verify a fallback-capability path when available.
