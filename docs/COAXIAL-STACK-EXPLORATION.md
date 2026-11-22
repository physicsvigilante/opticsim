# Composable exploration for `coaxial-paraxial-stack`

`src/coaxial-stack-exploration.js` adds reusable, SHA-guarded physical exploration primitives on top of [coaxial-paraxial-stack.js](../src/coaxial-paraxial-stack.js) (`opticsim-coaxial-paraxial-stack-facts-v1`). Teachers and LLMs can preserve an untouched baseline stack while proposing targeted parameter revisions, atomic structural element edits, bounded 1–25 value parameter sweeps, and guarded baseline-vs-variant comparisons without re-authoring unchanged components.

## Core contracts

1. **Canonical hashing & lineage packages (`opticsim-coaxial-stack-package-v1`)**
   - `coaxialStackHash(facts)` validates `facts` through the canonical `coaxial-paraxial-stack` parser before computing its SHA-256 digest.
   - `createCoaxialStackPackage(facts, metadata?)` seals `baselineFacts` + `baselineSha256` separately from mutable hypothetical states (`currentFacts` + `currentSha256`), tracks `retiredIds` and bounded replayable `edits` (at most 64, including canonical `operations` on structural edits), and seals the full record with `integritySha256`.
   - `verifyCoaxialStackPackage(pkg)` revalidates both baseline and current stacks, deterministically replays every recorded parameter and structural edit from `baselineFacts` through the canonical validator, recomputes and verifies every intermediate SHA-256 and transition summary, verifies that replay reproduces `currentFacts` and `retiredIds` identically, and checks `integritySha256`. Package hashes detect drift or tampering, not source truth (`provenanceStatus: "author-declared-not-verified"`).

2. **SHA-guarded parameter revisions (`opticsim-coaxial-stack-revision-v1`)**
   - `reviseCoaxialStack(input, patch)` updates 1–16 explicit targets (`stack.incidentIndex`, existing `object.x`/`y`, or element-type-valid fields `x`, `focalLength`, `signedRadius`, `downstreamIndex`) on either raw facts or a verified package.
   - Enforces `expectedSha256` (plus `expectedIntegritySha256` for packages), rejects duplicate targets, no-op revisions, silent axial reordering, or edits to `id`, `type`, `lengthUnit`, `signConvention`, or `model`.
   - Surfaces `ambientIndexShifts` whenever editing `incidentIndex` or `downstreamIndex` changes the local ambient refractive index at downstream elements (noting that `thin-lens.focalLength` remains interpreted in its local ambient medium).

3. **SHA-guarded structural revisions (`opticsim-coaxial-stack-structure-v1`)**
   - `reviseCoaxialStackStructure(input, patch)` applies 1–8 atomic operations (`add-element`, `remove-element`, `add-object`, `remove-object`) with explicit insertion anchors (`"start"`, `"end"`, `{beforeId}`, `{afterId}`).
   - Enforces retired-ID guards across single batches and full package lineage: removed IDs cannot be reused, preventing disguised component replacement.
   - Revalidates the entire resulting stack through `validateCoaxialStackFacts` (1–8 ordered elements, minimum axial clearance, at most one final `terminal-mirror`, object strictly preceding the first element).

4. **Bounded parameter sweeps (`opticsim-coaxial-stack-sweep-v1`)**
   - `runCoaxialStackSweep(input, spec)` evaluates 1–25 distinct explicit parameter values (finite numbers, plus `"infinity"` for `signedRadius`) against any of the three stack queries (`coaxial-stack-conjugate`, `coaxial-stack-collimated-focus`, `coaxial-stack-transfer`).
   - Every sample starts from a fresh copy of the **unchanged baseline** (verified by canonical snapshot invariance) and is revalidated independently. Inadmissible values (`invalid-input`), boundary singularities (`at-infinity`, `afocal`), and `numerically-indeterminate` samples are retained explicitly with reasons—never dropped or interpolated.
   - `plotCoaxialStackSweep(report)` projects finite numeric values for a requested plot field and returns `y: null` with an explicit `reason` for non-finite, singular, indeterminate, or invalid samples.

5. **Guarded baseline-vs-variant comparison (`opticsim-coaxial-stack-comparison-v1`)**
   - `compareCoaxialStackResults(baseline, variant, query)` reports exact parameter/structural diffs, qualitative `statusTransitions` (`imageKind`, `imageOrientation`, `state`, `isAfocal`, `propagationMode`, `selfConjugateCount`), and exact binary64 numeric deltas (`variant - baseline`) only when `model`, `signConvention`, `lengthUnit`, and conditional finite statuses are compatible.
   - Exit-plane-relative quantities (`imageDistance`, `backFocalDistance`, `rearPrincipalOffset`) are marked `not-comparable` whenever the exit reference plane changed (different `exitElementId`, element `type`, axial `x`, or `exitDirection`), directing users to global lab-frame coordinates (`imageX`, `backFocusX`, `rearPrincipalX`) instead.
   - Return `selfConjugateObjects` lists are reported side-by-side without fabricating arbitrary pairings across changing root counts.

## Offline CLI

```powershell
node scripts/explore-coaxial-stack.mjs capabilities
node scripts/explore-coaxial-stack.mjs hash baseline.json
node scripts/explore-coaxial-stack.mjs package baseline.json
node scripts/explore-coaxial-stack.mjs revise package.json revision.json
node scripts/explore-coaxial-stack.mjs structure package.json structure.json
node scripts/explore-coaxial-stack.mjs sweep package.json sweep.json
node scripts/explore-coaxial-stack.mjs compare baseline.json variant.json coaxial-stack-conjugate
```

See [examples/coaxial-stack-exploration.json](../examples/coaxial-stack-exploration.json) for a worked multi-step exploration payload and [test/coaxial-stack-exploration.test.mjs](../test/coaxial-stack-exploration.test.mjs) for full contract, lineage, sweep, comparison, and CLI coverage.

## Scope limits

All outputs remain conditional first-order coaxial paraxial analysis (`nativeObservation: false`, `nativeImageDetected: false`, `questionSupport: "not-assessed-by-engine"`). No native PhyDemo scene, ray trace, finite aperture clipping, Fresnel reflectance, aberration, or detected image is created or certified.
