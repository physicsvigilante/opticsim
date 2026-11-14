# Read-only evidence panel — teaching-pilot follow-up

## Scope and dependency

This is the separately approved presentation-only follow-up to the teacher-worksheet review of draft PR #54. It is based on `edbe728d5e50a8294ca88ef5d03f8e3284a2a5b3`; PR #54 itself and PR #53 remain unmerged. The new branch retains PR #54's plan and source fixture byte-for-byte. A PR targeting main includes that unmerged prerequisite until the prerequisite is integrated separately.

The evidence overview displays data that the qualified viewer already has. It does not calculate optics, modify a scene or request list, invoke the native simulator, change numerical sampling, alter qualified exports or infer source authenticity. The existing detailed results and limitations remain available. No scene/qualification schema, physics law, detector, engine pin or automatic camera policy changes.

## What the overview means

A completed, current result set can display:

> 3 native sampled readouts · 1 conditional prediction · 1 unavailable quantity

The unavailable quantity's ID and kind are named outside the capped scrolling detail panel. Zero and negative measured values remain values, not missing data. Qualified native results remain labelled as qualified by warnings. An observation count is not a count of physical light rays, a conditional prediction is not a detected image, and an unavailable requested quantity is not an answered one.

No-answer scenes explicitly say there are no requested readouts. During validation, native execution, incomplete or stopped runs, and asynchronous result checking, previous counts are not presented as current. The same sequence/revision guards that protect detailed results protect the summary. Raw scene imports clear source/history instead of inheriting the previously loaded package's qualification.

## Source and history

The overview exposes the existing author-recorded source case/path and full source SHA-256. These are literal text, not links or executable HTML. A digest establishes byte identity, not truth or independent review. Missing source records stay missing.

The latest physical and numerical changes are shown separately from presentation edits, with recorded before/after values. A later Fit must not conceal the last physical edit. Mixed physical/numerical records are selected by the actual field paths, not solely by the edit category. At most four fields from each selected edit are shown, with an explicit pointer to the retained package for additional changes or structured values.

Component labels use current IDs only when no structural or identity change since that history record could make the old array index ambiguous. Otherwise the recorded canonical path is displayed rather than inventing an old component identity. Invalid current input labels the displayed provenance as history of the last accepted scene.

## Prospective verification

The earlier PR #54 screenshots and raw reports are historical and remain unchanged. Its original optional-result test established retained structured data, not rendered discoverability. The updated browser test on this follow-up branch makes a stronger, separately evidenced claim only after measuring text-range rectangles against the viewport, scroll/clipping ancestors and sticky toolbar.

The existing teaching-pilot workflow is reused. It tests a 1440px desktop viewport and a 600px narrow viewport; visible source and hash; physical and numerical edit labels; unavailable quantity name outside an unscrolled detail panel; explicit scrolling to unavailable detail; invalidation; literal hostile-looking metadata; raw-import clearing; and export/reopen parity. A second invocation of the existing Fit after a focal edit checks that the conditional image coordinate falls inside the viewport without physical/numerical/result changes. It does not add automatic reframing.

Package comparisons check that viewing or scrolling the summary does not alter the complete qualified package. The original headless pilot checks and previously sealed source/plan hashes remain in the same CI workflow. Native rendering is used for screenshots; no synthetic ray overlays are introduced.

Run after normal project setup:

```sh
npm test
npm run build
node evaluation/teaching-fidelity-v1/run.mjs
node evaluation/teaching-fidelity-v1/browser.mjs
```

Use a fresh checkout/output directory; do not overwrite old evidence. CI preserves numerical reports, browser visibility geometry, screenshots and exports as a new artifact for its run.

## Claim limits

Passing DOM, geometry and browser checks establishes specified software behavior, not that a teacher noticed or understood the information. Teacher/student participants remain zero. Same-assistant visual inspection is provisional; educational effectiveness remains unassessed. No aggregate teaching/accuracy score is produced. Findings outside this narrow presentation change do not authorize new physics, authoring adapters, inference providers or public deployment.
