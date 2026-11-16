# One-case fixed-native-RNG study — research only

**DRAFT / DO NOT MERGE**. This is a scoped test of native randomness as a source of near-critical repeatability variability, responding to independently reviewed PR #97 finding **R-01**. It does not repair PhyDemo, certify an exact mathematical critical-angle branch, derive an incident-point tolerance or change measurements.

The [preregistered protocol](PROTOCOL.md) was committed **before the new experiment**, at `6e6d3a7ed66b04473b0c1e0fceac557a99468168`. It fixes one original PR #96 case `critical-shift-neg`, 6 shuffled balanced blocks of four profiles (24 separate Node 24 native runs), schedule seed `0x9800A55` and independent **native** randomSeed string `opticsim-fixed-native-seed-v1-20261116`. The exact original original PR #96 `inputs.json` is reused byte-for-byte: **19,205 bytes / SHA256 `caa07af040d0a71b50ea6b69470aa55a545b04d52195994913123a902b434df3`**. Frozen scene save SHA256 for the selected case: `4389fecfe80ad01fa7cb160f22319327ccf9e30bb35c211012cc15599ff422c6`. No physical input is reauthored.

**How the fixed native seed is applied:** `core.compile(candidate)` produces the unchanged normal adapter native configuration. In this research script only, a copied native object adds the upstream-supported `randomSeed` property, and the original pinned `core.loadNative` loads it through `Scene.loadJSON`. That source method initializes a deterministic RNG **before creating scene objects**; the experiment checks `scene.randomSeed` without consuming its RNG. Both the unseeded compile-config SHA and seeded *test-only* native-config SHA are retained separately in every actual trial. There are **no** changes to `src/adapter.js`, the original authored document, the PhyDemo core or the published scene schema.

All four profiles use the same test-only `core.Session` with the existing original source, detector, mirror, interface and blocker observers plus native simulator/diagnostic callbacks. `seeded-off` disables the finite-hit advisory, `seeded-on` enables it, and `seeded-tap-blackhole` / `seeded-tap-archive` add one extra synchronous `finiteDiagnostic.beforeIncident` scalar-copy wrapper (same hot-path work, original diagnostic/native method delegated once). Blackhole discards its scalar array after terminal; archive persists actual native binary64 ray/hit points. These are **not byte-identical normal public `evaluateDocument` runs** because they share a common seeded test-only constructor, and neither instrumentation nor elapsed times are validated observer-neutral causal controls.

Each process retains actual native completed/failed/stopped status, errors, warnings, emitted/interaction counts, source fingerprint, first-event outcome if available, advisory/suppression and native test-only config hashes. Python's separate same-assistant `fractions.Fraction` exact reference recomputes represented-line t/u and guards only on the actual archived TAP callback scalars, preserving `UNKNOWN` and failed-run suppression. Duplicate event signatures are reported, not overcounted as distinct physical systems. A *green research workflow* requires 24 genuine process records and integrity/reference checks; some native optical trials may genuinely fail.

Reproduce from a clean exact research checkout after original PR #96 source ZIP extraction and native setup:
```sh
npm run setup
node scripts/build.mjs --test
node evaluation/fixed-native-rng-v1/run.mjs /path/to/original/pr96/inputs.json
python3 evaluation/fixed-native-rng-v1/exact-check.py
```

The new disposable Actions workflow downloads the original PR #96 artifact by run ID, verifies original input hash, keeps original and derived JSONs in an always-retained short-lived ZIP, and leaves all earlier failed native, CI and original ZIP data unmodified. This is same-author research until an actual separate Chat B R2 review. **PR must stay draft/unmerged**; no mandatory Stage-2 withholding, upstream optics patch, default native seed/physics change, schema extension, or production optical measurement withholding is permitted on this basis.
