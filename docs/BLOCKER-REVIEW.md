# Blocker and shared authoring review — 13 November 2026

Reviewed PR #42 baseline: `a9c766bf8925b67f7159f52c204138c6f8392802`.
The downloaded tracked-source tree matched
`243af4ec9d1d7e5b8ea337ec7bc6ad4c18a166e7`; an unchanged rebuild with
Node 24.19.0 and pinned PhyDemo passed all 380 baseline tests.

## Reproduced defects and repairs

1. **Authoring cardinality lagged behind admitted composition.** A valid
   arrangement with four sources, four lenses, four mirrors, two blockers and
   two detectors contains 16 components. The canonical geometry validator
   admitted it, but the authoring preflight still imposed its old 14-component
   ceiling. The maximum is now derived from the existing general-family
   cardinalities and exposed as `capabilities().maxComponents`. The stricter
   per-family counts and geometry rules still reject unsupported compositions.
2. **Async results read caller-owned mutable input.** During the awaited scene
   digest, a caller could reuse/edit the document, request array or native
   measurements, mixing one revision's hash with another revision's readings.
   `evaluateObservables` now snapshots all three before its first await.
   The result remains bound to the invocation's scene hash, and later edits
   require their own execution; this is consistency, not authentication.
3. **Published capabilities leaked a mutable internal result registry.** A
   JavaScript consumer modifying the returned object could change the physical
   types allowed by future requests. The public descriptor is now a defensive
   copy, including nested type arrays. This is an API integrity defect, not a
   claim that a language model has executed JavaScript or attacked the engine.
4. **An old async error could overwrite new UI results.** The failure path
   used an OR between sequence/revision checks, unlike the success path. A
   delayed failure at the same scene revision could replace a newer successful
   readout while its dataset still contained current values. Both guards must
   now match. Current errors still surface and invalid/incomplete states still
   suppress readings.

Four focused regressions failed on the baseline and passed after repair.
No source question, sealed attempt or reference record was changed.

## Continued integration work

`native-observations.js` defines one bounded, defensive measurement projection
shared by headless result summaries, browser qualification and the advertised
capability list. This removes the duplicated channel lists that previously
caused blocker counts to disappear only in the browser. It neither computes
measurements nor bypasses native completion and hash checks.

Ten additional tests cover the four repairs, CLI/viewer channel parity,
current-versus-stale errors, refusal to remove a blocker for an ideal-image
answer, exactly-once native callback delegation, incomplete near-coincident
encounters, and 36 combinations of rotation, length units and ray density.
Blocked cases conserve sampled emissions as absorptions; clear cases match an
independent run of the same scene without the stop. These are finite native
sampled controls, not continuous illumination, original JEE answers or an
independent LLM benchmark.

## Verification and limits

The repaired local suite passed **390/390 tests**, with no skips, alongside
all eight blocker CLI controls and the three-point immutable sweep. The
23-scene static package still validates its allowlist and license notices.
Local Chromium is blocked from localhost by the execution environment's
policy before the application loads, so browser verification must come from
GitHub CI, not this local attempt. Consult the PR for the exact tested tree,
CI outcome and artifacts.

The PhyDemo commit and source, scene schema versions, allowed optical families,
numerical limits, source modes and native ray physics are unchanged. Circular
blockers and apertures remain separate future capabilities; broadening the
scope is not part of this repair. Main and merge approval are separate from
updating the draft PR.
