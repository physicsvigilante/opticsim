# JEE coverage delta after PR177

This is a **same-assistant developmental follow-up**, not a new blind trial, independent interpretation grade or solved-question rate. It reuses the frozen 20-case source record from held PR165 and runs only the four cases whose relevant capabilities changed. The other 16 are retained as historical/limited records and are **not freshly rerun** here.

## Fixed identities and inputs

- Production baseline: `6295695483241620e17de1fd8df5e45abb80876d` (PR177 merge).
- Baseline tree: `df49aa4114479ac2462bfa67682b4c9b6ef3e37b`.
- Original trial: PR165 at `6a72bd67e58e9a3fd94a6bf33d88d1f20295b4c2`.
- Original source-review blob: `0a51f3bcdc708612b4846013e9c195f04c9150f0`.
- Original first-requests SHA-256: `c710e199e62d908bab418512423a546c673225a656cc96a84caa225cda31fa49`.

The existing source-review record was reread to plan this follow-up. No fresh visual interpretation is claimed; no Problems/Solutions images are opened by the replay. Neither PR165 nor any sealed first-attempt file is modified. `plan.json` was committed before the replay test or any execution of that test. The native examples are reused byte-for-byte and checked against their recorded Git blob hashes; changing a fixture fails the replay rather than quietly moving its input.

## The four deltas being checked

| Frozen case | Newly available capability | What remains unclaimed |
|---|---|---|
| J12: half-cylinder illumination | Public v21 native Beam plus true semicircular Glass section | Source omits radius, exterior index and continuous beam extent. The explicit finite illustration is not the full symbolic no-TIR condition. |
| J15: spherical-surface power | Standalone reviewed single-interface paraxial query using the stated indices and radius | Conditional +10/3 D and +40 cm image-side focal distance are not native image measurements or a second-surface model. |
| J16: bubble viewed through curved glass | Curved paraxial conjugate with explicit material inputs | Missing exterior index still rejects. Separately choosing exterior n=1 gives a conditional illustration, not repaired source facts, a physical eye or certified 3D apparent image. |
| J19: displaced second thin lens | Public v20 native finite parallel Beam through two independently centred ideal lenses | f=200 mm and d=2 mm, widths, apertures and detectors are numerical teaching choices. Native hits do not prove the full symbolic problem or detected image. |

For J12 and J19 the existing public problem CLI path creates a qualified portable scene, executes the unchanged pinned native core, and retains original request bytes/interpretation assumptions. The replay checks actual emissions and detector counts, refuses a missing essential field before native execution, and suppresses all requested measurements after a physical revision makes the old evidence stale. No custom ray calculation, manually selected hit or new native adapter is introduced.

For J15/J16 the standalone analytical CLI records input bytes, hashes, results and refusals. It remains **native:not-run**. The test never borrows native evidence from the illustrative cases to change that status.

## Scope and reproducibility

Only three new files: this protocol, `plan.json`, and `test/jee-post177-coverage-delta.test.mjs`. There is no production source, workflow, native pin, schema or historical-evidence change. Use the supported repository toolchain:

```sh
npm run setup
npm test
```

The existing test glob includes the replay. Each run reserves a fresh `test-artifacts/llm-authoring/jee-post177-coverage-delta-v1-*` directory and writes the exact plan, analytical/native input evidence, portable native packages, negative controls, stale suppressions and `report.json`. The existing `llm-authoring-evidence` CI artifact includes this directory; no extra workflow is added. A report is `passed` only when all six planned checks have recorded successful completion. That status means replay assertions passed, **not that 20 textbook questions were solved**.

Implementation of this test is not execution evidence. Results must be taken from the actual exact-head CI run and downloaded artifact. Node/native/Chrome CI is builder execution, not an independent reviewer replay or classroom-usefulness study.

## Remaining engine direction

The replay separates newly usable native apparatus from reduced mathematical outputs. It does not justify treating all remaining tasks as missing ray-tracing primitives. Image enumeration, graded-index propagation, reflected-branch prism inverses, multi-source coincidence inverses and physiological-eye models remain distinct topics; missing material indices remain missing facts.

The next **native-engine** investigation should stay close to the proven curved-boundary work: whether an explicitly authored finite curved entrance, internal passive observation and real absorption can become a safely validated public composition. PR177's raw closed-Glass witness is not that public contract. Any such feature must keep its real remote boundary, require all physical geometry/material values, preserve complete-run and stale-evidence gates, and undergo one consolidated physics/integration review before release. No such scope expansion is implemented or licensed by this evaluation.

There is no new independent-review interruption for this data/test-only follow-up. PR177's published independent review and metadata erratum remain historical records, not rewritten clearances.
