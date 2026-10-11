# Developer documentation

Squoosh is a browser-based image compression application. Its feature implementations are split between the user interface, TypeScript adapters, Web Workers, and codec artifacts. This documentation is for contributors and coding agents; it describes the repository, not how to use the app.

## Start developing

Use the Node.js version in [`.nvmrc`](../.nvmrc), then run these commands from the repository root:

```sh
npm install
npm run build
npm run dev
```

`npm run dev` starts the Rollup watcher and local server. The default port is `5000`; set `DEV_PORT` to use another port. The production build command is `npm run build`. CI runs `npm ci` followed by `npm run build`; `package.json` does not define separate lint, typecheck, or test scripts.

## Guides

- [Architecture and data flow](architecture.md): app startup, image processing, workers, service worker, and build pipeline.
- [Feature development](feature-development.md): where to make changes to encoders, decoders, processors, and preprocessors.
- [Native codecs](native-codecs.md): how codec source, generated JS/WASM, worker adapters, and UI settings fit together.

For contribution and review expectations, see [`CONTRIBUTING.md`](../CONTRIBUTING.md). The existing [feature folder and encoder contract](../src/features/README.md) describes feature directories and encoder exports.

## Source map

| Area | Start here |
| --- | --- |
| Static HTML, manifest, and headers | [`src/static-build/`](../src/static-build/) |
| Initial app and editor shell | [`src/client/initial-app/`](../src/client/initial-app/) |
| Compression editor and image pipeline | [`src/client/lazy-app/Compress/`](../src/client/lazy-app/Compress/) |
| Encoders, decoders, processors, preprocessors | [`src/features/`](../src/features/) |
| Codec sources, build definitions, JS/WASM artifacts | [`codecs/`](../codecs/) |
| Generated worker entry and worker bridge | [`src/features-worker/`](../src/features-worker/) and [`src/client/lazy-app/worker-bridge/`](../src/client/lazy-app/worker-bridge/) |
| Service worker and offline asset list | [`src/sw/`](../src/sw/) |
| Rollup configuration and build plugins | [`rollup.config.js`](../rollup.config.js) and [`lib/`](../lib/) |

Some files in the feature worker, worker bridge, and feature metadata directories are generated during the build. Change the source features or generator instead of editing generated files; see [Architecture](architecture.md#workers-and-feature-discovery).
