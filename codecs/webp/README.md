# WebP

- Source: https://github.com/webmproject/libwebp
- Version: v1.6.0
- License: BSD

## WebAssembly builds

The encoder has baseline and SIMD builds. SIMD uses vector instructions but does not enable parallel encoding. Thread support is disabled in the codec build, and the application sets `thread_level` to `0`, so WebP encoding is single-threaded.
