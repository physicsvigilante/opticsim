# Opticsim v40 Comprehensive Independent Audit Package (2026-11-27)

> **Status:** Provisionally accepted by Repository Owner for independent examination by ChatGPT Adviser. Gate 1 hardening is **not yet authorized**.

## Frozen Audit Baseline & Provenance

- **Target Repository:** `https://github.com/physicsvigilante/opticsim`
- **Audit Commit:** `0c758d7817ac68dffd5936e25109520b7f99f720` (parent of this audit branch; `main` untouched)
- **Audit Tree:** `d103cd993df5c74052309ec74f7cdacb925b58ef`
- **Pinned PhyDemo Upstream:** `811f508d2b070898c241a568b0c167dcb8645251` (`upstream-pin.json` blob `c371abf2169bba28b1c400d022b55caf78cb647c`; vendor tree `4e352c91dc445c471ee126ec5214bb9d2d3df0b7`)
- **Reproducibly Built `dist/test-core.cjs` SHA-256:** `f54ecaac2cdb6da7f7c43f0b035d6020c64feabaae68a8a675c424aa99caa122` (1,198 modules, bit-for-bit identical across original checkout and all isolated worktrees)
- **Governance Framework:** `https://github.com/physicsvigilante/multiagent` v0.2 @ `dd091fed2c1efdc398ec1c8124283e374f029e55`
- **Active Independent Investigators:** `neon-auditor` (`gemini-4-neon-high`) and `neon-auditor-2` (`gemini-4-neon-medium`)
- **Independence Classification:** `non-author`, `brief-only fresh session`, **`same-model, separate participant`** (cross-family model diversity was lost after `opus-auditor` [`claude-opus-5-5-medium`] hit third-party quota `RESOURCE_EXHAUSTED (429)` during Phase 1 and was discontinued by Owner Mandate Amendment; its partial notes remain preserved separately in `preserved-opus-partial/opus-partial-record.md` and were strictly withheld from active investigators)
- **Procedural Coordinator Disclosure:** `coordinator` (`gemini-4-neon-high`) has builder-context exposure from prior PRs #260–#276 and acted strictly as procedural coordinator without scientific verdict authority.

## Reproducing All 12 Experimental Scripts

From a clean checkout of `0c758d7817ac68dffd5936e25109520b7f99f720` (or this audit branch, whose optical engine and source tree are byte-identical to `0c758d7817ac68dffd5936e25109520b7f99f720`):

```bash
npm run setup
node scripts/build.mjs --test
# Run any archived experiment from the repository root:
node audit-records/v40-independent-audit-2026-11-27/experiments/neon-auditor-phase1/exp1-physics-adversarial.mjs
node audit-records/v40-independent-audit-2026-11-27/experiments/neon-auditor-2-phase1/exp1_audit.mjs
node audit-records/v40-independent-audit-2026-11-27/experiments/phase2-3/exp5_cross_verify.mjs
node audit-records/v40-independent-audit-2026-11-27/experiments/phase2-3/exp6-phase2-probes.mjs
```

## Sanitization & Hash Provenance Manifest

Before publication, local Windows machine paths and user-profile directories were replaced deterministically with canonical placeholders (`<LOCAL_REPO_ROOT>`, `<WORKTREE_NEON_AUDITOR>`, `<WORKTREE_NEON_AUDITOR_2>`, `<WORKTREE_OPUS_AUDITOR>`, `<LOCAL_AUDIT_PACKAGE>`, `<LOCAL_SCRATCH_NEON_AUDITOR>`, `<LOCAL_SCRATCH_NEON_AUDITOR_2>`, `<LOCAL_SCRATCH_OPUS_AUDITOR>`). No credentials, secrets, emails, or personal identifiers were present (verified `0` hits across all 21 files). No scientific text, numerical measurements, code line references, or verdicts were altered. Eleven Phase 1/2 `.mjs` scripts had their hardcoded local worktree root replaced with `process.env.OPTICSIM_ROOT || process.cwd()` (plus `pathToFileURL` where needed) so every script executes reproducibly on any checkout of `0c758d7817ac68dffd5936e25109520b7f99f720`.

Both **Original Local Pre-Sanitization SHA-256** (including exact Phase 1 blind commitment hashes posted on the Swarm board prior to reveal) and **Published Sanitized SHA-256** are preserved below:

| File | Original Local Pre-Sanitization SHA-256 | Published Sanitized SHA-256 | Bytes (Orig -> Pub) |
| --- | --- | --- | --- |
| `report-a-vision-architecture.md` | `56f6680bc523eeb53f1f9d8c1e347598592efdf01521b116d5437dc572841aa0` | `15eae67eb52e2093b73e152532bd4e7f0ae4de681dcfc8b8a15d038debb5c276` | 19761 -> 19768 |
| `report-b-adversarial-error-audit.md` | `d0eb8b3fba424ead50ce4c6d8214f12bb4789cd358790ece4592b2ba99db4b30` | `8f6515efe8caf25134954d0950e632148e5b02510a5a19c81c2774fe3b1d8c68` | 27577 -> 27584 |
| `report-c-strategic-decision-memo.md` | `2610dd8d5818ed2ba0b52bb38c2d93e1bd13bcae8869a878f868feadf535d7c4` | `ce305e5038a472ba918062f73ad093f49c6491eb8b816098f8a8150ad1cdd4f2` | 11184 -> 11191 |
| `supporting-records.md` | `f17a6be8339e2160a6ccf43b3854e15f42211205b6f9fe373ecc9dc5d074137e` | `bd53fff95aeb2681698d99b18188cb9cc3d3e0a96cabaf8b8be2d7d68d9ff29b` | 17368 -> 17235 |
| `board-transcript.md` | `6aed1b086700084d016e9c946ed7a446ed433ccf6ef943d0d1319d088828c18b` | `eb304520f8414803ee2cf3932ab24a927b43e9ea5e0c09797533f6f2d5fce886` | 66391 -> 65302 |
| `milestone-packet.md` | `77c9f04fd3c9a57f1a164320013a64dfd43636aeaa435cf9aa83082562467522` | `ecec8db894d42e576acac338d069ea7e07cc2aab35acdd30f8eb4d06d6fe889c` | 22576 -> 22212 |
| `phase1-reports/neon-auditor-phase1.md` | `cd51340c2ccbe46ee2afee835bb8a2ff53cf59c934cf715d9fcd40e27d3edab3` | `97c2ecb9e3025273d774236ce0ce5ac3c2acd7db34539b8910d26ac947f8406c` | 57492 -> 57333 |
| `phase1-reports/neon-auditor-2-phase1.md` | `3f00ea7dee300f5f6a700c5da460f67d46d448db0a419d4e687abefea1eeabca` | `508dce13e135b10108b909b13de7909c296f6f735bd56e4f9362b52f44fcb473` | 41480 -> 41323 |
| `preserved-opus-partial/opus-partial-record.md` | `5dbc0d8ce548221f88b267d329b60a43a4e9d4f7479df715934e0799eebeb044` | `69031608d201d01208e8c44829615a247ccacdd7ed179242431a351cc549a2c5` | 2971 -> 2812 |
| `experiments/neon-auditor-phase1/exp1-physics-adversarial.mjs` | `0ed4d756c36630111cc4cad81909e4ec758ff60d349c558cd230e806fadb4cde` | `a1ed937287353bd4c80638a720aa5ba2144b5dcef3b16a6b57d5778a3059e1d7` | 34158 -> 34089 |
| `experiments/neon-auditor-phase1/exp2-deep-probes.mjs` | `d50913dd58dd6bf4143f216228ae7d34e0be8f9db4ed23e3088be1f22953be0a` | `18b5f4f00890eea862ec03ba195f194fb4b748c688c2db399aabb0df4a027d69` | 25176 -> 25107 |
| `experiments/neon-auditor-phase1/exp3-more-audits.mjs` | `8eb7dbb2ad1be461010d9e71ca65368f0be25d13c0916922584e3443096d3b4f` | `5fee5f40b5fe1e6574f799258f8500c04a9a80e7b2ba4e297f79bbabf67fc6a5` | 18923 -> 18854 |
| `experiments/neon-auditor-phase1/exp4-verify-more.mjs` | `c9cb0251a805d828bebc74216ae153fd51b9266960d1079b3acec83ec65d76e3` | `6d290d8679a790692e5e74c5f1c18ac44f5067581c1cf84314b21fd9814ea099` | 8439 -> 8370 |
| `experiments/neon-auditor-phase1/exp5-edge-cases.mjs` | `ef367cc956e4455536d0e811b8f776c7ac2f7f13c910e1d8e47955bcfac2b6d5` | `5ca767bb445c9cc81f65901be3d909c413f1938712a6aa2a8e46ba6d6efb5be3` | 11583 -> 11514 |
| `experiments/neon-auditor-phase1/exp5b-edge-cases.mjs` | `7a807d009e49e76757eaf7bb3c20c27188337e414599544250120e6722478f8b` | `3db195605b1ab795f2bb1f103d2c45b2902c8689bcb60f2667ce9eda4224ee63` | 11100 -> 11031 |
| `experiments/neon-auditor-2-phase1/exp1_audit.mjs` | `afc846e46260ec97587551616191aaf5bfbff0faf97a21a875c8dcde09ca2cd2` | `73b2e2896f28f3f3e621adf5f957e425a795ad9d5cdd2d628b101cda0b48385e` | 27005 -> 27044 |
| `experiments/neon-auditor-2-phase1/exp2_audit.mjs` | `31afe53dd1df8d7922facc8f38c54b2df45ac0e7d46d547ff1a1628c41a572f0` | `0f55ee859017be0bb8a6052819d6b2075b58cb41945b87fc69493808e1ab9edf` | 19274 -> 19313 |
| `experiments/neon-auditor-2-phase1/exp3_audit.mjs` | `dc7ee1ac776f6002bf7611f097a924842d774a04bb4f92e77ef3c4776f1db083` | `9b0c66b234c6d70465f3385640e946ebbe775171c845acc658131d85a23d485f` | 9059 -> 9112 |
| `experiments/neon-auditor-2-phase1/exp4_audit.mjs` | `2f8c0b5f9320922638741ca8bb2113ac555209d2e2dc51c7e3a31bec7f75435d` | `e1df1e8c79cf15f6fcf14ad523a6ee0e165989d770a6d515c1ec76847b52d91a` | 7735 -> 7760 |
| `experiments/phase2-3/exp5_cross_verify.mjs` | `9aa923b3f09aa03c0bc692c48fcb053bd2088305fec702fef6289a24e2b4ede2` | `90fc5962a0fe2676231eab126b72eda00c77fff4b7606025fec10e83fc1c0a61` | 5289 -> 5342 |
| `experiments/phase2-3/exp6-phase2-probes.mjs` | `5d365c59851b4607185040f298bd8002e612965258dfacd1bb52ac5118b9c997` | `5d365c59851b4607185040f298bd8002e612965258dfacd1bb52ac5118b9c997` | 19326 -> 19326 |

