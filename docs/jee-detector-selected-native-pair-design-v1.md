# Design D-02 — JEE detector-selected native ray-pair geometry

**Status:** PROPOSAL, DESIGN ONLY. Not implemented, verified as a production result, reviewed, merged or released.
**Date:** 2026-11-18
**Production baseline:** \`main\` \`d3509e82fb65d81aabe336666851f8f2962623f4\`.
**Evidence:** [#134 preregistration](https://github.com/physicsvigilante/opticsim/issues/134), [#135 independent native R2 research review](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-135/reviews/review-02-chat-b.md), [issue #136](https://github.com/physicsvigilante/opticsim/issues/136). #133 native-free candidate A is a separate, still-held draft. No held branch is part of this design's base.

## 1. Scope, method and non-claims

Propose **B1 — two native single-ray runs selected by one finite detector window, with an optional advisory 2D backward-line intersection**. Both sampled paths are decided by pinned PhyDemo; Opticsim only audits its existing read-only native measurements and, after both complete, constructs a **mathematical intersection of two backward-extended outgoing supporting lines**. This is not a native propagated virtual ray.

**Explicitly NOT:** an eye, pupil, observer position, retina, image sensor, physical/unique stigmatic image, observed image, visual accommodation, intensity/irradiance, an observer's actual apparent point, simultaneous two-ray propagation, wave/3D optics or the textbook's final answer. A genuine detector crossing is not a universal visibility statement. A result based on two rays from **two separate native executions** says nothing about whether both rays exist together at one actual observer at the same time. An algebraic two-line intersection does not establish point-image uniqueness across a ray bundle.

This is an engine capability rather than a problem-specific answer script: one real v5 source, one plane, one finite detector and two explicit source directions. Reuse existing native physics and measurement contracts. Do not add a second Snell solver or prescribe paths to the native engine.

### What the research already establishes — and does not

[#135 R2](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-135/reviews/review-02-chat-b.md) independently verified the raw native event records and backintersections: for the one 5 mm detector at x=40 and object depth 120 mm, full-Fresnel 1.5→1 at ±0.5° gives native crossing positions (40, ±1.5708611274685678) mm and a *derived pairwise* depth 79.99619199829817 mm. With equal indices 1→1 or 1.5→1.5, actual native crossings are (40, ±1.396298846521404) mm and derived depth 120.0000000000008 mm. Shifted/shortened finite windows give real misses; source/detector orientation, units, incomplete runs, Fresnel policy and mismatch controls were exercised. **The tested line-conditioning cutoffs and synthetic perturbations remain research heuristics, not a native error/uncertainty certificate.** These data justify a design exploration, not a released image feature.

## 2. Proposed exact, LLM-authorable input (not a live API)

Use a **new standalone, versioned experiment request**, not a new scene version and not an implicit extension of the SHA-frozen \`scripts/run-problem.mjs\`. Supply one apparatus and an explicit second source heading; this minimizes LLM duplication while keeping the changed physical field auditable.

\`\`\`json
{
  "format": "opticsim-detector-selected-pair-request-v1",
  "apparatus": {
    "lengthUnit": "mm",
    "title": "Finite window over one planar boundary",
    "runPolicy": "preview-v1",
    "components": [
      {
        "id": "S1", "type": "point-source",
        "parameters": {"x": -120, "y": 0, "brightness": 1},
        "emission": {"mode": "single-ray", "directionDeg": -0.5}
      },
      {
        "id": "I1", "type": "planar-interface",
        "parameters": {
          "x": 0, "y": 0, "normalDeg": 0,
          "negativeIndex": 1.5, "positiveIndex": 1,
          "partialReflection": true
        }
      },
      {
        "id": "D1", "type": "ray-detector",
        "parameters": {"x": 40, "y": 0, "orientationDeg": 90, "length": 5}
      }
    ]
  },
  "sourceId": "S1",
  "interfaceId": "I1",
  "detectorId": "D1",
  "secondDirectionDeg": 0.5,
  "requestedResult": "sampled-finite-window-line-pair"
}
\`\`\`

Normative envelope: **only** these top-level keys, all required; strict existing \`prepareScene\` input contract for \`apparatus\` with \`lengthUnit\` mm/cm/m, exactly one explicitly ID-labelled component of each type and **no other components**. \`runPolicy\` must be explicitly \`preview-v1\` or \`dense-v1\`; no implicit numerical-policy override or repair. Existing \`prepareScene\` fills presentation-only camera and inactive emission-angle defaults, but may not invent physical source direction, lens, stop, glass or detector. The source emission must be \`single-ray\`, with explicitly provided first \`directionDeg\`; the second direction is explicit in this envelope, finite in [−180,180] and different from the first. A duplicated direction does **not** define two distinct paths. \`sourceId\`, \`interfaceId\` and \`detectorId\` must exactly match their uniquely typed authored components; no automatic target binding, renaming, ordering inference or natural-language fallback. \`requestedResult\` is the one literal above.

The apparatus is a **minimal existing authoring request**, not user-supplied native hit records. Preparation must select existing canonical schema **v5**, \`physics.model='planar-media-tracing'\` and the pinned PhyDemo \`upstreamCommit\`; never generate or migrate to v20. Reject any other schema/model, plane count, additional source/optical object, wrong side, unbounded number, unknown field, missing index, or ambiguous physical geometry. Do not accept external execution summaries or object IDs as authority.

Proposed additional **bounded first-release scope** (must be reviewed, not yet validated as product admission): a finite detector 1–10 mm long, tangent parallel to the planar interface (orientation modulo 180°); source and detector strictly separated by the plane, both finite detector endpoints on the receiving side; source and detector each at least 1 mm normal distance from the plane, and all coordinates/endpoints within existing native bounds. These are intentionally more restrictive than the native v5 surface-clearance minimum 0.01 mm. The first research fixture has 5 mm width, 120 mm source depth and 40 mm receiver offset; extending to the proposed range requires new stress evidence before implementation release. No \`openingLength\`, pupil type or diffraction is introduced.

## 3. Deterministic native orchestration — two independent real executions

1. Validate the complete request, including all nested allowlists and physical geometry, **before any native call**. Snapshot original UTF-8 input bytes and \`inputSha256\`; reject oversize (>1 MB), malformed or nonfinite JSON, and invalid targets without apparatus repair.
2. Use existing \`prepareScene(apparatus)\` exactly once to construct canonical **first** v5 document A. Immediately make B by \`structuredClone(A)\` and replace **only** S1's \`emission.directionDeg\` with the explicitly supplied \`secondDirectionDeg\`; rerun existing \`validate(B)\`. No other physical, presentation or numerical field may change. Do not mutate A or caller-owned apparatus.
3. Persist both separately validated canonical serialized scenes and **distinct** SHA-256 values. Optionally derive a scene-family signature by sorting component IDs and deleting *only* the named source \`emission.directionDeg\` before stable canonical serialization; bind the same \`schemaVersion\`, adapter/native pin, full \`physics\`, numerical \`simulation\`, source, interface and detector IDs. The two **scene hashes legitimately differ**. Reject a second execution with the wrong family signature or reuse of either run's evidence.
4. Execute PhyDemo **twice**, once per canonical scene, by the existing \`evaluateDocument\` and pinned core, explicitly requesting \`detector-hit-events\` (D1), \`detector-crossings\` (D1), \`interface-first-event\` (I1), and \`source-emissions\` (S1). Use existing \`evaluateObservables\` only on the fresh matching document/execution snapshot; **never** accept externally fabricated hits/directions or compare native callback indexes as cross-run ray IDs.
5. Require per run: completed native status (\`completed\` or reviewed completed-with-warnings path), \`executionPassed:true\`, zero truncated/undefined rays, exactly one emission, exactly one interface interaction, exactly one **native transmitted branch** with correct object/receiver index orientation, exactly one native detector crossing and one fully qualified hit-event position/direction, one first-event record, and incoming detector direction matching that native transmitted branch. Reflected Fresnel branch may exist but cannot count as a receiving-side selected ray. Full Fresnel (\`partialReflection:true\`) is the primary profile. Explicit \`false\` is a **transmitted-only approximation** and its original warning must survive. If opt-in native parentage is later added, it is **run-local object ancestry, not a full path or stable cross-run ID** and needs separate validation.
6. Both hits must be on the same **real authored finite segment** with recorded distance from the first endpoint, distance from the second endpoint, native trace direction, source-side/receiving-side orientation and margin. One or zero measured crossings is valid native evidence, but **not** a valid two-hit geometric intersection. A completed native miss reports measured \`0\`/empty event list, while the derived pair returns **\`unavailable\` / null**, never zero virtual depth.
7. After capturing **both** native snapshots, decide whether the derived pair is eligible. An incomplete/stale/missing native run yields null/suppression; a wrong apparatus or wrong direction yields a typed refusal. Keep raw execution warnings and readout statuses as *separate records* attached to each run's hash even on a null/suppressed result. Early preflight-invalid requests have **no** executed evidence; do not manufacture an evidence list.

**No generic native lineage:** exactly one sampled source/emission/plane/transmission/hit per run is the reason source association is bounded. The native hit-event order is not an identity path. No pairing of unrelated scenes, multiple native rays, multiple sources, weak Fresnel branches or an implicit eye.

## 4. Proposed result contract (advisory, not an image)

Separate native evidence from post-native extrapolation. **Do not** describe a derived point's status as a "native image available". A useful first version can return native detector selections even when no stable pairwise point is admitted.

\`\`\`json
{
  "format": "opticsim-detector-selected-pair-result-v1",
  "status": "advisory",
  "method": "derived-two-native-detector-lines-backward",
  "interpretationAssessment": "not-assessed-by-engine",
  "nativeImageDetected": false,
  "observerModel": "finite-detector-segment-only-not-an-eye",
  "native": {
    "executions": 2,
    "runs": [
      {
        "id": "run-1",
        "canonicalSha256": "<scene-A-SHA256>",
        "nativePin": "<pinned-upstream-SHA>",
        "status": "completed",
        "inputReadoutStatus": "available",
        "rawWarnings": [],
        "readoutWarnings": [],
        "emitted": 1,
        "detectorCrossings": 1,
        "hit": {"pointMm": {"x": 40, "y": -1.5708611274685678},
                "incomingUnit": {"x": 0.9999143248553549, "y": -0.013089803247560816},
                "distanceFromP1Mm": 0.9291388725314322}
      },
      {"id": "run-2", "canonicalSha256": "<scene-B-SHA256>", "nativePin": "<pinned-upstream-SHA>",
       "status": "completed", "inputReadoutStatus": "available", "rawWarnings": [],
       "readoutWarnings": [], "emitted": 1, "detectorCrossings": 1,
       "hit": {"pointMm": {"x": 40, "y": 1.5708611274685678},
               "incomingUnit": {"x": 0.9999143248553549, "y": 0.013089803247560816},
               "distanceFromP1Mm": 4.070861127468568}}
    ]
  },
  "geometry": {
    "status": "advisory",
    "value": {
      "pointMm": {"x": -79.99619199829817, "y": 0},
      "normalDepthMm": 79.99619199829817,
      "lineSine": 0.02617736355354841,
      "backwardDistancesMm": [120.00647357027965, 120.00647357027965],
      "endpointClearancesMm": [0.9291388725314322, 0.9291388725314322],
      "extensionToSceneScale": 0.7500404598142478
    },
    "reasonCode": null,
    "qualification": {
      "nativeEvidenceStatus": "available",
      "derivedMethod": "geometric-inference-after-native",
      "numericErrorCertified": false,
      "physicalImage": false,
      "warnings": ["Pairwise, conditional 2D line intersection; NOT an eye, physical image or certified native-location uncertainty."]
    }
  },
  "questionSupport": "not-assessed-by-engine"
}
\`\`\`

This is a **schema proposal**, and the example coordinates are **research evidence copied for illustration**, not a promise that an unimplemented API ran. In production use exact runtime bindings, not these literals. No consumer may relabel this \`advisory\` coordinate as a detected/verified image or present its normal depth without the method and qualification. A native \`qualified\` input sets \`geometry.qualification.nativeEvidenceStatus:'qualified'\`, retains *both* original warning records, and does **not** silently gain \`available\` from the later arithmetic. Completed missing ray: \`geometry:{status:'unavailable',value:null,reasonCode:'...'}\`, with measured native counts retained. Native incomplete or stale: \`geometry.status:'suppressed'\` and null, with separately recorded reasons. Unknown/unsupported inputs give \`invalid-input\`, \`needs-information\` or \`unavailable\` **before** native work and without an invented positive result. The top-level status is never \`available\` solely due to a derived point.

A future production version may offer a separately marked \`qualified\` *geometric* answer after independent numerical-admission review; this design explicitly does **not** equate the current proof-of-concept cutoffs with such review.

## 5. Numerical conditioning and actual safety gates — review needed before code

**No native numerical accuracy bound exists in #135.** The logged 5 mm fixture gives \`|u1×u2|≈0.026177\`, minimum endpoint clearance ≈0.929139 mm, and backward extension/scene scale ≈0.75. The research helper used heuristic thresholds \`1e-4\`, \`0.05 mm\` and \`10×\`, with a synthetic measured-line perturbation moving its intersection ≈0.001529 mm. These numbers cannot certify ray-path accuracy, image depth or the physical scene.

Propose a **conservative, explicitly preliminary output-admission policy** only for the *advisory geometric point*, subject to separate numerical stress tests and independent review:
- Require finite near-unit detector directions, \`|u1×u2|≥0.01\` (excludes nearly parallel **and antiparallel**), *both* backward parameters strictly negative, source-side intersection in the oriented plane-normal frame and both genuine incoming detector hits. Do not use first-line/second-line algebraic residual to certify accuracy.
- Require each actual detector hit at least **0.5 mm from either finite endpoint**, independent of callback ordering. Require both directional scenes to use the same endpoint geometry in mm after original unit conversion.
- Use a **plane-centred local normal/tangent basis** for double-precision backintersection, and translate the result back to world coordinates only at the end. Record local/global coordinate magnitude, max backward extension and a dimensionless extension-to-scene-scale ratio, proposed **≤2** for advisory display (research baseline ≈0.75). Refuse nonfinite/overflow or a result not strictly on the object's side of the plane.
- The preceding \`0.01\`, \`0.5 mm\`, \`2×\` constraints are proposed **conservative product display gates**, **NOT validated accuracy bounds**. They are not inherited from the old research helper. No calibrated native hit-direction/position error distribution is claimed.
- Record a deterministic *numerical sensitivity diagnostic* by perturbing measured 2D hit positions/directions under **explicitly disclosed hypothetical** magnitudes; never call this true native precision or a probability interval. Calibration/reproducibility and cutoff choices require independent review before any geometry is exposed in a release.

**Required separate stress feasibility before implementing an admitted geometric point:** preregister and run a small native matrix across index contrasts (equal, lower/higher), reverse sides and normals ±180°, ±90°, ±37°, translations up to a documented extent, mm/cm/m units, detector widths in the proposed [1,10] mm range, axial source-detector distances, two-ray separations, Fresnel policies, both extreme finite endpoint margins, near-parallel/antiparallel, TIR/near-critical and native warning/truncation conditions. Test deliberately unstable geometry and withhold, rather than selecting a lucky pair. Compare independent Snell geometry only as a check *after* native execution, not as an input to trace. Record sensitivity for each accepted range. Until the numerical criteria are independently supported, **the implementation must return actual selected native hits but withhold any public derived coordinate** outside a narrowly verified subdomain. Review may recommend a narrower B1 release or deferring all public geometry.

## 6. Integration/persistence and historical gates

- **New standalone native CLI** proposed: \`node scripts/detector-selected-pair.mjs <request.json> --out test-artifacts/llm-authoring/<fresh-directory>\`. Reuse the existing guarded \`reserveAuthoringOutput\` to avoid output clobbering/symlink traversal; never change the historically frozen \`scripts/run-problem.mjs\` or \`scripts/author-scene.mjs\`. Persist original raw input bytes and hash, two validated **distinct** source scenes with hashes, run-specific native observations/warnings, frozen initial interpretations and derived calculations as **separate** artifacts. Never allow user-supplied evidence or absent native results to authorize geometry. Stale/cross-run mixes fail closed.
- **No public \`opticsim-problem-v1\` request kind yet.** That one-scene dispatcher cannot safely represent two native executions without a separately reviewed routing change. Do not silently count an advisory point as original question answered. A future dispatcher integration must be versioned and independently reviewed.
- **Runtime:** supported Node 24; existing pinned PhyDemo through the current build/checker. Full native, optical, CLI and real Chrome **regressions** required. No new observer browser image feature is implied. A dedicated browser UI (if useful) would require its own later release gate.
- **Dependency:** B1 must start from current production \`main\`, not from unmerged #133 conditional A, #135 research or v14–v19. Reuse only capabilities genuinely in main. Do not claim v19 beam composer support under this v5-only method.
- **Governance:** design-only PR → independent design review → additional numerical native feasibility on separate *test-only* tree → independently reviewed source implementation → owner release decision and issue #123 main protection. Reviewed but held #129 aperture corner correction and all other optics PRs are unaffected.

## 7. Acceptance matrix for future B1

| Group | Grounded controls | Required behavior |
| --- | --- | --- |
| P0 | Exact well-formed 5 mm window, 120 mm, 1.5→1, ±0.5°, full Fresnel | Two *real* native hits in one authored segment geometry, two different matching scene hashes, advisory derived line point **only after** geometry gate |
| P1 | 1→1 and 1.5→1.5, ±0.5° | Native equal-index transmission, ~120 mm pairwise depth, no invented image or reflected branch |
| P2 | Shorten/shift/offset finite segment to miss a ray | Genuine measured zero/empty hit list, derived null/unavailable; not continuous darkness |
| P3 | Explicit Fresnel-off | Native \`qualified\` readouts; derived nativeEvidenceStatus \`qualified\`; both run-specific original warnings retained |
| P4 | Shallow ray-depth budget, truncation, native warnings, stale/uncaptured | Suppressed/null; separate per-run evidence and raw warnings retained where invocations existed |
| P5 | Duplicate ray direction, swapped target, extra optical body, mismatched run family | Reject before pairing, no invented path/source ID or fallback |
| P6 | Mixed component order, inverse normal, reverse travel, translate, mm/cm/m | Normal-depth signs invariant where physically equivalent; scene SHA/family association verified |
| P7 | Near-parallel/antiparallel, grazing/TIR, detector endpoints, huge extension, high coordinate translation | Deterministic numerical withholding; no forced intersection or claimed precision |
| P8 | Original input mutation after asynchronous launch, native capture ON/OFF | Snapshot/scene-hash invariance, no stale hit reuse, old native meters and PhyDemo delegate unchanged |
| P9 | Old CLI hash freeze, historical scene versions, unrelated problems, direct Chrome regressions | Original byte identities and behavior unchanged, existing full Node24/native/Chrome CI passes |
| P10 | Original question fidelity and teaching interpretation | Method/assumptions/limits explicit; no claim of original textbook solution completeness |

## 8. Separate decisions and owner gate

**Review this document as a proposed contract, not physics implementation.** Verify that an advisory result from two independent actual rays is interpretable and useful for JEE without an image claim, and challenge the numerical thresholds, output statuses, two-run JSON/CLI design and provenance requirements. A passing design review is **not** permission to merge, implement the numerical point without stress evidence, or release the earlier research.

A future production source must have its own exact-tree CI, genuine native tests, independent review, and separate owner decision. Until then Opticsim has only its existing underlying native detector measurements and the **unmerged** research and conditional-A branches. Keep issue #123 branch protection and held #129/v14–v19 dependencies separate.
