# Native completion reporting and near-critical intersection localization

This follow-up to PR #62 fixes diagnostic reporting and adds test-only geometric
investigation. It does not change the production ray tracer, pinned PhyDemo,
scene contracts, numerical limits, color-mode default, browser, or JSON workflow.
The underlying numerical issue remains tracked by #23.

## Completion is not requested-result availability

The old audit console computed `complete` as the negation of
`incompleteResultsWithheld`. B05 includes an unregistered requested quantity,
which is correctly `unavailable`, alongside supported quantities that are
`suppressed` on an incomplete run. Consequently the aggregate was false and
the console printed `complete: true` next to `status: incomplete`.

The saved per-probe record now retains the native replay's actual `complete`
boolean, and the console copies it directly. `incompleteResultsWithheld` is
separate: an incomplete run must have only null-valued `suppressed` or
`unavailable` requested results. No previously unavailable quantity is promoted
to a measurement. `scripts/numerical-audit-report-acceptance.mjs` captures actual
CLI stdout and checks it against all ten saved audit records, including both
exact-critical modes and the explicitly approximated completed linear case.
The acceptance runs sequentially after Node tests, avoiding a core rebuild
inside parallel test workers.

## Synthetic geometry investigation

`scripts/grazing-intersection-probe.mjs` declares a fully specified two-interface
reproducer with indices 1.6, 1.8 and 1.3, a source at (-100,-100) mm, and baseline
interfaces at y=0 and y=100 mm. These choices reproduce the previously exposed
B05 diagnostic; they are not a new blinded interpretation or a textbook answer.
Partial Fresnel reflections are explicitly omitted while native TIR remains
active. The source direction is derived for this experiment, not inferred by
the production authoring system.

The 24 declared configurations combine normal, two neighboring directions
(+/-0.001 degrees), and nominal critical incidence with six geometry transforms:
base, 0.1x scale, 10x scale, translation, 37-degree rotation and a quarter-turn.
Each runs in explicit native default and linear modes: 48 diagnostic executions.
Node regression tests additionally compare the 24 default-mode runs to ordinary
canonical execution, checking status, truncation and processed-segment parity.
The non-default variants remain headless diagnostics, not new canonical settings.

Read-only per-instance observers retain at most 32 actual native incident events,
including the exact binary64 ray endpoints before and after each call. The
original interaction is invoked exactly once and its return is preserved.
After tracing, the first outgoing I23 segment is queried against the native
PlaneGlass boundary without modifying or reinserting that ray.

## Independent geometric reference, not another solver

`scripts/exact-line-reference.mjs` represents every captured binary64 coordinate
as an exact BigInt rational. It uses the parametric intersection of two lines,
independent of PhyDemo's global-coordinate determinant calculation. Forwardness
and comparison with the actual native squared-distance cutoff use exact rational
arithmetic; decimal projections in the report are informational only.

This reference answers only: where do these two represented straight lines
intersect, and is that step beyond the simulator's existing cutoff? It contains
no Snell law, Fresnel branching, source emission, ray routing, or propagation
loop, and is never imported into production. Separate normal/nearby native
controls check reflection/refraction behavior; standalone reference tests cover
known rational geometry, cutoff equality, parallel/coincident lines, transformed
geometry, one-ulp boundary offsets, and malformed input.

The baseline critical regression requires an actual native self-rehit for which
the native candidate exceeds the segment cutoff but the exact represented-line
intersection does not. It pins an observed numerical defect, not correct optics.
Transformed critical cases retain their actual outcomes instead of requiring
all floating-point variants to fail identically. The report is written before
acceptance assertions so a failed investigation retains its evidence.

Even a confirmed intersection discrepancy is not a universal repair. A point
slightly off its intended boundary, a nearly tangential transmitted direction,
intersection cancellation and threshold selection must be distinguished. A
production correction or new upstream pin requires separate review, especially
for true close boundaries, scale/rotation, exact-critical ambiguity and other
native optical components. No snapping, index changes, angle nudging, brightness
boosting, automatic fallback or rewritten rays are introduced here.

## Reproduction and evidence

After the normal pinned setup:

```sh
npm test
node scripts/numerical-audit-report-acceptance.mjs
node scripts/grazing-intersection-probe.mjs
```

Each CLI requires a fresh output directory under `test-artifacts/llm-authoring/`;
pass an optional fresh directory for a repeat run. The existing numerical CI
workflow uploads exact stdout, saved audit records, synthetic input bytes and
the geometry report. The probe checks the vendor commit and tracked-file
cleanliness before building. These are same-assistant engineering checks, not
independent LLM accuracy or classroom evidence. A test being present does not
mean it passed; consult the workflow at the actual source head and its artifact.
