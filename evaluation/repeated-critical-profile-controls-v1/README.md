# PR97 — repeated critical native outcome controls (test-only)

This branch intentionally carries **no production physics changes**. Its exact physical scene input is not reconstructed or tuned: the standalone research action downloads the **original independently reviewed PR96 source artifact** [run 43872962563](https://github.com/physicsvigilante/opticsim/actions/runs/43872962563/artifacts/14229080814), checks the immutable `inputs.json` SHA256 `caa07af040d0a71b50ea6b69470aa55a545b04d52195994913123a902b434df3`, size 19,205 bytes, and reuses its two original fully authored `critical-shift-neg` and `critical-tilt-p14-shift` schema-v9 documents **byte-for-byte**. The original inputs file is copied to a new output folder unchanged. No data from original PR #96 is overwritten.

**Preregistration** was committed before any new native run; see [PROTOCOL.md](PROTOCOL.md), finalized at `c32c2e1ffbe849a54416df2ce25775cc746ea39d`. Node 24.19.0, unchanged main `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518`, pinned unmodified PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`. Fixed seed `0x9700A55`, two original nominal-critical cases, six randomized balanced 4-profile blocks per case, **48 fresh Node-process runs** with 12 runs of each profile.

The distinct profiles are **ordinary-off**, **ordinary-on**, **tap-blackhole**, **tap-archive**. Both TAP modes add exactly one synchronous `finiteDiagnostic.beforeIncident` method wrapper, clone and retain the *same type and number* of native callback scalar copies **during** simulation, and invoke the existing owner/original once; `tap-blackhole` discards copied scalars after the native terminal event while `tap-archive` records them for the exact reference. They are **hot-path-copy-work matched, not wall-clock overhead matched**, not equivalent to ordinary native ON, and not a causal same-event observer control. Changes in mode frequencies or even per-run elapsed times do not establish that diagnostics cause the difference.

Each genuine native subprocess returns its actual status/error, per-case source fingerprints, native interaction counts and opt-in advisor state. Real native failures, even those with early valid callbacks, remain **FAILED**. Python's distinct same-assistant Fraction implementation checks all captured `tap-archive` event classifications, distinct full recorded-binary64 hit signatures and original failed-run contribution without fabricating a safe point discrepancy bound. Unknown/vertex guard remains UNKNOWN, not clean. No mathematically definite critical-angle branch is asserted.

Local operation after source checkout, native setup and fresh original PR96 `inputs.json` extraction:

```sh
npm run setup
node scripts/build.mjs --test
node evaluation/repeated-critical-profile-controls-v1/run.mjs /path/to/original/pr96/inputs.json
python3 evaluation/repeated-critical-profile-controls-v1/exact-check.py
```

The workflow uses `actions:read` to retrieve and hash-check the original evidence and uploads `inputs.json`, `report.json`, `exact-reference.json` even if some step fails. Original GitHub artifacts expire; preserve their bytes, hashes and prior failed attempts. The source `src/`, native optics, native solver thresholds, scene schema, canonical measurements, UI and Stage-2 withholding remain untouched. **Keep PR97 DRAFT and UNMERGED, including its disposable CI.** Require independent Chat B R2 numerical research/evidence review after exact-head CI; stronger physics claims or measurement policy need a separate owner-reviewed implementation.
