# Broader Problems-only capability review

This is a **same-assistant development review**, not a model benchmark or an
independently adjudicated set of answers. No Solutions images were opened; no
native simulation or complete solution of these ten questions is claimed.
Earlier project exposure cannot be excluded.

The selection rule was committed before the interrupted run opened its images,
at `85a5a54f6a1bbefe69f184185a54b494f1d29c82`. This continuation reread those same
images. The selection manifest preserves the original paths and archive/image
SHA-256s (JSON whitespace is not significant). It sorts the eight sections,
selects section indices 0, 1, 3, 5 and 7 (the first, floor-quartile positions and
last), then the first and middle Problems PNG in each. This spreads coverage but
does not make the sample statistically representative. Original images remain
in the user's archive, not public assets.

## Findings

| Cases | Required operation | Missing capability or qualification |
|---|---|---|
| B01 | Incidence angle from direction vectors | Angular observation/inverse geometry, not a new reflection law. |
| B02 | Repeated images in a triangular mirror enclosure | Shared endpoints and image enumeration; interaction counts are not image counts. |
| B03-B04 | Concave-mirror magnification and prescribed-motion images | Curved reflector and applicable analysis; explicit sweeps do not establish symbolic time expressions. |
| B05-B06 | Angles at critical incidence and through layered media | Explicit refractive media, boundary normals and reflected/transmitted branch observations. |
| B07 | Power of a spherical refracting surface | Two-medium curved interface and surface-power analysis. |
| B08 | Images through a silvered glass hemisphere | Refraction, curved reflection and multiple-image branch analysis. |
| B09-B10 | Eye accommodation and swapped-lens angular magnification | Explicit simplified-model/viewing assumptions and inverse/angular results, not transverse magnification alone. |

`review.json` distinguishes every requested operation from the supported
apparatus and the missing result. It deliberately does not assign an accuracy
score. Missing dimensions needed only for a drawing are not treated as proof
that an analytical question lacks a mathematical answer.

## Selected next physics increment

Investigate and expose **one planar dielectric boundary with explicit media**,
then composable layers, using the pinned native engine. Refractive-media support
recurs in B05-B08; it will not on its own solve the curved/multiple-image cases.
Curved mirrors recur separately in B03, B04 and B08. Neither extension is
implemented in this PR. Parallel-beam illumination is not the leading common
blocker in this sample, and no distant-point approximation should substitute for
an exact parallel source.

The next scoped proposal should first verify the pinned native primitives and
state medium membership, normals, index ratios, branch semantics, critical-angle
tolerance, run budgets and observables. Acceptance should cover normal and
oblique incidence from both directions, near-critical/TIR cases, native branch
behavior, invariant units, serialization, and composition without hidden route
prescription. Do not mix implementation of new physics with a promise of solving
all ten questions.

## Recheck the input evidence

After the repository's normal setup:

```sh
node scripts/verify-capability-review.mjs
```

The script verifies the archive, ten original Problems PNG hashes, and review
case IDs. It writes `test-artifacts/qualified-workflow/broader-review-input-verification.json`.
It reads no Solutions entry. The check proves input identity and record
consistency, **not correctness of the author's capability judgments**.
