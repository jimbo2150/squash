# Encoder threading mode console log

## Goal

Log whether the single- or multi-threaded encoder variant is selected, with the codec name, in the browser developer console.

## Scope and decisions

- Add one `console.log` at runtime selection in the AVIF, JXL, OxiPNG, and WP2 worker adapters.
- Log the mode actually chosen after checking thread support and before initializing the selected codec module. Include the codec name; classify SIMD multithreaded builds as multi-threaded.
- Keep the log in each adapter rather than the shared thread-support helper, which does not identify the codec and is also used by the service worker.
- The adapters cache initialization, so the message appears once per adapter/worker initialization, not once per encoded image.
- Do not change WebP: it has no multithreaded alternative.

## Implementation steps

1. Add matching single-threaded or multi-threaded messages to the selection branches in `src/features/encoders/avif/worker/avifEncode.ts`, `src/features/encoders/jxl/worker/jxlEncode.ts`, `src/features/encoders/oxiPNG/worker/oxipngEncode.ts`, and `src/features/encoders/wp2/worker/wp2Encode.ts`.
2. Keep capability checks, selected modules, and initialization behavior unchanged.

## Validation

- Run `npm run build` from the repository root; this is the project's documented CI/build validation. There are no separate lint, typecheck, or test scripts in `package.json`.
- In the browser, encode with each affected codec and confirm its worker console reports the selected mode. Where possible, verify both thread-support outcomes; confirm JXL/WP2 report multi-threaded for either SIMD variant.
