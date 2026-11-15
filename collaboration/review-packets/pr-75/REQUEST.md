# Review packet: PR #75 — native detector-hit positions

**Status:** awaiting first independent Chat B review (no Chat B result is claimed).

- packetId: `pr-75`
- repository: `physicsvigilante/opticsim`
- PR: https://github.com/physicsvigilante/opticsim/pull/75
- baseSha: `c0d4e3048b9e0935cfd567e5f3c81aab23ddd823`
- headSha: `f4fddec213e04d733920399dc0eeea0b29a60dac`
- headBranch: `feature/native-detector-hit-events`
- current PR state at packet creation: **draft, open, unmerged**
- comparison: https://github.com/physicsvigilante/opticsim/compare/c0d4e3048b9e0935cfd567e5f3c81aab23ddd823...f4fddec213e04d733920399dc0eeea0b29a60dac

## Request

Independently inspect the implementation and evidence for opt-in `detector-hit-events`. Examine **the exact pinned head**, including the correction commit. This is NOT an invitation to merge PR #75.

Verify actual native `Detector.onRayIncident` event capture, exactly-once callback delegation, y-up coordinate conversion, direction and distance fields, count agreement, source/route non-attribution, bounded 32-event refusal, endpoint/numerical qualification, incomplete/stale suppression, hash/qualification handling, old count and power contracts, browser labeling, edits and export history. Seek counterexamples rather than only confirming the published positive fixtures.

## Required evidence and reproducibility

- Read `AGENTS.md` at the pinned head and the PR's source diff.
- Inspect `src/adapter.js`, `src/observables.js`, `src/native-observations.js`, CLI code, browser/readout code, test files and the relevant docs in the PR.
- GitHub full-CI workflow (corrected SHA): https://github.com/physicsvigilante/opticsim/actions/runs/43700823059 ; refraction: https://github.com/physicsvigilante/opticsim/actions/runs/43700823106
- Saved CI artifact SHA256: unified `a5c8aabdd042e045e0cb705fd1d3ba4513e2346857f1a5924ddc7aa432007b64`; browser `d3195058d580d7c804f42cd96ae4bd881dbf801c0a5302e0d1848b6ae6c13875`; refraction `cd5af714880910e23b0f5a6eda79e9e7b5f58015bef60c1da3067c32e6ab37d2`.
- Prior same-chat CI claims (726 Node tests, 8 detector browser checks, 17 exploration checks, eight existing refraction/composition browser suites) are **claims to verify**, not reviewer conclusions.

Check signed hit point/direction geometry independently for valid complete cases; compare negative cases (53-hit overflow, incomplete Fresnel, misses and invalid geometry) and ensure results cannot masquerade as detected images or inferred paired paths.

## Reviewer output

Use `collaboration/REVIEW-REPORT-TEMPLATE.md`. Post a review document via a separate review branch/PR under `collaboration/review-results/pr-75/` if GitHub write access permits; otherwise post a complete GitHub PR comment/review on PR #75 and return its direct link. Do not edit product source. Do not read Chat A's private implementation conversation. Mark findings as fresh from Chat B, not human independent physics certification.

After the review is posted, send the report GitHub link to Chat A so it can reconcile findings and request a second pass on a corrected SHA.
