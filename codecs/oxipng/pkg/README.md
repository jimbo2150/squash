# OxiPNG

- Source: <https://github.com/shssoichiro/oxipng>
- Version: v10.2.1
- License: MIT

## Build

From the repository root, run:

```sh
npm --prefix codecs/oxipng run build
```

The build generates both the single-threaded and parallel WebAssembly packages. The default build uses Rust 1.98.1 stable. The parallel build uses pinned nightly-2025-11-15 because `wasm-bindgen-rayon` requires nightly `build-std` to rebuild the WebAssembly standard library with atomics enabled. It also links shared, imported WebAssembly memory with a 1 GiB maximum and exports the TLS symbols required to start Rayon workers; atomics target features alone do not make memory shareable.

The release profile disables `wasm-opt`: the optimizer bundled with Emscripten 2.0.8 does not support the multiple tables emitted by the current bindings. Only re-enable it after upgrading and validating the optimizer against both generated packages.

After changing OxiPNG or its bindings, run the repository-root `npm run build` to regenerate codec version metadata and verify that the application bundles the artifacts.
