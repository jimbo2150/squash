#!/bin/bash

set -e

rm -rf pkg{,-parallel}
export CFLAGS="${CFLAGS} -DUNALIGNED_ACCESS_IS_FAST=1"
wasm-pack build -t web
parallel_rustflags=(
  -C
  target-feature=+atomics,+bulk-memory
  -C
  link-arg=--shared-memory
  -C
  link-arg=--max-memory=1073741824
  -C
  link-arg=--import-memory
  -C
  link-arg=--export=__wasm_init_tls
  -C
  link-arg=--export=__tls_size
  -C
  link-arg=--export=__tls_align
  -C
  link-arg=--export=__tls_base
)
RUSTUP_TOOLCHAIN=nightly-2025-11-15 RUSTFLAGS="${parallel_rustflags[*]}" \
  wasm-pack build -t web -d pkg-parallel . -- -Z build-std=panic_abort,std --features=parallel
cp pkg-parallel/snippets/wasm-bindgen-rayon-*/src/workerHelpers.js pkg-parallel/workerHelpers.js
sed -i "s|import('../../..')|import(new URL('/oxipng-parallel/squash_oxipng.js', location.origin).href)|" pkg-parallel/workerHelpers.js
sed -i "s|new Worker(new URL('./workerHelpers.js', import.meta.url),|new Worker(new URL('/oxipng-parallel/workerHelpers.js', location.origin),|" pkg-parallel/workerHelpers.js
sed -i "s|from './snippets/wasm-bindgen-rayon-[^/]*/src/workerHelpers.js'|from './workerHelpers.js'|" pkg-parallel/squash_oxipng.js
rm pkg{,-parallel}/.gitignore
