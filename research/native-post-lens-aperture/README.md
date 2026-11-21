# Finite apertures downstream of an ideal lens

The v19 parallel-beam bench accepts an aperture before a lens. Moving the stop beyond the lens changes which rays meet the opaque arms. A check of the initial parallel samples alone misses that change. This experiment examines whether the existing PhyDemo Beam, IdealLens, Aperture and Detector can support this teaching variation. All dimensions and source settings are synthetic. The public v19 validator still refuses each complete downstream arrangement.

## Reproduce the experiment

From a checkout with the pinned dependencies installed, run:

```sh
node scripts/build.mjs --test
node --test test/native-post-lens-aperture-research.test.mjs
```

The protocol SHA-256 recorded before the first native run is `84cd0d49b44cfc8ed72b454135813c23e61fcf4df6bb50049895311837a67979`. The test records each raw native input, processing limit, source emission ordinates, selected lens callbacks and their outgoing geometry, actual arm absorptions and detector positions. A manifest binds the files to their hashes in a fresh directory under `test-artifacts/llm-authoring/native-post-lens-aperture/`. Each run uses the merged v27 base and the PhyDemo pin recorded in the protocol.

## First local native run

The lens was centered at x = 0 mm, with a 40-mm-wide horizontal Beam and a 12-mm opening centered on the axis. With a +100 mm focal length and the stop at x = 50 mm, four of eight samples struck opaque arms and four reached the detector. With focal length −100 mm, six struck the arms and two reached the detector. Moving the stop to the positive lens's focal plane let all eight through. These are measured sample counts.

The finite outer ends matter too. Shortening the stop to 12 mm with a 6 mm opening let six samples reach the detector. Only two of those passed through the central opening according to the independent thin-lens cross-section check. Four passed beyond the outer ends. A detector crossing count alone cannot establish how many samples traversed the opening.

Seven positive cases agreed with the ideal thin-lens cross-sections and measured callbacks. Five controls withheld a positive result. Native completion occurred even at an inner endpoint, an outer endpoint and when only four of eight emissions reached the lens. The remaining controls produced native depth truncation and a processing stop.

This is a raw native feasibility result. Creating a public authoring contract requires a bounded admission policy and evidence for all four stop endpoints, lens interception, detector misses, stale runs and browser revisions. Existing saves and source interpretations retain their current meanings.
