# PR99 — Second pinned-PhyDemo native RNG seed, same original Glass scene

**DRAFT research only — no optics, source-schema, native solver, detector, numerical cutoff, default seed, Stage-1 measurement or Stage-2 policy change.** This experiment follows the [independent Chat B R2 PR98 PASS](https://github.com/physicsvigilante/review_sandbox/blob/main/projects/opticsim/pr-98/reviews/review-01-chat-b.md) and its narrow recommendation to test a **second different fixed PhyDemo RNG seed**.

The [frozen protocol](PROTOCOL.md) was committed at `77d9b618f0d84ffc45e905c3dc701f992c5660c0`, **before any PR99 new native execution**. Preserve original production baseline `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518`, native pin `811f508d2b070898c241a568b0c167dcb8645251`, and original PR96 physical `critical-shift-neg` schema-v9 source `serializeSave` SHA256 `4389fecfe80ad01fa7cb160f22319327ccf9e30bb35c211012cc15599ff422c6`. The **entire original PR96 inputs.json**, 19,205 bytes SHA256 `caa07af040d0a71b50ea6b69470aa55a545b04d52195994913123a902b434df3`, is reused without reauthoring. This is a synthetic nominal critical configuration, not a physically certified exact critical-angle ray branch.

PR98 original native seed `opticsim-fixed-native-seed-v1-20261116` yielded **24 genuine failed native traces**. PR99 changes **only test-only copied native config `randomSeed`** to a new predeclared `opticsim-fixed-native-seed-v2-20261116` while holding the authored scene and normal compiled unseeded native JSON SHA256 `e74e1452bd26402a94b9e0748be38ce8a0720274e5910b68bc65634a72bec1b7` unchanged. The original production `core.compile`, `core.loadNative`, Stage-1 diagnostic, observers and pinned simulator are used unchanged. Loaded scene seed is checked, not sampled, before simulation. As in PR98, this is a **test-only shared seeded Session constructor**, not byte-identical public `evaluateDocument`.

Exactly **24 new Node 24 native subprocesses**, six balanced blocks of the **same four mode order and schedule seed `0x9800A55`** used by PR98: `seeded-off`, `seeded-on`, `seeded-tap-blackhole`, `seeded-tap-archive`. The two TAP modes add identical per-callback diagnostic-method scalar copies, original Glass owner delegated once; TAP archive saves original scalar points only after simulation. A separately authored Python Fraction checker repeats represented IEEE754 exact finite-face classifications on actual second-seed TAP archive events, retaining UNKNOWN and failed-run suppression. A separate JS test validates original PR98 report SHA256 `b9ea7eb4366fddfd3dcdaf9e8ac6f475e04804bec54b696fbd93eda3814511f2`, compares original PR98 and new PR99 **24 scheduled positions**, original source and unseeded native config hashes and records descriptive native status/fingerprint changes. The old first-seed PR98 evidence is **never** modified or relabeled.

A native failure is a real native failure regardless of green research-integrity CI. A second native seed may or may not lead to a changed native outcome. Neither case establishes observer causation, uninstrumented same-event counterfactual, global RNG determinism, an ideal critical mathematical branch, correctness of complete optical tracing or a valid reported-point tolerance. Original PR97 near-critical trials also had uncontrolled native time-derived seeds; comparing two fixed seeds cannot fully explain all that variability.

Reproduce on the research branch with fresh extracted original PR96 and PR98 artifacts:

```sh
npm run setup
node scripts/build.mjs --test
node evaluation/second-native-rng-v1/run.mjs /path/to/original-pr96/inputs.json
python3 evaluation/second-native-rng-v1/exact-check.py
node evaluation/second-native-rng-v1/compare.mjs /path/to/original-pr98/report.json test-artifacts/llm-authoring/second-native-rng-v1/report.json test-artifacts/llm-authoring/second-native-rng-v1/comparison.json
```

The disposable workflow downloads both original GitHub Actions artifacts with read-only permission and uploads original and new reports on success/failure for historical integrity. All prior PRs, failed CI, failed native traces and raw artifacts remain intact. **Do not merge the PR or its disposable workflow into production**. Seek separate Chat B R2 research-only numerical review before relying on new results; production numerical fixes or Stage-2 qualification require independent physics design, broader native/browser tests and explicit owner approval.
