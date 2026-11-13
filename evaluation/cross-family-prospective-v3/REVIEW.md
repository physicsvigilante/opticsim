# Cross-family prospective authoring study v3 — sealed development replay

**Status:** exact first-attempt replay completed; same-assistant developmental control, **not** independent-model accuracy. This study does not change Opticsim ray optics, native PhyDemo, schema versions, emitted sources or original textbook studies.

## Frozen order, prior to any deterministic physics or scoring

| Record | Immutable Git commit |
|---|---|
| 12 synthetic prompts and pre-registered class slots | `08518e49cea9a27e9e73965a9954618ac9517b26` |
| 12 unedited first `opticsim-problem-v1` responses by this same assistant | `ab792a3923da13f956eded1fa364d8089875bb21` |
| Manually transcribed reference (same assistant), written only after attempts | `aed2f9543dcc618134f24fc9ac14ae7223c5995d` |

The replay pins exact Git blob SHA-1 records for the prompts, policy, attempts and reference, retains their SHA-256 hashes and seals every serialized per-case input before preflight. None of those four files is edited after being recorded. Git hashes check byte consistency, not independent authorship or truthfulness.

## Observed first-attempt results

[Qualified-authoring run 43416507955](https://github.com/physicsvigilante/opticsim/actions/runs/43416507955) completed the **unchanged** twelve-case replay on pinned PhyDemo at commit `811f508d2b070898c241a568b0c167dcb8645251`. Exact CI evidence: `qualified-authoring-evidence` artifact SHA-256 `3dc2a1405f4e695b421ff74d6e840e5448db20b505e35d3c10c1c2cb1b156b77`.

| Separate dimension | Recorded count |
|---|---:|
| First attempts submitted | 12/12 |
| Physical facts agree with manually transcribed synthetic reference | 12/12 |
| Authored component IDs preserved | 12/12 |
| Requested kind multiset matches reference | 12/12 |
| Deterministic preflight classification agrees with control | 12/12 |
| Fully specified positives recognized as native-ready | 8/8 |
| Positives with exactly one native executor attempt and complete native run | 8/8 |
| Positives with every requested quantity available or explicitly qualified/conditional | 8/8 |
| Four negatives blocked appropriately, with zero native executor calls | 4/4 |
| Native executor calls in total | 8 |
| Recorded uniquely inferable target IDs supplied by Opticsim | **17** |
| Repairs / external model calls | **0 / 0** |
| Independently scored model accuracy | **Not measured** |
| Original textbook questions solved | **Not measured** |

### Supported synthetic control breakdown

| Case | Model | Actual native evidence | Result provenance |
|---|---|---|---|
| P01 | Single thin lens | 100 emitted rays, 0 truncation | Conditional ideal-image mathematics and native source emissions; **not** native image detection |
| P02 | Finite plane mirror | 5 source rays and 5 native reflections | Actual sampled reflection count |
| P03 | Finite circular-arc mirror | 1 source ray and 1 native reflection | Actual local-normal reflection |
| P04 | Infinite planar dielectric boundary | 1 native encounter, incidence 8°, transmission about 6.05218° | Actual native angles under **explicit Fresnel-off approximation** |
| P05 | Finite circular dielectric region | 2 native boundary encounters | Actual sampled angles/counts; **explicit Fresnel-off approximation** |
| P06 | Finite nonparallel triangular prism | 2 native face encounters | Native face-local counts, **not** reconstructed source-specific routes; explicit Fresnel-off |
| P07 | Mixed lens, finite plane mirror, detector | 4 mirror reflections and **0 detector crossings** | Zero is a measured zero; no route or image detection claim |
| P08 | Two thin lenses | 100 emitted rays, 0 truncation | Conditional model image plus native sampled emissions; **not** native image detection |

All eight synthetic native runs completed with zero recorded brightness truncation. They do **not** verify every imaginable optical route, continuous angular coverage, or physical fidelity of an unrelated textbook question. Fresnel-off cases omit partial Fresnel reflection by author instruction; full-Fresnel native robustness is not established here.

### Deliberate negative controls

| Case | Original missing/unsupported condition | Preflight and result | Native calls |
|---|---|---|---:|
| N01 | Ideal lens focal length and sign not stated | `blocked`; `needs-information` | 0 |
| N02 | Material-based lensmaker focal-ratio request outside registered result contract; no apparatus | `blocked`; `UNSUPPORTED_QUANTITY` | 0 |
| N03 | Two independently emitting sources; no source identified for requested count | `blocked`; `AMBIGUOUS_COMPONENT_TARGET` | 0 |
| N04 | Explicit circular-dielectric inside index 0.7 below contract minimum 1 | `invalid-input` and no repaired index | 0 |

The implementation creates no missing lenses, sources, material properties, or fictitious rays; an unsupported request never silently becomes a differently answerable one. Native validation and a correct refusal are separate from authoring a faithful interpretation.

## Interpretation and next engineering decision

This is deliberately an **easier, supported** synthetic sample than the previous original-JEE prospective study, which covered primarily unregistered analytical quantities. Both tracks are necessary, but **neither** measures independent LLM accuracy. The same agent authored the cases, first responses and post-seal reference. The 12/12 synthetic fact score is therefore **self-consistency on hand-chosen examples**, not an unbiased generalization estimate. Source prompts were not independently held out or judged. The strong software conclusion is that the sealed input survived deterministic preflight and execution, and 17 unique component targets were derived without optical guesswork.

**Recommended next:** an independent provider run should use **new, private or unexposed** problems with a separately adjudicated answer key and first-response-only capture, with explicit consent/key and cost budget. Score fact extraction, request-kind selection, refusal discipline and native capability separately; a shared registry and preflight should remain the only physics execution layer. Richer light sources remain deferred by the owner's direction.

No public GitHub Pages deployment, vendor updates, source ZIP exposure, or past evaluation record rewrites.
