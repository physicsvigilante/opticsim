# Opticsim — cross-family teacher task readiness pilot

**Purpose:** prepare and software-check three authentic *already exposed* repository scenes as a teaching accompaniment. This is not an original exam-question solution, new optical solver, new LLM evaluation, or evidence of classroom learning. [Tracking issue #101](https://github.com/physicsvigilante/opticsim/issues/101).

The [source and task plan](PLAN.json) and [human worksheet](TEACHER-WORKSHEET.md) were committed in this research branch before executing the native/browser checks, preserving exact source fixture Git blobs at base main `50dd0f4d9530d0a61bb4c7064c4326a8ac0ce518` and pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`. These are **source-exposed repository fixtures**, so matching them is **not** an unfamiliar LLM source-interpretation test. There is no answer key. All what-if values are explicitly teacher-chosen, never silently inferred from the source.

| Family | Original fixture | Existing readouts | Classroom what-if (physics) |
| --- | --- | --- | --- |
| Ideal lens + detector | `scenes/single-lens-detector.json` | Conditional ideal image; native sampled emissions, crossings and relative signed power | `lens-1.focalLength: 100 → 150 mm` |
| Plane mirror + detector | `scenes/plane-mirror-detector.json` | Conditional virtual image; native sampled reflections, emissions and detector crossings | `source-1.y: 30 → 40 mm` |
| Convex finite glass + detector | `scenes/polygon-dielectric.json` | Native bounded face/first encounter, emissions, crossings; opt-in **noncertifying** finite-hit advisory; unsupported ideal image remains unavailable | `S1.directionDeg: 0 → 5 degrees` |

The native engine owns each accepted revision and diagnostic. Each runner scenario contains the **original source**, an independent **scene-only / no answer target** native execution, the source **baseline with requested observations**, and a **what-if** recorded as precisely one qualified *physics edit*. No old source fixture is overwritten. Every accepted scenario writes its native report, requested-result status, canonical scene, original source provenance, and *portable, hash-verified* qualified package. The physical baseline and numerical sampling remain distinct. Non-certifying advisory and unavailable observations never become verified physical rays.

## Reproduce the software checks

Use Node 24.19 and the repository's pinned native core. From a fresh checkout:

```sh
npm run setup
node scripts/build.mjs --test
node evaluation/teaching-cross-family-v1/run.mjs
npm run build
node evaluation/teaching-cross-family-v1/browser.mjs
```

The first runner uses a **new** ignored `test-artifacts/llm-authoring/teaching-cross-family-v1/` directory; an existing directory, even from a failed first attempt, cannot be overwritten. Original source bytes, plan bytes, qualified packages and native/readout status are retained per case, along with `report.json` and `summary.md`. Tests check source Git blob identities, full scene/no-answer parity, complete native execution or honest failure, source hash guards, precise physical edit history, numeric policy stability, typed native-versus-conditional-versus-advisory-versus-unavailable results, and qualified round trips.

The separate **real Chrome** test imports all three families, inspects actual evidence labels, uses the existing **Fit apparatus and requested results** action, performs each physical what-if through actual browser inputs, exports/reopens qualified packages, reopens original baselines, resets provenance on raw scene import, and preserves screenshots + `browser/report.json`. It checks browser software behavior only, not whether a real teacher can learn from it. A missing Chrome or failed native operation is **NOT PASSED** and should be recorded, not hidden.

A standalone **temporary Actions workflow** permits exact-head CI on the research draft and uploads unmodified evidence on test failure. It must be removed before any eventual production merge; no permanent CI burden or new browser/network dependency is needed.

## Human follow-up — not executed by software

Ask **two actual consenting teachers** to complete the [blank worksheet](TEACHER-WORKSHEET.md) when available. Do not write participant names, personal data, private comments or ratings into public GitHub or CI. For each case, record independently: completed unaided / with guidance / not completed / not assessed, source-versus-hypothetical distinction, observed/native-versus-conditional-versus-unknown comprehension, and UI friction or misconceptions. Keep software failures separate from confusing educational presentation. Until such real participation, **teacherParticipants=0**, **studentParticipants=0**, **educational usefulness=NOT ASSESSED**; no fake score can be inferred from a green CI or screenshots.

## Strict scope

No new LLM provider, new authoring schema or native optical object, no altered PhyDemo numerical behavior, native RNG default or cutoff, no Stage-2 withholding, no copied PR #92–#99 near-critical research result treated as physically valid, no source textbook-answer completeness target, no production UI change or public deployment. If the teacher task reveals confusion, propose the smallest reusable correction supported by actual evidence; do not build an exam-specific solution path.
