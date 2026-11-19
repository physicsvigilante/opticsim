# Two disjoint finite dielectric regions — prospective v14 native engine capability

**Status: R2 PHYSICAL EXTENSION IN DRAFT — requires independent physics review and exact-head CI; not on main until reviewed.** It expands the **range of physical apparatuses that can be simulated**, not the LLM service, textbook answer solver, teacher feedback system or notebook report format.

## Authoring model

An author may specify **exactly two individually named strictly convex four-vertex homogeneous dielectric regions** in a common, uniform exterior medium, **1–4 explicit single rays** and **0–2 passive line detectors**. The newly isolated contract is `schemaVersion:14`, `adapterVersion:14`, `model:'two-separated-dielectrics-tracing'`, selected for new minimal requests containing two polygon dielectrics; old v1–v13 scene files continue to validate only under their existing contracts and **are never automatically upgraded**.

Each region already has parameters `x1,y1 ... x4,y4,insideIndex,outsideIndex,partialReflection`, used by the existing one-glass native `Glass` compiler. All values, source identities, material indices, ray directions, measurement targets and finite geometry must be explicitly authored. No new component type, custom refraction method or optical route input is introduced.

The background **must be consistent**: both independently supplied `outsideIndex` values must be exactly equal. Native `Glass.refIndex=insideIndex/outsideIndex` is still compiled per region. The two regions must be **separate in physical space**: neither can overlap, touch, nest inside or have an ambiguous nearly shared boundary with the other. The geometry validator first calls the existing single-convex-quadrilateral rules on EACH independently (1 mm edge/altitude; 0.01 mm source/finite-face, initial forward vertex and external-detector clearances), then certifies a common separating supporting face of one of the two convex polygons with the existing **0.01 mm** strict exterior margin. That margin is an established *admission geometry guard*; it is not a PhyDemo numerical-tracing tolerance or universal physical precision claim. Separated-but-not-provable arrangements may be conservatively rejected rather than silently repaired.

**Not admitted:** a third glass, triangle+quadrilateral, other media, overlapping or nested material, circular glass, native `SphericalLens`, a mirror, a blocker, an aperture, an ideal lens or a parallel multi-ray beam. The owner had previously deferred beam-source work. Expanding the contract later needs separate physical verification, not removal of any existing limit.

## Physical execution and provenance

The existing `src/adapter.js` compiler creates **two distinct pinned PhyDemo `Glass` objects** using the authored vertices and relative indices. Each original `SingleRay` is emitted unchanged; pinned native geometry chooses whether it hits none, one, both or repeats on any surfaces, including total internal reflection. No Opticsim code prescribes a fixed `G1→G2` path.

Every native per-ID `onRayIncident` is observed by the pre-existing `observeInterfaceSet` method, delegating exactly once. Explicit requests can read per-body interaction counts, *first event*, physical face events, incident/transmitted/reflected angles and detector crossings. A combined count is not the same as ray-by-ray source attribution. Conditional image analysis for an unconstrained two-region system remains **unavailable**, not fabricated.

**No new numerical budgets or silent approximations.** Sources remain exactly directed. `partialReflection:false` is an explicit **Fresnel-off approximation**, *not* a full Fresnel or total-internal-reflection-free scene; it must retain the existing qualification caveats. Full Fresnel may truncate native rays, especially weak branches; stop, truncation, native undefined behavior or corner-ambiguous callbacks suppress accepted requested results via unchanged hash/completeness gating. Existing near-critical/grazing uncertainty is **not** fixed by this new geometry contract. Stage-1 sampled measurements and opt-in noncertifying advisories are not upgraded to independent physical proof, and mandatory Stage-2 withholding is not enabled.

Existing `prepareScene`, `reviseScene`, `reviseComponents` where the same new model remains valid, `createQualifiedBundle`, native `evaluateDocument`, typed `evaluateObservables`, source-status/qualification history, immutable sweeps and browser import/fit/reopen can be reused without a scene-specific controller. A baseline accepted under a single-region model cannot add a second polygon through a same-version structural edit or silently promote source provenance.

## Public synthetic demonstration

`examples/two-separated-glass.json` is explicitly **synthetic**, with an exact source at (-200,10) mm, two 150 mm-wide disjoint quadrilateral glasses (`G1` inside index 1.5, `G2` inside index 1.3), shared air index 1, a 10° rightward single ray and downstream finite detector. The actual native simulator must determine its four separate finite-face hits and detector crossing; changing the source direction to 80° is a test of a genuine miss, not a route edit. Changing either glass index affects only that physical region.

Run from a pinned Node-24 checkout:

```sh
npm run setup
npm test
node scripts/run-problem.mjs examples/two-separated-glass.json --out test-artifacts/llm-authoring/two-glass-manual-01
```

Reusing an old `--out` directory is refused. The request and report are source/evidence files, not teacher trials or independent LLM interpretation.

## Evidence and release gate

1. A test-only direct native probe uses two untouched pinned `Glass` objects with real native callbacks, checks normal/oblique first-incidence refraction with independent Snell scalar relationships and records a true miss. This is *feasibility evidence only*, not final canonical admission.
2. New shared `test/two-separated-glass.test.mjs` tests strict whole-system admission, 27 transformations/material combinations plus reverse-order/sources, real native encounters, four separate face events, Snell/reflection checks independent of route, explicit source/background invalid cases, old-schema isolation, qualified revisions, stale evidence and incomplete-run suppression.
3. The browser must actually import a qualified v14 source file, show both glasses/real native rays/readout controls, allow meaningful physical revision, reject crossing geometry without results and export/reopen with original source notes. A programmatic screenshot is evidence of software functionality, not physical/educational fidelity.
4. **Independent Chat B** must review this R2 **physical admission scope** and independently probe cases including region orientation, partial Fresnel, near-grazing or non-disjoint geometries and hash/completeness guards. Review outcome is a genuine separate human-model review only after report posted in review hub; never invented. A FAIL/HOLD blocks production merge even if all CI is green.
5. Earlier source pins, optical numerical settings, original teaching pilot, sealed heldouts, pre-existing Stage-2 policy and upstream checkout are unchanged. Never reinterpret old transfer fixtures as newly blind.

No independent authoring-model trial, textbook solution matching or teacher/student study is asserted by this document.
