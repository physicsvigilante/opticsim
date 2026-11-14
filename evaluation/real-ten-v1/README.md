# Milestone 27 — ten original optics problems

## Scope

The approved trial uses ten original PNG problems from the user-supplied `08_Ray_Optics_Explanations.zip`, not ten newly invented fixtures. Selection was committed at `57eeaecd0605556f7f301a4acf11bc7ae0df31e6`, and all first answers/authoring decisions at `662e51fef3bee29837f0b4df9f000575da543ee2`, before Solutions were extracted. The same assistant read, attempted and reviewed them. No independent benchmark, held-out guarantee or independently authenticated model identity is claimed. JEE provenance is inherited from the archive, not independently authenticated here.

The deterministic rule takes the first atlas-not-reviewed problem in each of eight chapters plus a second in plane reflection and lenses. It is not a support-filtered sample. All ten remain even if a complete native scene cannot be authored faithfully. Previous project exposure is possible; R01 explicitly flags a familiar construction. The archive's original questions and solutions are unchanged.

## Evidence layers

1. **Frozen first attempt:** physical reading, manual analytical answer and assumptions, an original-question request (including explicit unsupported kinds), and the native-authoring decision. This is not engine-generated output.
2. **Engine replay:** the existing `runProblemEvidence` handles those exact authored requests, without adding missing physics or changing the requested question. Real completion/unavailability and every native call are recorded. An unregistered kind remaining unavailable is not a claim that the original question is mathematically impossible.
3. **Derived verification:** R03 separately forwards the manually derived focal length to the existing curved-mirror image query. It is not an inverse engine solution, a native run or a successful original-question result.
4. **Post-solution review:** `review.json` records visual comparison after the first-attempt freeze, with per-solution hashes. CI does not reopen the solution images. The comparison is self-reviewed and the source key is not treated as infallible.

The result can therefore be useful even when no original task runs natively: it measures the distance between a valid manual optics derivation and the current authorable/observable contracts. No finite source brightness, mirror length or native apparatus was invented to manufacture a success.

## Review findings (not a pooled accuracy percentage)

Seven first answers agree with the supplied solutions after unit/sign conventions. R05 has a source conflict: the question states a **2 cm** ceiling height but its solution uses **2 m**. The first attempt's 53/3 cm shadow radius follows the actual question; 845/3 cm follows the changed height in the key. The radius escape bound agrees, but equality is a grazing ray and not a finite ceiling intersection.

R06 agrees under the key's implicit reflecting/equilateral/minimum-reset interpretation. Its water result 128.4 degrees comes from rounding the incidence before doubling; the unrounded expression gives 128.45773265562514 degrees. Keeping the external incidence fixed on immersion is a different question and was retained as an alternative in the first answer.

R10's focal separation agrees. The first attempt uses arithmetic-mean focal length while the key uses geometric mean; both dispersive-power approximations round to 0.0325. The reference-wavelength convention is not an independently supplied physical fact. R03's key also has an initial -25 m typo despite using -2.5 m correctly in the subsequent calculation.

These observations must not be silently repaired into a ten-out-of-ten first-attempt score. They are in the review only; frozen first answers stay unchanged.

## Reproduce

```sh
npm run setup
npm test
node evaluation/real-ten-v1/replay.mjs
```

The source archive must match its committed SHA-256. Outputs use a fresh protected directory under `test-artifacts/llm-authoring/real-ten-v1/`: exact frozen data, original problem PNGs, request plans/results, the separate derived check, source-code fingerprints, JSON and Markdown summaries. The runner checks the frozen first-attempt Git blob and hashes every source problem. It never changes the production optical engine, schemas, core pin or native sampling to fit an answer.

The temporary branch-only image-transfer workflow was removed from the proposed final tree. Its earlier commits/run IDs preserve timing and provenance; `extract-images.mjs` remains an explicit local utility that requires a committed first-attempt ancestor before a Solutions phase. It is not part of ordinary CI or publication.

## Recommended shared improvement

Start with a separately reviewed **reduced-facts inverse-query layer** for the lens/mirror magnification and reflection-point families. It should produce typed, assumption-bearing analytic results without requiring fictional brightness or aperture values. Then evaluate mixed refracting/reflecting boundary composition separately. Continuous 3D visibility and chromatic material queries must not be approximated by sampled 2D counts. This PR adds evidence and tests only; it does not implement or authorize those physics extensions.
