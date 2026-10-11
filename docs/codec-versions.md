# Codec versions in selectors

The encoder selectors display a semantic version as `(vX.Y.Z)` when Squash can determine one. Both comparison sides use the same generated version manifest. Codecs without a verifiable semantic version, including browser-provided encoders, appear without a version suffix; commit hashes are not shown.

`src/features/encoders/codec-versions.ts` is generated and must not be edited by hand. Run `npm run generate:codec-versions` to refresh it from the built codec artifacts and pinned package inputs. The root `npm run build` and `npm run watch` commands refresh the manifest before bundling. C++ and Rust codec build wrappers also regenerate it after a codec build.

For Emscripten codecs with version APIs, the generator initializes the existing Node-target module in a restricted build-time context and reads its version: libavif's `avifVersion()`, libwebp's `WebPGetEncoderVersion()`, MozJPEG's `version()`, and libjxl's `JxlEncoderVersion()`. The API value from the compiled artifact is authoritative. AVIF's Node-only introspection module is generated under ignored `node_modules`; when it is absent in a clean checkout, the generator keeps the checked-in manifest value from the last codec build. If a module is present but lacks its version API, its suffix is omitted rather than inferred from a potentially stale pin. OxiPNG's version comes from its resolved `Cargo.lock` dependency because the wrapper does not expose an upstream version API. These queries occur during build tooling; the browser does not initialize every codec to render selector options.

To update a codec version, rebuild that codec first so the version API and its artifacts match the new source, then regenerate the manifest (the codec build wrappers do this automatically). When adding a codec, add its Node-target module and version formatter to `codecs/generate-version-metadata.mjs` if it exposes a runtime version API. Otherwise derive a semantic version from authoritative build metadata that corresponds to the artifact, such as a resolved dependency lockfile. Do not add a hand-maintained version string to UI metadata. If no semantic version can be established for the built artifact, omit the suffix.

## libjxl build variants

The repository pins libjxl v0.12.0 as part of the update tracked in [upstream issue #1402](https://github.com/GoogleChromeLabs/squoosh/issues/1402). Its CMake configuration is built separately with `JPEGXL_ENABLE_WASM_THREADS=OFF` for the baseline encoder and decoder, and `ON` for the threaded encoder variants. Runtime capability detection and fallback remain unchanged. Rebuild the JXL package after changing its pin; its Makefile tracks the selected source version so an existing checkout is refreshed when the version changes.

All JXL encoder links (baseline, threaded, SIMD-threaded, and Node) use `-s TOTAL_STACK=8MB -s MAXIMUM_MEMORY=4GB`. High-effort encodes can exceed the default stack and 2 GiB heap. Use `TOTAL_STACK` with the repository's pinned Emscripten 3.1.1 toolchain; newer Emscripten versions use `STACK_SIZE` instead.

The v0.12.0 release removes private C++ headers used by the old encoder wrapper. The encoder now uses libjxl's public `JxlEncoder` API and the public thread-parallel runner for threaded variants; the decoder retains its float-output and sRGB/ICC conversion path with the updated ICC-profile signatures. The generated Node encoder and decoder modules expose libjxl's version API, while browser-facing artifacts keep their existing names and automatic threading behavior.

The public encoder API does not expose the old modular quality-pair control. Squash's existing modular quality curve is mapped through `JxlEncoderDistanceFromQuality()`; quality 100 uses the public lossless API, while quality-100 lossy-palette mode uses a small positive distance because libjxl rejects a zero distance unless lossless mode is enabled. The input/decoded pixel paths remain the same, but modular encodes are not guaranteed to be byte-identical to the previous libjxl version.

## Build the updated codecs

From the repository root, rebuild the codec artifacts and then the web app:

```sh
npm --prefix codecs/jxl install
npm --prefix codecs/jxl run build
npm --prefix codecs/avif install
npm --prefix codecs/avif run build
npm run build
```

The codec package scripts call `codecs/build-cpp.sh`, which builds the pinned `emscripten/emsdk:3.1.1` Docker image and runs each codec's Makefile. The image also installs CMake 3.22.6, required by libavif v1.4.2. The AVIF build pins libaom v3.14.1 and libwebp v1.6.0 for SharpYUV. Docker must be running and accessible to the build session; source downloads also require network access. The codec builds regenerate `src/features/encoders/codec-versions.ts`; the root `npm run build` bundles the generated artifacts but does not rebuild native codecs.

To run the Docker build directly, start in the JXL package directory from the repository root:

```sh
cd codecs/jxl
docker build -t squash-cpp - < ../cpp.Dockerfile
docker run --rm -v "$PWD:/src" squash-cpp
```

After the image is built, run this AVIF command from a fresh shell at the repository root:

```sh
cd codecs/avif
docker run --rm -v "$PWD:/src" squash-cpp
```

Each container runs that directory's default Makefile target. The JXL target creates separate `st`, `mt`, and `mt-simd` CMake builds, with WASM threads disabled only for `st`. If changing AVIF compiler or CMake flags, run `make clean` from `codecs/avif` before rebuilding so cached CMake settings do not mask the new flags. After a direct Docker build, run `npm run generate:codec-versions` from the repository root to refresh labels; `npm run build` also does this before bundling.
