# Stabilize rapid settings updates

## Goal

Prevent quality, effort, and other settings changes from producing errors or crashing the tab while preserving automatic live previews.

## Scope and decisions

- Keep live preview behavior, but debounce updates until the user pauses briefly; the current 100 ms delay in `Compress/index.tsx` is not enough for rapid control changes.
- Apply this to the shared processing path so encoder and processor settings are covered, not just specific sliders.
- Coalesce changes to the latest settings, cancel superseded work, and ensure obsolete jobs cannot publish results or overlap uncontrolled with the replacement job.
- Treat cancellation as expected; report genuine processing failures without allowing timer-triggered or fire-and-forget async rejections to become unhandled errors.
- Cancel pending scheduled work when the component unmounts. Preserve the existing controls and setting semantics.

## Implementation steps

1. Update the image-work scheduler in `src/client/lazy-app/Compress/index.tsx`: use a modestly longer quiet period (for example, 250 ms), retain only the latest scheduled state, and coordinate active-job cancellation/replacement so processing does not churn on each intermediate value.
2. Track completion of side processing/encoding jobs as part of the scheduled run, or use an equivalent single-flight mechanism. Gate state publication on the active job/signal so stale results cannot replace the latest preview.
3. Handle errors at the scheduler boundary: suppress expected aborts, show genuine failures once, and consume rejected promises from both timer-started and side-job work. Clear the debounce timer during unmount.
4. Keep encoder UI components and worker codecs unchanged unless implementation investigation proves a specific codec defect; the common scheduler is the primary fix boundary.

## Validation

- Run `npm run build` from the repository root; `package.json` has no separate lint, typecheck, or test scripts.
- In a browser, rapidly scrub quality/effort controls and processor settings, including on an expensive codec and a large image. Confirm no tab crash, no cancellation-error snackbar, no stale preview replacing the final value, and the final preview reflects the last setting after input settles.
- Repeat while an encode is in progress, then navigate away during the debounce interval to verify cleanup and absence of late state updates.
