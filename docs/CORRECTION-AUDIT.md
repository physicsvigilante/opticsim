# Correction audit — motion and qualified-data integrity

Reviewed starting point: PR #28 at `849240991ec3e1cdaf7cea1c223b1eb08659fc6f`,
stacked on curved-mirror PR #27. This is a focused correction pass over the
recent interactive workflow and shared qualification boundary, not a claim
that every possible optics configuration or project defect has been audited.

## Confirmed problems and corrections

### Asynchronous data snapshots

`reviseMotionRayExperiment` used a caller-owned change object after awaiting
integrity checks. A reproducible call requesting brightness 0.2 could instead
apply 0.9 if that object was mutated while the checks were pending. The function
now snapshots the change before its first asynchronous operation.

The shared `verifyQualifiedBundle` checked hashes and then returned a fresh
copy of the caller's potentially changed object. Mutating brightness during
the final digest could therefore return changed data alongside the original
integrity values. Verification now snapshots its entire input first and checks
and returns only that private snapshot. This does not make a hash a proof of
physical truth or author identity; it closes an inconsistent-data race.

### UI transactions and stale results

The motion page formerly retained its old player while a new source or mirror
edit was being validated. Playback and export could still act on that old
experiment. Loading a replacement during a pending edit could also let the old
UI promise show an unrelated error after the replacement finished.

A bounded transaction guard now detaches the previous player, aborts pending
rendering, disables playback and exports, clears current evidence, and accepts
only the latest operation. UI promises carry their own revision guard. Invalid
physical edits restore the last accepted experiment; rejected imports leave no
loaded experiment or exportable result. Camera/time changes cancel queued
repaints, and displayed/exported camera metadata comes from the completed native
render rather than mutable current UI controls.

`MotionPlayer.stop()` now invalidates before notifying observers. A bad frame
index is caught inside `seek()` and clears the previous result instead of
leaving a completed result visible behind a rejected Promise.

### Physical-input confirmation

Entering an invalid direction used to mark the direction as explicitly
confirmed before validation. A later switch from full circle to a single ray
could consequently use the old stored direction. Confirmation now occurs only
after a successful validated edit in the same experiment revision.

### Failed imports and canvas clearing

An oversized file previously left the old experiment available behind an error
message. Oversized, malformed and integrity-rejected imports now follow the
same invalidation path. Native canvas contexts may carry upstream transforms;
clearing under those transforms can leave old pixels visible. All native layers
are now cleared under an identity transform, with context state restored.

### Display and advertised bounds

The layout's `display:flex` on labels overrode the HTML `hidden` attribute,
exposing the custom-density field even for a preset. The motion stylesheet now
honours `[hidden]` explicitly. The motion API and documentation also now state
maximum depth **8**, matching the existing canonical validator; the previous
claim of 16 was incorrect. No numerical limit was relaxed.

## Reproduction and verification

`test/motion-audit.test.mjs` covers caller mutation, verification during both
digest phases, stop/invalid-seek state, stale native callbacks, direction
confirmation, superseded UI promises and the depth capability. The WebCrypto
injection is scoped to tests and restored after each check.

`scripts/motion-audit-browser.mjs` runs the actual CI-built portable page in
Chrome. It deliberately delays a digest to test a pending edit, replacement
load and late rejection. It checks disabled exports, camera freshness,
invalid-direction behaviour, actual computed visibility, complete clearing of
canvas alpha pixels after rejected input, and recovery after reimport. These
checks supplement the existing full Node suite, native motion acceptance,
playback/ray-control browser tests and desktop/narrow viewport tests.

Run using the normal project setup:

```sh
npm run setup
npm test
node scripts/motion-acceptance.mjs
npm run build:motion
node scripts/pack-motion.mjs
node scripts/motion-browser.mjs
node scripts/motion-viewport-browser.mjs
node scripts/motion-audit-browser.mjs
```

Evidence destinations must be fresh as required by each runner. CI reports and
artifacts establish which tests actually completed; the presence of a test in
this document is not itself a claim that it ran successfully.

## Boundaries retained

No original question archive or sealed first attempt was changed. No source
brightness, mirror aperture, material parameter, native weak-ray threshold,
upstream core or canonical scene schema was silently modified. No optics
feature, public deployment, external inference call or merge is part of this
correction. The source-motion model remains quasi-static and bounded; image
positions/velocities remain conditional calculations, not detected native
images. Existing refraction limitations tracked in issue #23 are not fixed by
these data/UI corrections.
