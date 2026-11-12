# Six real Lens Formula questions — GPT-6 development attempt

**Status:** Nonblind development trial, not an independent LLM benchmark. This same assistant previously saw audit notes about some expected results. No separate model API was invoked. Do not interpret this as a blind LLM accuracy result.

## Inputs

Questions 014, 001, 007, 021, 022, and 027 are original *Problems* PNGs from the user's `08_Ray_Optics_Explanations.zip` on `main` (archive SHA-256 `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`). The model's case-by-case interpretation, quantities, and caveats are in [attempt.json](attempt.json). The three native candidates are in [native-requests.json](native-requests.json). **No Solutions PNG was read.**

## Qualitative outcomes

- **#14:** f1=+20 cm, f2=+10 cm, lens separation 30 cm, object 30 cm before first lens. Independent conditional ideal-lens result: image +7.5 cm right of lens 2. Native PhyDemo can illustrate the ray paths; finite aperture, source emission, source height and brightness are explicitly declared modelling choices. The existing lens-train ABCD analysis is applicable to these same native optical objects.
- **#1:** two sources 24 cm apart and f=+9 cm. Two inverse solutions: lens at 6 cm or 18 cm from the first source, and the corresponding ideal common image x=-12 cm or x=+36 cm. Both layouts can be traced with declared illustrative finite choices; multi-source detector readings do not provide per-source image provenance.
- **#7:** thin lenses f=+5 cm and -10 cm in contact have equivalent paraxial f=+10 cm. Current contract forbids coincident lens surfaces; replacing them by one equivalent lens is a transparent analytic reduction, not native simulation of both physical lenses. No source was specified.
- **#21:** three lenses +10, -20, +9 cm with gaps 15 and 5 cm have ABCD C=0; an exact collimated input remains collimated, so there is no finite convergence point. Exact parallel input is not exposed by the current point-source contract.
- **#22:** intensity-dependent refractive index cannot be expressed by a fixed-focal-length ideal lens. No fabricated numeric result or native scene.
- **#27:** an ideal paraxial derivation gives focus (5f,2d) for lenses separated by 3f when the second is offset by d. Current authoring supports neither a y-offset second lens nor an exact collimated source. No faked aligned configuration.

## Reproduction

From this development branch after `npm run setup`, run `npm test`, followed by `node scripts/real-lens-trial-acceptance.mjs`. GitHub Actions runs the same command and retains its report and three strict scene JSONs under private artifact `real-lens-development-trial`.

Download the three `*.ray-optics-2d.json` scenes from the artifact to open them via the existing browser's **Open sandbox**. This trial does not require an LLM API, external solution images, extra optics physics or new production modules. The runner independently verifies the mathematics (#14 existing ABCD lens predictor, #1 inverse image coincidence, #7 thin-contact equivalent, #21 afocal C=0 and #27 ray-height independence), and executes three illustrative scenes through the pinned native PhyDemo checker.

**Important distinction:** A native run does not independently prove that an image is formed at the calculated point. These results are an assisted nonblind development check, not an independent assessment of a model's ability to read unknown diagrams or correctly reject all unsupported questions.
