# Directional fan at one planar refracting interface

This local, test-only study uses the native directional source compiler and the J11 interface geometry. The synthetic point source sits 100 mm below a horizontal interface, with indices 1.5 below and 1 above. The upper cone edge is excluded by pinned PhyDemo’s deterministic sampling loop. The three fan runs produced eight actual emissions and eight interface callbacks.

| Signed incidences from upward normal | Observed native outcomes in increasing angle order | Study result |
|---|---|---|
| 0°, 15°, 30° | Transmission at all three angles | Passed |
| 41°, 50° | Transmission, total internal reflection | Passed |
| 32.810315°, 41.810315°, 50.810315° | Transmission, transmission, total internal reflection | Whole fan withheld at the middle sample |

The frozen protocol and tolerances are in [frozen-protocol.json](frozen-protocol.json). Its SHA-256 is `e4fb5230ca74bb1fdf4ddbec823224e0f5de6b0afaac72db3cf45e0a3bc0b91b`, recorded before execution. The runner checks the hash before launching any native control. The first harness attempt stopped before optical execution because Node skipped a nested test runner. Clearing the inherited test-runner context allowed the unchanged J11 controls to run in an isolated directory. The frozen cases and tolerances did not change.

Run from the repository root with the project dependencies installed:

```sh
node scripts/build.mjs --test
node --test research/refractive-fan-j11/study.test.mjs
```

Each completed attempt retains the unchanged twelve-case J11 replay, eight matched single-ray controls, three raw fan inputs and callback records, comparisons and a SHA-256 manifest under `test-artifacts/refractive-fan-j11/`. Six directions coincide with the historical J11 controls. Two supplemental single-ray controls cover the flanks of the critical-sample case. The critical callback is recorded as raw evidence, with its optical outcome withheld under the predeclared sine guard. Counts describe sampled directions in 2D. The study supplies no continuous escape fraction or observer-visibility measurement.
