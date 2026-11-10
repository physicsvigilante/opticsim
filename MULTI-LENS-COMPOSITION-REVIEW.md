# Review of bounded multi-lens composition proposal

**Decision:** **TECHNICALLY ACCEPTABLE WITH REQUIRED CONDITIONS** for a narrow candidate implementation; no implementation or test execution was performed as part of this review. This is a critical review by the same ChatGPT collaboration that prepared the proposal, **not an independent human or separate-agent review**. Do not treat it as later implementation qualification.

**Scope reviewed:** \`MULTI-LENS-COMPOSITION-PROPOSAL.md\` on \`design/bounded-multilens-trains\` against \`src/contract.js\`, \`src/adapter.js\`, \`src/analysis.js\`, \`src/app.js\`, \`src/session.js\`, \`test/optics.test.mjs\`, \`test/returns.test.mjs\`, \`test/authoring-checker.test.mjs\`, the image-to-scene skill, and \`AGENTS.md\`.

## Accepted architectural decisions

1. **Reuse existing component types and adapter.** The \`compilers\` table in \`src/adapter.js\` already compiles an arbitrary component array without a separate three-lens or four-lens native model; the bounded scope restriction is in \`validateBenchScope\` in \`src/contract.js\`. No new tracer or apparatus-specific solver is warranted.
2. **Keep positional ordering separate from authoring order.** \`benchComponents\` sorts lenses by x for analysis while \`compile\` maps stable IDs to the authored native object indices. Tests must confirm both invariants.
3. **Retain one source, coaxial lens geometry, existing numeric limits, and no new UI authoring widgets.** This is a defensible first expansion of the same supported family, not a claim of arbitrary optical composition.
4. **Preserve conditional analytical outputs.** \`src/session.js\` already allows a valid native trace when analytical prediction is unavailable/failed; ray throughput and optical image detection must not be inferred from transfer-matrix predictions.
5. **Historical v1/v2/v3 validation must not expand retroactively.** In \`migrateDocument\`, each earlier version is validated before migration. The new cardinality must be explicitly confined to v4, e.g. by passing version to the lens-scope checker.

## Required conditions for acceptance of an implementation

### R1 — Update the live agent instructions as well as user documentation

**Severity: required.** \`AGENTS.md\` explicitly states that only one or two coaxial lenses are supported. The proposal currently names README, the repository authoring skill, and VALIDATION.md for updating after implementation, but omits \`AGENTS.md\`. If uncorrected, Codex could reject legitimate three-/four-lens scenes even after the runtime accepts them.

**Acceptance:** after the validator is extended and tests pass, update \`AGENTS.md\`, \`README.md\`, and \`skills/sim-ro-image-to-scene/SKILL.md\` consistently to explain the **bounded one-source/1–4 coaxial-lens v4** family. Retain other arrangement restrictions and the rule that the live validator controls authorability. Record *actual* tests in \`VALIDATION.md\`. Do not update those instructions ahead of working support.

### R2 — Replace the misleading cardinality regression

**Severity: required.** \`test/optics.test.mjs\` currently rejects a document after appending two copies of a lens at the **same x coordinate**. Once the cardinality changes, this fixture will still be rejected for coincident planes; it does **not** prove that 3 or 4 valid lenses are supported or that 5 lenses are rejected.

**Acceptance:** construct independently valid, separated, distinctly identified 3-/4-lens documents; assert that they validate and execute. Add a **five-lens** fixture with all x positions distinct and legal, asserting \`UNSUPPORTED_SCOPE\` (and useful error path) for the *count* rather than another flaw. Separately test coincident planes, illegal source placement, and duplicate IDs. Add explicit legacy v1/v2/v3 three-lens rejection before migration.

### R3 — Qualify cancellation in the existing ordinary lens analysis

**Severity: required.** \`predictLenses\` currently returns \`m=A+z C\` with no finite/conditioning guard. The proposal correctly recommends a guarded \`1/D\` comparison. In binary64 arithmetic a valid three-lens parameter set shows meaningful cancellation:

- Source x = -9000 mm.
- Lens x = 0, 150, 300 mm; all focal lengths = +1 mm.
- Calculated matrix roughly \`A=22051, B=198436800, C=-21903, D=-197104949\`.
- \`1/D ≈ -5.073439328e-9\`; \`A + (-B/D)C ≈ -5.071342457e-9\`, differing by about **4.1e-4 relative**.

This is an **analytical arithmetic reproduction**, not a native simulator test. It illustrates why the existing unguarded expression should not be treated as authoritative for longer trains.

**Acceptance:** provide a documented, bounded tolerance policy; retain current 1-/2-lens predictions to their existing tolerances; guard non-finite matrix/image/magnification values; classify near-infinity before computing finite image values. For a demonstrably ill-conditioned test case, an **unavailable** analysis must not prevent accepting/saving/exporting a physically valid document or attempting a native run. Do not assert that an extreme native run necessarily completes until its actual diagnostics confirm that.

### R4 — Verify native traversal, not merely successful native load

**Severity: required.** Real physical composability entails native interaction with the same authored lens objects, not merely successfully compiling four \`IdealLens\` JSON objects.

**Acceptance:** for at least two representative multi-lens configurations, use test-only native \`SingleRay\`, per-lens incident observers, and detectors or equivalent measured crossings to verify the intended sequence of **actual** hits, signed slopes and detector geometry. Use sufficiently modest paraxial rays and large finite apertures. Include deliberate finite-aperture misses that are *not* falsely treated as full-chain throughput. Confirm depth/processed-ray limits and incomplete states. Tests should find native objects via stable IDs; avoid incidental assumptions that source is native array index 0 or the lenses are already in array order.

## Additional notes / consciously deferred issues

- **v4 reader compatibility:** using the same v4 number for an expanded set of valid configurations is a reasonable, additive early-project policy, but older deployed readers will still reject new four-lens scenes. Mention this explicitly in documentation rather than implying all software accepting v4 can read every new v4 scene. A schema bump is not mandatory for this addition.
- **One final image is not a full teaching derivation:** the current transfer-matrix prediction reports the final output image only, not every intermediate conjugate image. The proposed intermediate-collimation tests can be test-only for now. A per-lens observation/analysis report can be a later composability milestone.
- **Incomplete real textbook data:** the current image-to-scene skill treats absent aperture/focal/source geometry as unresolved; this is intentionally stricter than many idealized JEE problems. Avoid fabricating apertures. Broader symbolic/illustrative scene authoring needs separate design later.
- **Browser/UI:** changing the component count should not require a component add/delete UI; however, human inspection of two authored JSON scenes and explicit save/edit/reload is a release gate when browser execution is available. Do not infer visual validation from headless tests.

## Decision and next gate

**Technical design review: PASS WITH CONDITIONS R1–R4.** There is no reason to rewrite PhyDemo or introduce a special-purpose multi-lens solver. The required conditions can be implemented and tested within the proposed bounded milestone. If they are met, the design is suitable to proceed to **candidate implementation**, followed by a separate code/test review and user approval before any merge to \`main\`.

**No source implementation was part of this review.** No new native, browser, or npm tests were run. The review is not evidence that three-/four-lens scenes work yet.
