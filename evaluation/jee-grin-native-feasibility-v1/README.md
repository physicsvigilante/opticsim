# JEE J09 / continuous-gradient index: pinned-native feasibility trial v1

**Research only — no new public optical family, no native image certification or original JEE solution.** Baseline is reviewed production main after merge PR183, commit `29a576e345bbf8683ce77f7e0cd3acb295a17cf3`. Pinned PhyDemo upstream remains `811f508d2b070898c241a568b0c167dcb8645251`.

## Why this is worth studying

The frozen 20-case JEE source review (held PR165, not altered) records J09 as a continuous graded-index slab with dimensionless written law `mu=sqrt(1+y)`, symbolic thickness `d`, incident grazing ray and a requested path/exit. The currently reviewed v1–v24 contracts admit homogeneous refractive regions, not arbitrary spatially graded refractive indices. A stack of finitely many homogeneous layers would not establish the continuous J09 path.

The **pinned native upstream source** actually contains `GrinGlass` and a shared `BaseGrinGlass` integration method. It parses LaTeX index functions, evaluates derivatives and advances the ray by an **explicit Euler-type discrete step**. This is qualitatively different from direct homogeneous Glass refraction and cannot be certified merely because a native image appears on the canvas.

## Exact bounded synthetic scene

`test/jee-grin-native-research.test.mjs` creates **raw** pinned-native `SingleRay`, `GrinGlass` and `Detector` objects from an existing native source/detector fixture. It does not compile a new canonical Opticsim component. The rectangle spans native x=0..1 mm and native y=-0.9..+0.4 mm; initial ray is inside at (0.1,0) and travels right. Since native y increases downward, it tests the specifically authored native `refIndexFn=\\sqrt{1-y}`, corresponding to physical y-up `n(y)=sqrt(1+y/(1 mm))` in this synthetic unit normalization, with zero absorption and explicit Fresnel-off. This **added length scale and rectangular boundary are not source-J09 facts**.

One passive detector lies beyond the x=1 mm exit. It checks actual native callbacks and detector readings, a constant-n=1 control, and three index-integration step sizes (.04, .02, .01 mm). The raw research core uses maxRayDepth 4096; **that budget is not a public API setting**, and is not generalized to historical schemas. It never manually steers ray positions or claims a detected image.

## What must be qualified before a public implementation

1. Show actual complete pinned-native graded trajectories and finite native detection, not a painted line or scripted hit.
2. Separate Euler **step-size convergence** and error bounds from the correct continuous ray differential equation, including near-grazing starts and exit-boundary intersections. Numerically different step sizes are a warning about accuracy, not automatically a proof of wrong physics.
3. Establish that the original source's spatial units, boundary geometry, index positivity domain, exterior index and grazing direction are actually known; refuse when they are not. The synthetic illustrative field is not the original source's unique ray path.
4. Disallow arbitrary user-entered LaTeX without a narrowly validated function grammar; native expression evaluation is a substantial security and numerical boundary. Preserve strict limits on derivative singularities, negative/zero n, divergence, ray depth and processed-ray budget.
5. Keep J09 conditional analytical solutions, native curved-path evidence and original-source fidelity separately scored. No complete symbolic exit, 3D visual image or exact ray trajectory may be inferred from an unbounded Euler trial.
6. If feasibility is positive, implement a bounded `n(y)`-family in a **new versioned public schema on a separate branch**, then get **one consolidated independent physics/numerical/integration review** after exact CI. Do not merge a public GRIN feature from this research test.

This is a capability probe deliberately separate from old PR165 and previously reviewed PR183; failure is informative and should be preserved rather than weakening an acceptance criterion to make native passes.
