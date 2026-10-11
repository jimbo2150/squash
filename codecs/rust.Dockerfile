ARG RUST_IMG=rust:1.47

FROM emscripten/emsdk:2.0.8 AS wasm-tools
WORKDIR /opt/wasm-tools
RUN wget -qO- https://github.com/rustwasm/wasm-pack/releases/download/v0.12.1/wasm-pack-v0.12.1-x86_64-unknown-linux-musl.tar.gz | tar -xzf - --strip 1

FROM $RUST_IMG AS rust
ARG RUST_IMG
RUN rustup target add wasm32-unknown-unknown
RUN case $RUST_IMG in rust:1.98.1) \
      rustup toolchain install nightly-2025-11-15 --profile minimal --target wasm32-unknown-unknown --component rust-src \
      && cd "$(rustup run nightly-2025-11-15 rustc --print sysroot)/lib/rustlib/src/rust/library" \
      && rustup run nightly-2025-11-15 cargo generate-lockfile;; \
    esac
COPY --from=wasm-tools /emsdk/upstream/bin/wasm-opt /emsdk/upstream/bin/clang /usr/local/bin/
COPY --from=wasm-tools /emsdk/upstream/lib/ /usr/local/lib/
COPY --from=wasm-tools /emsdk/upstream/emscripten/system/include/libc/ /wasm32/include/
COPY --from=wasm-tools /emsdk/upstream/emscripten/system/lib/libc/musl/arch/emscripten/bits/ /wasm32/include/bits/
COPY --from=wasm-tools /opt/wasm-tools/wasm-pack /usr/local/cargo/bin/

ENV CPATH="/wasm32/include"
WORKDIR /src
CMD ["sh", "-c", "rm -rf pkg && wasm-pack build --target web -- --verbose --locked && rm pkg/.gitignore"]
