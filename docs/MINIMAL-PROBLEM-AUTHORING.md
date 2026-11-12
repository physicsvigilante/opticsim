# Milestone 7 — Minimal problem-to-scene authoring

This is a **bounded preparation layer** over the existing canonical
`prepareScene()` contract. It does **not** interpret images, solve a JEE
question, infer physical geometry, or implement new PhyDemo physics.

## Rationale

A textbook question may state a lens position and focal length without
specifying source brightness, a finite aperture or ray emission pattern.
Those values are needed by the native renderer, but they need not be
properties of the textbook's physical question.

The original strict authoring interface is unchanged. A new
`resolveProblemRequest(request,{illustration})` operates on a copy of the
request and returns a separate preparation and provenance report.

## Two modes

- **Strict (default):** All physical parameters must be present; no missing
  value is supplied. Result is `fully-specified`, `needs-information` or
  `unsupported`. No native build runs when blocked.
- **Explicit illustrative (`--illustrate`):** May supply only:
  - Missing source relative brightness: `0.08` (arbitrary illustrative
    native intensity; never calibrated or assumed from a question)
  - Missing lens aperture height: `100 mm`, converted into the request
    length unit (finite clip choice, may change observed rays)
  - Completely omitted/empty source emission object: `full-circle`
    (illustrative emitting pattern, **not** claimed to be question physics)

These are **not** generally physically neutral defaults. They can affect
which rays reach surfaces or detectors and may make the rendered scene
unrepresentative of the specified question. All values and their provenance
are returned as `choices[]` outside the canonical scene. The saved
`ray-optics-2d` JSON retains its unchanged strict schema and does not
pretend provenance is a canonical physics field. Keep the accompanying
report when reviewing an illustrative scene.

There is **no** default for source position, lens position/focal length,
mirror/detector length or geometry, source direction/angle in directional
mode, component type, or source count. Missing essentials remain blocked
even with `--illustrate`. Unknown apparatus such as prisms is explicitly
unsupported. No substitution is attempted.

## CLI

```powershell
node scripts/author-scene.mjs problem-capabilities
node scripts/author-scene.mjs problem <request.json>
node scripts/author-scene.mjs problem <request.json> --illustrate --out test-artifacts/llm-authoring/<case>
```

The input is the **existing** JSON request with `lengthUnit` and
`components` (no new apparatus language). The caller/LLM must interpret
the source question independently before filling the known physical fields.

The output separates:
- `problem.status`: `fully-specified`, `illustrative`,
  `needs-information` or `unsupported`;
- `problem.choices[]` / `problem.issues[]`: deterministic fillings or
  actionable errors;
- `interpretation` and `physicalFidelity`: always
  `not-assessed-by-engine`;
- `native.status`, warnings, observations, execution pass, analysis
  applicability, all from the existing native checker on accepted scenes.

Blocked cases produce **no canonical scene or native run**. With `--out`,
only the diagnostic report is written. Accepted cases produce the strict
scene and native report. Native success must never be presented as proof
that the LLM understood the original question.

## Limitations and next validation

The focused tests cover a complete request, an incomplete request, unit
conversion, omitted emission, missing essential focal length, incomplete
directional emission, and unsupported apparatus. Full suite and CI also
exercise the existing strict interface and pinned native simulator.

**This is not a blind LLM evaluation.** No new independent model, real
question-image interpretation, or five-case previously-unseen JEE
acceptance trial has been performed by this change. A later protocol
should collect first interpretations and opt-in choices before any review
of solutions, with manual assessment of physical fidelity.
