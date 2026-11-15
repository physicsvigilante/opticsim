# PR #75 — targeted Chat B follow-up after report #1

**This is an additive request, not a replacement for the original review or its evidence.**

- Source PR: https://github.com/physicsvigilante/opticsim/pull/75
- Exact source head under review: `f4fddec213e04d733920399dc0eeea0b29a60dac`
- Exact source base: `c0d4e3048b9e0935cfd567e5f3c81aab23ddd823`
- Original separate-chat review: https://github.com/physicsvigilante/opticsim/pull/77
- Original report path: `collaboration/review-results/pr-75/review-chat-b.md` on review branch `review/pr-75-chat-b-20261115`; reviewer verdict **insufficient-evidence**
- Developer triage: https://github.com/physicsvigilante/opticsim/pull/77#issuecomment-6894596523
- Original review-protocol commit: `f67f8193d17f24035a896e59400c1e9f4cf2aa06` from draft PR #76 (published before the first review), **not yet merged to main**.

## G-01: resolve GitHub ref selection, without rewriting history

The reviewer correctly observed 404 for protocol/request/template on default `main` and the feature source head. That is expected while the documentation lives in the separate draft PR #76 branch, not proof that no published ref contained those instructions.

Read the *original unchanged documents* at the exact immutable `f67f8193...` commit:

- [Original REVIEW-PROTOCOL.md](https://github.com/physicsvigilante/opticsim/blob/f67f8193d17f24035a896e59400c1e9f4cf2aa06/collaboration/REVIEW-PROTOCOL.md)
- [Original REQUEST.md](https://github.com/physicsvigilante/opticsim/blob/f67f8193d17f24035a896e59400c1e9f4cf2aa06/collaboration/review-packets/pr-75/REQUEST.md)
- [Original REVIEW-REPORT-TEMPLATE.md](https://github.com/physicsvigilante/opticsim/blob/f67f8193d17f24035a896e59400c1e9f4cf2aa06/collaboration/REVIEW-REPORT-TEMPLATE.md)

Mark protocol conformance only after reading and comparing them; preserve the initial report's 404 observation exactly.

## E-02: narrow adversarial evidence gap

The first review found no demonstrated production defect. Do not conduct another general-purpose prose review unless a concrete test exposes an issue.

The reviewer should author **novel test-only controls** and submit them on a separate branch rooted at the **exact source head `f4fddec...`**, without modifying any Opticsim production file or original fixtures. GitHub CI on that branch/PR can execute tests when the chat's local runtime is blocked. Include a before/after Git tree comparison proving only test/evidence files were added. If a test fails, preserve the failure and report a reproducible counterexample rather than relaxing an assertion.

Prioritized physical cases:

1. Actual pinned native detector with reversed orientation and/or 0.009 mm vs 0.011 mm endpoint clearance. Distinguish admission rejection from measurement qualification; specify exact ray and segment geometry and confirm native status and observations.
2. Two disjoint explicitly authored detectors: one has more than 32 actual crossings, the other remains within limit; verify per-detector overflow does not suppress the other's complete available event list, and old counts remain correct.
3. One representative in-flight asynchronous revision, native failed callback, or incoming-ray/point inconsistency control; verify stale, failed or unqualified observations are withheld. Use existing source contracts, not invented callbacks described as native results.

The tester may choose different fully specified synthetic geometries if a requested combination is outside existing component scope. Report any untestable condition explicitly. Do not claim a separate-chat new native execution solely from rechecking saved CI files. Record new test source SHA, GitHub Actions run/job IDs, resulting source-tree equivalence for all production files, test outcomes and any artifacts.

If desired, write the new tests in an isolated `test/*.test.mjs` file only, keeping the existing feature branch unchanged. Do not use PR #64 experimental intersection formulas or alter pinned PhyDemo.

## Other findings

- H-03: explicitly record that `evaluateObservables` accepts *trusted internal native-executor evidence*, not cryptographically authenticated externally supplied runs. No public JSON injection route was demonstrated. External result ingestion, if ever added, requires a separate contract and evidence authentication.
- U-04 and O-05: deferred optional UX/capture-granularity ideas, not release blockers.
- Do **not** merge PR #75, PR #76, PR #77 or any test-only branch.

## Output / stop rule

Create an **additional** `collaboration/review-results/pr-75/review-chat-b-02.md` on the existing separate Chat B review branch/PR #77, or post a new GitHub comment there if file writes fail. Do not overwrite `review-chat-b.md`. Conclude `pass`, `changes-requested`, or `insufficient-evidence`, with separate statuses for procedure, new native coverage and trust-boundary scope. No need to re-review unchanged code in full: focus only on what the original report could not verify and on novel failures. If PR #75 head moved, stop and identify stale-head.
