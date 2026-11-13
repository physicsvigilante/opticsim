# Atlas verification evidence and limits

The Atlas baseline is Opticsim main `52accb717b10b75792a484b8a8c6b285c5770e59`. The source archive `08_Ray_Optics_Explanations.zip` is fixed to public Git commit `d33b45226348d9b0c701f2a3e8b86dd1285de2d0` and SHA-256 `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`.

The [Problems-only source verification run 43428781608](https://github.com/physicsvigilante/opticsim/actions/runs/43428781608) first verified the **complete original archive SHA-256** and enumerated **114 /Problems PNG files in eight chapters**, then passed the same repository's `evaluation/optical-systems-atlas-v1/check.mjs --archive` against the original ZIP. The script verified **40/40** reviewed image SHA-256 values, not just the directory names; no Solutions member was opened.

The [seven-day evidence artifact 14038528828](https://github.com/physicsvigilante/opticsim/actions/runs/43428781608/artifacts/14038528828) contains `atlas-image-check.json`, `problem-inventory.json` and a filtered `problems-only.zip` with **Problems only**. Its GitHub Actions upload digest is SHA-256 `3d89a19db5b7a53ab4a4b0b30e230d328ab02e296119635913ecf126f71bcd9a`. The original full ZIP and Solutions are **not** included in that artifact. The one-off branch-only workflow that produced it was removed before the review PR was opened.

Reproduce without images using `node evaluation/optical-systems-atlas-v1/check.mjs`; this checks the eight chapter counts, deterministic selection, 114 status flags, 40 source image digests as metadata, per-case scope tags, published summary counts, and claimed source provenance. For a live digest check on your own archive use the explicit `--archive` option in the [README](README.md).

This provenance check does not verify the JEE answers or certify that the assistant interpreted each question correctly. The 40 reviewed images were classified visually by the same assistant, and the remaining 74 were **not visually interpreted**. Selection can overlap cases already seen in earlier studies. No independent LLM, human adjudicator or original-question numerical score is represented.

New *pinned-native class* audit tests run on the unchanged upstream checkout, to confirm only that classes exist and that blocker ray incidents absorb rays; they do **not** represent newly implemented Opticsim components.
