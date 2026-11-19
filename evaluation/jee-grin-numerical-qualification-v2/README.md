# JEE GRIN numerical-qualification feasibility v2 — frozen pre-test protocol

**Research only. No new supported optical component, no production engine change, no J09 original-source solution.**

Baseline is reviewed and postmerge-CI-verified `main` at `d3c535d9fe1bc5e2a27e414a9224084a3ae7bc3f`, after PR #184 added only research evidence. The exact protocol was committed **before** writing/executing its new tests: `protocol.json` from commit `4e3b9013afb2ebbc9d348281dacf71c81fbd074f`.

The earlier native GRIN pilot used normalized `n(y)^2=1+y/(1 mm)` with some material coordinates where n was below 1. This follow-up intentionally uses a **different, physically bounded synthetic material**: `n(y)^2=1.5+y/(1 mm)` with explicit outside index 1, over a one-millimetre-wide rectangular region, with n² between 1.1 and 2.4 everywhere inside. The position origin, boundary geometry, detector and dimensional scale remain extra authored *synthetic* facts, not original J09 facts.

The pinned PhyDemo `GrinGlass` owns its Euler-type steps and all actual interactions. An ordinary pinned `SingleRay` starts inside at x=0.1 mm and goes horizontally. A passive `Detector` is at x=1.2 mm. The frozen step sizes are 0.04, 0.02, 0.01, 0.005 and 0.0025 mm, and moderate coordinate-shift controls are (+250,+150) and (−250,−150) mm. Deliberate raw native runs near (+9000,+8500) and (−9000,−8500) mm are observational only; the proposed *test-side* numerical preflight rejects them as unqualified.

## Independent first-integral reference, preregistered before the native test

For a horizontal starting ray in continuously varying n(y)² = A + y/L (A=1.5 and L=1 mm), translational invariance gives n cos(theta)=sqrt(A) and the differentiable upward ray branch y=(x−0.1)²/(4 A L). At x=1, the exit surface, Snell transmission into the explicitly chosen outside n=1 gives sin(theta_out)=(1−0.1)/(2 sqrt(A) L). A further 0.2 mm free-space segment leads to the exact conditional detector reference in the frozen protocol JSON. This reference is independent mathematical physics, not a native-generated fitted curve; it does not guarantee numerical correctness of the native algorithm beyond these assumptions.

The tests require genuine native completion, zero error/undefined/truncation, one actual detector callback, bounded and finite ray steps, and decreasing overall deviation toward that reference as native step size decreases. They report every error rather than suppressing it. They also enforce a *research-only* strict preflight: a fixed trusted index-function family only, explicit mm units, no user LaTeX, positive finite material index everywhere (n between 1 and 4), step within a deliberately small numerical range, source/margins/translation bound and no unsupported grazing entry. This is not a public authoring API or a universal error-bound certificate.

The native larger-translation runs may fail or deviate; even if they complete, that cannot expand public numerical admission. Failing an expected native-quality invariant must be investigated and recorded—not fixed by steering/repairing a native ray.

**Release decision:** only after additional real native boundary/corner/grazing stress and numerical qualification should a narrowly defined v25 authoring candidate be considered; it would require a consolidated independent numerical/physics/integration review. For now merge at most research tests and documentation after full exact-source CI, leaving public v1–v24 unchanged.
