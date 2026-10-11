#!/bin/bash

set -e

rm -rf pkg,{-parallel}
export CFLAGS="${CFLAGS} -DUNALIGNED_ACCESS_IS_FAST=1"
wasm-pack build -t web
RUSTUP_TOOLCHAIN=nightly-2025-11-15 RUSTFLAGS='-C target-feature=+atomics,+bulk-memory' wasm-pack build -t web -d pkg-parallel . -- -Z build-std=panic_abort,std --features=parallel
rm pkg{,-parallel}/.gitignore
