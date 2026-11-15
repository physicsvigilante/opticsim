# Opticsim PR #75 — independent Chat B review

**Disposition: insufficient-evidence**  
**Assessment date:** 2026-11-15  
**Repository:** https://github.com/physicsvigilante/opticsim  
**Target PR:** https://github.com/physicsvigilante/opticsim/pull/75  
**Exactly reviewed head:** f4fddec213e04d733920399dc0eeea0b29a60dac  
**Base:** c0d4e3048b9e0935cfd567e5f3c81aab23ddd823  
**Reviewed tree:** d8d70b08bddd3c07aa1f50247341423f124818b0  
**Reviewer:** Chat B, GPT-6, an LLM in a separate ChatGPT conversation. This is **not** an independently trained model, a human teaching/physics review, an independent source-interpretation assessment, or a classroom evaluation.  
**Writes:** This report only, on a separate review branch/PR. No production code changes, PR #75 edits, merges, deployment or core-pin changes.

## 1. Decision and scope

**Insufficient evidence for a formal independent PASS at this pinned head.** This is **not** a finding that the implementation's reported optical coordinates are incorrect. The retrieved implementation and the downloaded exact-head CI artifacts support the bounded native detector-hit position feature; I found **no independently demonstrated production-physics defect** in the examined paths. However, the required shared review protocol, review request packet, and report template are absent from the published repository tree, and novel full-runtime/Chrome adversarial executions could not be completed in this review environment. These are explicit limits on a purportedly complete *protocol-conforming independent acceptance*, not evidence of a failed implementation.

The implementer's PR description/review were **not** accepted as authority. Conclusions below derive from pinned GitHub files and diff, pinned upstream native code, GitHub Actions run/job logs, downloaded artifact bytes, independent numerical calculations, and observed screenshots. No new native trace or fresh browser acceptance run was successfully performed by Chat B.

**Review packet availability — blocking procedural limitation:** GitHub returned 404 for all of the following at both the exact head and current main:

- collaboration/REVIEW-PROTOCOL.md
- collaboration/review-packets/pr-75/REQUEST.md
- collaboration/REVIEW-REPORT-TEMPLATE.md

The pinned recursive Git tree has **no collaboration/ directory**. Thus the requested protocol/packet/template could not be read and this self-contained report cannot truthfully claim conformance to their unknown contents. AGENTS.md was read at the exact head, as were the full changed-file list, relevant patches, existing contracts, and test scripts. The three absent documents were not reconstructed from Chat A's assertions.

## 2. Head, diff, upstream and external CI identity

GitHub PR metadata showed an **open, draft, unmerged** PR with the exact head/base above, two head commits, **28 changed files**, and a 2-ahead/0-behind comparison. The PR head was checked again before report publication. The GitHub generated merge-test commit e09f7d858e0cd92a8db673f56d815815947e044d has the **same tree SHA** as the reviewed head and parents base+head; the examined CI run checked out that merge-test commit. This preserves source equivalence *at the checked base*, not a guarantee for any subsequently moved PR head.

GitHub returned **11 completed/successful workflow runs** associated with the exact head. The unified run is https://github.com/physicsvigilante/opticsim/actions/runs/43700823059 and the planar-refraction run is https://github.com/physicsvigilante/opticsim/actions/runs/43700823106. The unified job log independently confirms **726 Node tests passed**, and the new public-workflow acceptance command exited successfully with **seven expected outcomes**. The corrected run includes actual Chrome workflow steps; job success alone is not independent validation of optical truth.

The upstream source pin is **PhyDemo/ray-optics commit 811f508d2b070898c241a568b0c167dcb8645251**. The PR changes neither the upstream core nor its pin. In the upstream pinned Detector.js, onRayIncident receives (ray, rayIndex, incidentPoint), then **mutates ray.p1 and ray.p2**, and updates signed detector power. Pinned LineObjMixin checks an actual line intersection on the finite segment and forward ray. The PR observer snapshots the callback arguments **before** that mutation and delegates to the native method once; this matches the verified native API. Pinned source: https://github.com/ricktu288/ray-optics/blob/811f508d2b070898c241a568b0c167dcb8645251/src/core/sceneObjs/other/Detector.js.

## 3. Direct evidence inspection (not merely green checks)

Downloaded these corrected-head GitHub Actions artifacts via the GitHub connection and independently computed their ZIP SHA-256 digests, matching GitHub's artifact metadata:

| Artifact | Run / artifact ID | Independently matching ZIP SHA-256 |
|---|---|---|
| unified-workflow-evidence | 43700823059 / 14156476265 | a5c8aabdd042e045e0cb705fd1d3ba4513e2346857f1a5924ddc7aa432007b64 |
| browser-exploration-workbench | 43700823059 / 14156930166 | d3195058d580d7c804f42cd96ae4bd881dbf801c0a5302e0d1848b6ae6c13875 |
| planar-refraction-evidence | 43700823106 / 14156910127 | cd5af714880910e23b0f5a6eda79e9e7b5f58015bef60c1da3067c32e6ab37d2 |

Independently inspected the public seven-case acceptance report and input/plan/result/native-evidence files, recalculated **all seven raw input hashes**, recomputed scene and qualified package digests, and inspected the detector browser report and four original PNG screenshots. This is inspection of **CI-captured data**, not new native execution.

| Public acceptance case | Grounded native outcome | Readout qualification |
|---|---|---|
| Plate/mirror at index 1.8 | Completed, 2 detector callbacks | 2 positions; count 2; warning-qualified |
| Index-only hypothesis 1.6 | Completed, 2 callbacks | 2 positions; count 2; positions change |
| Deliberate source-direction miss | Completed, zero callbacks | Genuine accepted empty list and zero count |
| Lens/mirror sampled return | Completed, 11 callbacks from six emitted rays | 11 positions/count; **no pairing or source attribution** |
| Dense two-source overflow | Completed, **53** callbacks | Complete crossing count remains 53; **entire event list null/unavailable**, not clipped 32 |
| Fresnel incomplete run | Incomplete | Both requested results suppressed; raw events not exported in diagnostic snapshot |
| Invalid detector/surface geometry | No native run | No portable scene, no accepted measurement |

This is **five completed runs, one incomplete run and one pre-run rejection**, not seven successful physical measurements. I inspected 15 accepted event records (2+2+11) against each authored detector's finite endpoints, incoming direction normalization, and distance-from-p1 projection. The largest independent segment/projection numerical discrepancy was approximately **2.28e-14 mm**; maximum observed unit-direction norm error was zero within the arithmetic check.

An independently expressed Snell/reflection calculation for the plate predicts x-coordinates **-86.60254037844383** and **152.46109637225803 mm** at index 1.8; the saved native positions are approximately **-86.60254037844382** and **152.46109637225754 mm**. Changing only index to 1.6 changes the second predicted x-coordinate to **163.84793395456126 mm**, against the saved **163.84793395456094 mm**. These are **points on the authored detector**, not automatically paired or source-attributed lateral displacement. All saved y-coordinates for this detector were 50 mm.

The saved browser report states **8 passed new scripted checks, 4 screenshots, zero recorded browser exceptions** on Chrome 157.0.8103.50. The existing exploration browser report states 17 passed checks and zero recorded browser exceptions. Screenshots were examined, not inferred from CI status: two qualified native readouts now display correctly; an index edit changes the reported coordinate; the overflow screen shows one available native count plus one unavailable list; incomplete Fresnel suppresses current readouts. Saved browser export/reopen evidence retains source/assumptions/requests, one index-only physical edit, matching hashes, and **no inherited execution/results**. These screenshots establish UI display for the captured scenarios, **not** universal classroom usability.

## 4. Source-level correctness and API audit

**Native observer and geometry:** src/adapter.js lines 129–176 uses the existing authored mirrorEndpoints orientation contract, converts native y-down into scene y-up, projects the native incident point onto the *finite* detector segment, computes a unit incoming ray direction from the pre-mutation p1→p2 vector, and counts one callback after exactly one native delegation. It treats nonfinite/degenerate ray directions, off-segment residual above 1e-5 mm, and within-0.01-mm endpoint cases as ambiguous. A per-detector cap of 32 events withholds the full list if exceeded; no native ray is moved or created by the observer. The old count/power projection remains the same property shape.

**Native completion and freshness:** src/adapter.js diagnostics suppresses the raw event map on stop, errors, native truncation or undefined behavior; src/observables.js requires a matching canonical scene SHA, executionPassed and a complete native status. Event sample status, observedCount, list length and registered detector crossing count must agree. Stale/incomplete evidence yields suppressed or unavailable values rather than a reused list. src/session.js and src/qualified-ui.js preserve revision and asynchronous-result guards, including when an edit completes during a digest. These are sensible guards within the application's trusted execution pipeline.

**Public workflows and compatibility:** Optional request propagation extends evaluateDocument, checkCandidate, snapshotNativeObservations and browserExecution with default parameters, preserving legacy caller shapes when detector-hit-events is not requested. The public problem planner binds a missing componentId only for a **single compatible authored detector**, without silently assigning among multiple candidates. CLI, qualified package, browser import/export and comparison paths were reviewed. src/result-preview.js identifies actual native events without inventing image detection; src/evidence-panel.js now counts the new method as native; src/scenario-comparison.js refuses automatic comparison/pairing of hit-event lists. Qualified bundle hashes detect mismatch but are explicitly **not signatures or authenticity**.

**Physics interpretation:** Callback order is only observation order. No rayId, sourceId, outgoing branch, object-image detection, continuous irradiance, or cross-detector trace pairing is emitted. Detector signed power remains native relative units, not watts. The transmitted-only Fresnel approximation is labeled by a warning. These limitations agree with AGENTS.md and docs/DETECTOR-HIT-EVENTS.md and avoid a false provenance claim for the observed cases.

## 5. Novel adversarial review and uncompleted tests

I conducted an **independent, isolated arithmetic** check using the CI's saved native points and the pinned endpoint equations: reversing a horizontal detector from 0° to 180° retains the physical crossing coordinates and yields along-distance sums of 450 mm; a constructed hit at **0.009 mm** from an endpoint fails the stated 0.01 mm guard, while **0.011 mm** passes; moving a saved point **2e-5 mm** off the detector fails the 1e-5 mm residual guard. This probes the stated arithmetic but **does not execute the changed Opticsim module or PhyDemo under those novel scenes**. The first exploratory endpoint construction had an error in the probe geometry; it was corrected before the arithmetic result above, with no Opticsim code changed.

I attempted to navigate the CI-packaged static viewer locally through both localhost and file URLs. The environment blocked browser navigation with **net::ERR_BLOCKED_BY_ADMINISTRATOR**. Therefore the independent **new** Chrome scene-edit and native adversarial trials are **blocked/not-run**, not passed. I did **not** install dependencies, alter the repository or re-run native simulator cases. Important still-open tests include: actual physical detector rotation/endpoint reversal; native passes at 0.009/0.011 mm endpoint offsets; two disjoint detectors where one overflows and the other should remain available; near-tangent and grazing rays; callback points inconsistent with the incoming ray line; async revision during hit-array digest; and multiple-source/multiple-detector requests with incompatible/missing target IDs. Existing implementer-authored CI tests cover several nearby error cases but are not replacements for the novel full-runtime probes.

## 6. Findings and required corrections

### G-01 — REVIEW GATE: required published protocol, packet and template unavailable

**Severity:** procedural blocker for claiming a completed protocol-compliant independent PASS; **not** a production defect.  
**Evidence:** exact-head and main GitHub 404, plus recursive pinned Git tree lacking collaboration/.  
**Correction:** publish the original shared REVIEW-PROTOCOL.md, the PR #75 REQUEST.md and REVIEW-REPORT-TEMPLATE.md in a stable, inspectable GitHub ref, identifying their provenance and version. Do not retroactively replace their requested acceptance terms with claims created after this review. Reconcile the independent assessment against the actual packet. The absence of those documents is the primary reason for **insufficient-evidence**.

### E-02 — COVERAGE GAP: novel native/browser adversarial tests uncompleted

**Severity:** evidence qualification, not demonstrated implementation failure.  
**Evidence:** CI artifacts and implementation tests are real, but the separate reviewer could independently inspect rather than execute new native/browser scenarios; local browser navigation was blocked.  
**Correction:** use a pinned-source independent test environment to run and retain at least the endpoint-threshold/rotated-segment case, mixed two-detector overflow isolation, and one mid-run revision/failed callback or geometrical-inconsistency case. Bind outcomes and failure logs to the exact source/merge tree. A later change in head SHA must be reviewed anew; original passing CI cannot qualify a moved head.

### H-03 — HARDENING: externally supplied observation payloads are not independently authenticated

**Severity:** non-blocking within the **trusted local-execution** contract; becomes significant if this API is presented as verification of externally supplied execution records.  
**Evidence:** src/observables.js checks event sample status, matching number of events and crossing counts, and scene hash; it does **not independently recheck every accepted event's finite coordinates, unit direction, segment residual, endpoints or incident-ray consistency**. A fabricated, count-consistent execution object passed directly to the exported evaluation API could be labeled native-hit-event-observation even without a real native callback; the same general trust-boundary limitation existed for legacy supplied counts. Scene hashes and qualified-bundle hashes are integrity/mismatch checks, **not authenticated native-execution attestations**. I did not find a public user JSON import route that lets the attacker substitute this runtime evidence in the ordinary native pipeline.

**Correction:** explicitly document that only the internal native executor may provide the execution object. If external result ingestion is supported later, independently validate event values and bind attested runner provenance; do not claim that a matching scene hash proves native origin.

### U-04 — OPTIONAL TEACHER UX: bounded event list readability

**Severity:** optional improvement, not release blocker.  
**Evidence:** preview prints up to 32 verbose text lines per detector, and the screenshots do not mark individual hits directly on the visual ray diagram. Correct classification and suppression are visible.  
**Suggestion:** add a compact event table/selector or optional diagram markers keyed strictly to **actual** saved events, with callback-order caveat; preserve full-precision machine-readable JSON and do not infer pairing.

### O-05 — OPTIONAL CAPTURE GRANULARITY

**Severity:** low, not verified erroneous.  
**Evidence:** one detector-hit-events request enables per-instance capture on **all authored detector objects**, while only specifically requested readouts are qualified/displayed. With at most two detectors and 32 events each the extra storage is bounded.  
**Suggestion:** if request-level opt-in is intended to mean per detector (rather than per run), pass requested detector IDs through the capture layer. Otherwise document per-run opt-in clearly; avoid needless raw data collection.

**No confirmed blocking code defect:** I did **not** observe manufactured ray/source labels, a callback post-mutation direction error, accepted clipped 32-event prefix, false empty on overflow, count/list mismatch in accepted CI data, old count/power API breakage, or stale readout leakage in inspected evidence. Lack of a reproduced defect does not establish proof for all arrangements.

## 7. Decision conditions, bounds and handoff

**Current label: insufficient-evidence.** This label addresses the missing **review governance and separate-review runtime evidence**, not an asserted failure of the bounded physical implementation. Do **not** record this as independent teaching-expert approval or a second independently trained model's verdict. No recommendation to modify native laws, increase engine budgets, replace PhyDemo, merge PR #75, or deploy the viewer.

To reconsider as **pass** on the unchanged pinned source, make the three governance files available for exact comparison and add attributable novel end-to-end test results (or explicitly narrow the review protocol to source/artifact audit and get separate approval for that scope). If one of those tests exposes a demonstrable defect, use **changes-requested** with a reproduction before proceeding. If the source head changes, all original CI and this review must remain tied to f4fddec213e04d733920399dc0eeea0b29a60dac; do not treat them as validation of the new SHA.

**Evidence links:** [PR #75](https://github.com/physicsvigilante/opticsim/pull/75) · [source observer](https://github.com/physicsvigilante/opticsim/blob/f4fddec213e04d733920399dc0eeea0b29a60dac/src/adapter.js#L129-L176) · [observable gate](https://github.com/physicsvigilante/opticsim/blob/f4fddec213e04d733920399dc0eeea0b29a60dac/src/observables.js#L65-L114) · [evidence panel](https://github.com/physicsvigilante/opticsim/blob/f4fddec213e04d733920399dc0eeea0b29a60dac/src/evidence-panel.js#L76-L101) · [CI unified](https://github.com/physicsvigilante/opticsim/actions/runs/43700823059) · [CI planar](https://github.com/physicsvigilante/opticsim/actions/runs/43700823106).
