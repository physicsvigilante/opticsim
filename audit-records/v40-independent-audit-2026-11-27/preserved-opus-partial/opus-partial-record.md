# Preserved Partial Record — Discontinued Participant `opus-auditor`

> **Access control:** Strictly private to Coordinator and Human Owner. **NEVER** expose to `neon-auditor` or any replacement investigator before Phase 1 commitments (and kept strictly separate from the active roster's independent investigation).

- **Participant:** `opus-auditor` (`claude-opus-5-5-medium`)
- **Conversation ID:** `17192582-4350-4d29-b1d2-6323ed2a3090`
- **Status:** Discontinued & `excluded` per Owner Mandate Amendment (`2026-11-28 00:06 IST`) after provider quota error `RESOURCE_EXHAUSTED (code 429)` at `2026-11-27T18:29:29Z`. Parked in `waiting` state (`killed: false`; zero token cost; workspace preserved untouched without destructive deletion).
- **Verified Executed Model Telemetry (`transcript.jsonl`, lines 1–81):** Every `PLANNER_RESPONSE` step (steps 2–79) recorded `"model": "claude-opus-5-5-medium"`.
- **Worktree Binding:** `<WORKTREE_OPUS_AUDITOR>` (`HEAD = 0c758d7817ac68dffd5936e25109520b7f99f720`, `tree = d103cd993df5c74052309ec74f7cdacb925b58ef`, clean, 0 reparse points; reproducibly built `dist/test-core.cjs` `SHA-256 = f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122`).
- **Preserved Scratch Scripts (`<LOCAL_SCRATCH_OPUS_AUDITOR>\`):**
  - `h.mjs`: Shared read-only harness + independent y-up Snell/reflection reference helpers.
  - `e00-smoke.mjs`: Smoke test on single-ray slab + detector (exact match to analytical refraction).
  - `e01-fuzz.mjs`: Independent ray-tracer fuzz oracle across disjoint polygon/triangle/circle dielectrics, ideal lenses, plane mirrors, detectors, single-ray sources, and varied ambient `backgroundIndex` (`1` and `1.33`).
    - Executed seeds 1 (`N=120`), 2 (`N=300`), 3 (`N=300`) = `720` generated scenes (`700` compared, `18` cleanly rejected by admission geometry/endpoint guards, `2` cleanly withheld fail-closed on `maxRayDepth` truncation, **`0` mismatches**, `maxErr = 6.73e-10 mm`).
  - `e02-fuzz.mjs`: Written (`23:59:27 IST`), **not executed** before `429` quota cutoff (`23:59:29 IST`) — extended region-membership oracle targeting spherical lenses, circular caps, circular-arc mirrors, beam splitters, blockers, touching layers, flush silvered mirrors, and interior sources.
- **Preserved Notes from Transcript (uncommitted / partial only — NOT a completed Phase 1 report):**
  - Flagged Antigravity `workspace: "branch"` sharing `git-common-dir = <LOCAL_REPO_ROOT>/.git` (worktree rather than detached clone).
  - Noted repository sprawl (`1,087` tracked files; `132` `src/`, `130` `scripts/`, `123` `docs/`, `326` `test/`; `README.md` catalog accretion).
  - Verified native physics agreement on 700 randomized disjoint compositions (`0` mismatches, `<= 6.73e-10 mm`).
  - No formal Phase 1 report was written or committed.
