# Prospective first-look sample — eight JEE problems

This GPT-6 attempt used **eight previously unreviewed Problem PNGs** from the user-uploaded `08_Ray_Optics_Explanations.zip`. The original answers are preserved in [first-attempt.json](first-attempt.json), sealed at commit `af6fc5dd1ad2fbb2aa8260dc0c283df3a9abdf05` **before any corresponding Solutions PNG was viewed**. It is a prospective same-assistant development baseline, NOT an independent LLM call or blind fresh-model accuracy estimate.

The first attempt classified **3 as illustration-only** (F01 mirror strike, F03 double mirror reflection angle, F04 repeated images between two parallel mirrors) and **5 as unsupported** (projectile motion, observer geometry, moving mirror kinematics, curved mirrors and curved reflection with refraction). No unsupported physics was passed off as a native scene.

After committing first-attempt.json, we inspected exactly three corresponding **Solutions PNGs**, recorded in [post-solution-review.json](post-solution-review.json):

- **F01**: 4 cm incident spot matches the solution.
- **F03**: θ=60° agrees, but the initial answer only gave the net 120° direction change, not the key's *accumulated* 240° CCW (equivalent final orientation: 120° CW). Score as partial-convention omission, not full agreement.
- **F04**: the question asks distances for the *five nearest images*. Distinct images at distances **20, 60, 80, 80, 100 cm** are the five nearest by object-instance count. The provided answer key lists **20, 60, 80, 100, 140 cm**, omitting the duplicate 80 and using the first five *distinct distance values*—even though its own diagram shows the two different images at 80 cm. Keep this flagged as an ambiguity in the reference rather than silently marking either interpretation as automatically correct.

The five unsupported-classification cases remain **not independently adjudicated**; no corresponding solutions were opened. The test `test/prospective-eight.test.mjs` checks the two mirror geometry formulas and both image-counting interpretations deterministically, without inventing any ray paths.

The separate temporary image-inspection PR is never merged. Original ZIPs, upstream PhyDemo core and canonical authoring boundaries remain unchanged. Any independent LLM benchmark must use new, withheld inputs and an isolated model evaluation channel.
