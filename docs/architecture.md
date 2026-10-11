# Architecture and data flow

## Application startup

The static build in [`src/static-build/`](../src/static-build/) renders the initial page and emits the web app manifest and response headers. [`src/client/initial-app/index.tsx`](../src/client/initial-app/index.tsx) mounts the Preact application. The shell in [`src/client/initial-app/App/index.tsx`](../src/client/initial-app/App/index.tsx) handles the intro screen, file selection, editor route, and service-worker bridge, and loads the compression editor lazily.

The editor lives in [`src/client/lazy-app/Compress/`](../src/client/lazy-app/Compress/). Its main component owns source-image state, compare-side settings, and the work triggered by option changes. UI controls are split into `Options/`, `Output/`, and `Results/` beneath that directory.

## Image processing flow

The editor decodes the selected image, applies shared preprocessing, and then processes and encodes each comparison side using that side's settings:

1. Decoding uses browser support where available and custom worker decoders for supported formats the browser cannot decode. Dispatch is in `decodeImage()` in [`Compress/index.tsx`](../src/client/lazy-app/Compress/index.tsx); MIME sniffing and browser decode helpers are in [`src/client/lazy-app/util/`](../src/client/lazy-app/util/).
2. Preprocessing is shared by both sides. The current rotate path is in `preprocessImage()` in `Compress/index.tsx` and the implementation is under [`src/features/preprocessors/`](../src/features/preprocessors/).
3. Each side can run its own processors before encoding. The current resize and quantize calls are in `processImage()` in `Compress/index.tsx`; processor implementations and controls are under [`src/features/processors/`](../src/features/processors/).
4. The chosen encoder converts processed pixels to an output file. Encoder metadata, clients, and workers are under [`src/features/encoders/`](../src/features/encoders/).

The editor may cancel obsolete work and reuses matching results via [`result-cache.ts`](../src/client/lazy-app/Compress/result-cache.ts). For behavior changes, follow the call sites as well as the feature implementation: discovery of metadata does not automatically add new work to the processing pipeline.

## Workers and feature discovery

Worker implementations live in `worker/` directories under [`src/features/`](../src/features/). [`lib/feature-plugin.js`](../lib/feature-plugin.js), configured by [`rollup.config.js`](../rollup.config.js), discovers worker TypeScript files and generates:

- `src/features-worker/index.ts`, which imports default worker exports and exposes their functions through Comlink.
- `src/client/lazy-app/worker-bridge/meta.ts`, which defines the client method names and types.
- `src/client/lazy-app/feature-meta/index.ts`, which gathers encoder, processor, and preprocessor metadata into client registries and default state.

These files are generated and ignored by Git. Modify the source feature or [`lib/feature-plugin.js`](../lib/feature-plugin.js), not the generated outputs. [`src/client/lazy-app/worker-bridge/index.ts`](../src/client/lazy-app/worker-bridge/index.ts) creates the worker on demand, queues calls, forwards cancellation, and terminates an idle worker.

Worker methods use the default export of each worker file; the generated method name comes from its filename. Keep worker filenames unique so generated API names do not collide. Not every behavior is inferred from metadata: for example, decoder MIME dispatch and processor execution are explicitly wired in the editor.

## Offline support and caching

[`src/sw/index.ts`](../src/sw/index.ts) and [`src/sw/to-cache.ts`](../src/sw/to-cache.ts) implement service-worker behavior and asset selection. The cache list includes entry bundles and codec variants; some variants are selected based on browser support for WebAssembly SIMD and threads. When adding or changing a codec artifact, review the explicit imports and selection logic in `to-cache.ts` as well as the worker adapter. The service worker is responsible for offline assets, not server-side image processing.

Images are processed in the browser; the app does not upload them for compression. The initial client also contains Google Analytics setup in [`src/client/initial-app/index.tsx`](../src/client/initial-app/index.tsx), which is separate from image decoding and encoding.

## Build pipeline

[`rollup.config.js`](../rollup.config.js) composes TypeScript compilation, source-directory aliases, CSS and asset handling, the feature generator, service-worker generation, and the static/client bundles. [`lib/`](../lib/) contains the supporting Rollup plugins. `npm run build` runs Rollup and then [`lib/move-output.js`](../lib/move-output.js); `npm run dev` runs the watcher and serves the generated static build. CI currently validates `npm ci` and `npm run build` in [`.github/workflows/node.js.yml`](../.github/workflows/node.js.yml).
