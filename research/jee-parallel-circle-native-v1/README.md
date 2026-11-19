# JEE finite parallel Beam + native circular dielectric — frozen feasibility v1

**Status: research-only, no production schema or public admission.** From merged main `59b485d14ac28ca4ee97acc754a4cd207a7d33f1`, with unchanged pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`.

## Source fidelity and objective

The existing public v7 scene admits 1–4 native `SingleRay` sources and one finite `CircleGlass` dielectric. The existing v19 source admits a finite parallel native `Beam`, but only with its own bounded optical compositions. **No public `Beam + CircleGlass` model currently exists**. Our next candidate is reusable 2D finite parallel illumination through an explicitly authored round homogeneous medium, which is relevant to introductory sphere/bubble ray questions including JEE J16.

**Do not misstate J15:** a spherical *single* refracting interface is not modeled by a complete CircleGlass, which has two physical boundaries. A 2D circular section does not certify a full 3D sphere, apparent depth/image, continuous irradiance, or a complete original question answer. Beam width/direction, circle radius/index, and detector geometry in this research are all invented **explicit synthetic teaching controls**; no original textbook Solutions files were consulted.

## Frozen method

Before any execution, `protocol.json` fixed 17 scenarios and numerical limits: four primary low-incidence sampled rays; translated and reversed systems; radius, two material index and width/density variations; a **true native circle miss**; near/exact tangency numerical risks; a source *inside* the homogeneous circle; native interior TIR; Fresnel-on weak branch; depth limit; processed-ray stop; and a free-space no-circle positive control.

Test `test/jee-parallel-circle-native-research.test.mjs` first compiles an independent **valid v7 canonical SingleRay + CircleGlass + Detector seed**. It then creates an *unqualified raw-native JSON* copy and replaces ONLY its native source object with a genuine pinned `Beam`; independently specified geometry changes likewise apply only to raw native research input. The test directly asserts that a public Beam+circle authoring request **remains invalid**. The mutated native scene is NEVER treated as a canonical Opticsim scene or qualified export, and the old scene hash is not misused to authenticate it.

The real native Beam's `onSimulationStart`, real CircleGlass's `onRayIncident` and real Detector's `onRayIncident` are wrapped **only for read-only capture** and delegate to the original exactly once. The observer records actual y-up incoming/outgoing directions and incident points; calculates necessary signed Snell residual or specular reflection residual from the actual **native hit local normal**; counts genuine TIR events from the native return; and separately records genuine simulationComplete, simulationStop, native truncation/undefined/error data. It does not trace, steer, clip, create, reclassify or repair any light ray. A numerical-risk case can complete natively yet remain explicitly **untrusted**. Each original raw native input and actual callback report has separate SHA-256 bytes in `test-artifacts/llm-authoring/jee-parallel-circle-native-v1/attempt-*/`.

## Further decision

First inspect actual CI results and archived originals. Only if the bounded cases are sufficiently stable should a separate **production v23 contract** be considered, on its own main-derived draft. Such a contract would need exact finite Beam/circle clearance and grazing/tangent/near-critical policies, explicit inside and outside indices and Fresnel choice, real native observation qualification, deterministic sampling limits, finite detector separation, stale/stop/undefined suppression, historical v7/v19/v21 preservation, public source-to-qualified native workflow, and real Chrome physical-edit/reopen acceptance. An independently reviewed production final source would need **one consolidated physics/integration review**; research alone does not require a separate independent review.

PR #173 (v22 prism) stays frozen, independently cleared and **unmerged** until the user explicitly authorizes merging. Research must not modify or incidentally base production on that unmerged branch. Branch protection issue #123 remains deferred.
