# Numerical ray reliability: native weak-branch and critical-angle audit

This milestone adds an **opt-in diagnostic comparison**, not a changed physical model,
automatic repair, complete solution of B05/B06, or a new canonical run setting.
The pinned simulator and all original scene schemas are untouched.

## Why

The two original Problems images in PR #20 show different failure mechanisms:

- **B06:** The reflected ray needed to determine an outgoing angle carries
  approximately 0.001497 relative brightness. PhyDemo's native default-color
  branch cutoff is **0.01**; its default path discards that branch, then the
  requested measurements are properly suppressed because native truncation is
  nonzero.
- **B05:** At the separately derived exact critical input, a nearly tangent
  outgoing ray is followed by additional native encounters and depth truncation.
  Four nearby angular-only samples complete. The exact numerical mechanism has
  not yet been isolated. This is not missing physical information in B05.

Pinned PhyDemo v5.4.0's BaseGlass.js uses the supported native
**colorMode** property to determine reflected-ray retention:
**0.01** in default mode versus **1e-6** in non-default modes.
The source also changes the threshold for retaining transmitted primary rays.
Its Scene.js supports both default and linear with simulateColors=false.
**This is an upstream numerical-semantic difference, not merely appearance.**

## Bounded diagnostic, not implicit fallback

The nativeNumericalReplay function accepts a validated v5 planar-media scene,
the pinned built native core and an explicit mode: **default** or **linear**.
Only on a newly loaded native Scene instance does it select that mode.
It does not change the canonical scene, source brightness, Fresnel policy,
numerical budgets, ray paths, core code or the upstream cutoff.

Evidence records the unchanged canonical scene and explicit native setting
alongside native status, truncation and bounded interface observations.
The comparison is never relabelled as canonical execution or as the original
default setting. Even under an explicit alternative mode, incomplete/stopped
runs still withhold final requested values. Native events from incomplete
runs remain **partial diagnostics**, not established question answers.

This is a same-assistant pinned native development probe, not blind or
independent evaluation. B05's probe angles are externally derived and are
not evidence of a native inverse solver.

## Run locally

After the usual project setup:

~~~sh
npm run setup
npm test
node scripts/numerical-reliability-audit.mjs
~~~

The runner writes to a fresh test-artifacts/llm-authoring/numerical-reliability
directory, or to a different explicitly supplied fresh directory under
test-artifacts/llm-authoring. Previous output is never overwritten.
Original first-attempt input bytes and independent mode records are preserved.

## Completion criteria and outstanding decisions

1. The default replay agrees with canonical B06 native observations, and
   explicit linear mode retains the required weak reflected branch, as
   verified by actual downstream interface interaction.
2. No authored input mutation or automatic mode substitution. Native
   settings and first encounters are recorded separately by variant.
3. B05 near/at/above critical incidence is compared for native encounters,
   truncation, mode dependence and missing transmitted branches.
4. **Do not promote linear to a production default** without wider studies
   of general scenes, detector power, browser parity, convergence, limits
   and upstream revision effects.
5. No per-observable completeness exemption or inverse solver is introduced
   by this diagnostic. Such features require separate justification.

A low-energy ray may be the *only* branch needed to answer the user's
question. Retaining numerical fidelity is distinct from measuring energy.

## Reproduced native results

These values come from the pinned native simulator on the two already reviewed
original problems, not from new blind model inference.

| Probe | Native default | Native linear |
|---|---|---|
| B06 full Fresnel, unchanged original scene | Incomplete; I12 reflected branch dropped; air interface has 0 interactions; truncation 0.0048077301 | Incomplete; required I12 reflection retained and air interface reached 3 times; truncation about 0.0000707941 |
| B06 I12 Fresnel retained; partial reflections elsewhere explicitly omitted | Incomplete; required reflected branch dropped | Completed: I12 reflection retained, air interface reached; theta4 about 26.63311875 deg and theta5 about 40.54160187 deg |
| B05 exact externally derived critical angle, both partial-reflection policies off | Incomplete, truncated relative brightness 1 | Incomplete, identical grazing behavior |
| B05 +/-0.001 degree input probes | Complete on either side, with explicit angular-only approximation | Complete on either side; same first-event angles |

The B06 completed variant is **not full Fresnel physics**. Neglecting
secondary reflections at I23, I34 and the air boundary is explicitly
recorded as an additional assumption; merely choosing linear does not
make the original complete. Default-mode results were never overwritten.

## Localized B05 exact-critical numerical mechanism

The bounded read-only native event trace identifies an almost tangential
transmission at I23, with its outgoing normal-direction component
approximately 3.49463e-8. The same ray then intersects **I23 again**
after just 7.15535e-6 mm and reverses its small normal component. It
subsequently alternates between I12 and I23, with native boundary
intersections millions to billions of millimetres away, before the
configured depth limit truncates the run. Default and linear modes
show the same trajectory and failure.

The replay emits diagnostic codes **NEAR_TANGENT_SAME_INTERFACE_REHIT**
and **EXTREME_GRAZING_TRAVEL**; they are not accepted physical results
and they do not change native behavior. The short self-rehit explains the
observed loop sequence but is not yet an independently proven minimal
upstream bug root cause. Neither changing color mode nor raising the
brightness would fix the geometric near-grazing issue.

## General qualified-scene replay

A caller can compare one trusted, hash-verified v5 planar-media qualified
scene without creating a new physical scene:

~~~sh
node scripts/native-numerical-replay.mjs input.qualified.json --mode default --out test-artifacts/llm-authoring/my-default-replay
node scripts/native-numerical-replay.mjs input.qualified.json --mode linear --out test-artifacts/llm-authoring/my-linear-replay
~~~

The CLI refuses reused output directories and preserves the exact
original input bytes, its hash and qualification identity. A report
records the noncanonical native mode, bounded diagnostics, native
status, explicit numerical findings and requested results. Exit 0
means the *variant* finished; exit 2 means incomplete/stopped, with
requested results withheld; exit 1 means invalid input/setup. A completed
variant does **not** establish correctness of the source question or
replace the original native execution. A B06 example is checked in
CI by scripts/native-numerical-acceptance.mjs.

Production canonical v5 scenes, native exports and the browser still use
the pinned default mode. There is no silent policy selection,
automatic second attempt, changed ray source or requested-result
completeness exception.
