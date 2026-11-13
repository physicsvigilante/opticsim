# Preserved PR 29 trial — historical, not a fresh evaluation

`selection.json` and `first-attempt.json` are copied byte-for-byte from
PR #29 head `e4e741c729a377963d00bbc8f85b411c34a7db3c`. They are not repaired,
reinterpreted, or re-scored as newly unseen questions during consolidation.
Their Git blob IDs are pinned by `test/lens-trial-archive.test.mjs`:

- Selection: `5638279cde8bac0f8587939e99576a8843b3c92b`.
- First attempts: `48414cf022cbcc04ac0b2242a078b40bf71c6f09`.

The preserved selection SHA-256 is
`5a6e0b01e2d22160672fad7fee06e7d08f781833b1fbafd503b92833d00a3fa9`.
Hashes establish byte consistency, not authenticity, interpretation correctness,
independent adjudication, or proof of the original exposure chronology.

## Exposure register for future selection

These three Problems paths have already been used and MUST NOT be presented as
new unseen cases in the next trial:

- `08_Ray_Optics_Explanations/05_Prism/Problems/015.png`
- `08_Ray_Optics_Explanations/06_Refraction_at_Curved_Surfaces/Problems/013.png`
- `08_Ray_Optics_Explanations/07_Lens_Formula/Problems/026.png`

They are additional exclusions, not a complete project-wide exposure list.
Consult the earlier evaluation directories as well. A fresh chat does not
establish an independent model evaluation or absence of prior exposure.

## Replay, not a new attempt

The original `scripts/lens-prospective-review.mjs` is also preserved unchanged
from PR #29. It checks the source ZIP and only the named Problems PNG entries,
then sends the original requests through the existing unified dispatcher. It
reads no Solutions, makes no model call, and supplies no native apparatus or
repair. The replay expects three unsupported original quantities (prism
inverse, spherical dielectric apparent depth, lensmaker index inverse), not
three successful question solutions. A future added capability must be
reported as a separate follow-up; do not rewrite these first attempts.

Run the Node suite before replay to verify the pinned original bytes:

```sh
npm run setup
npm test
node scripts/lens-prospective-review.mjs
```

The replay requires a fresh output directory, per the existing evidence policy.
The synthetic moving-lens demonstration belongs to software acceptance, not
this original-problem trial. No source question image is copied into this
new directory or added to the motion demo by this consolidation.
