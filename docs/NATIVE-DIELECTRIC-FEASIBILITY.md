# Pinned native dielectric feasibility and next milestone design

**Core:** `ricktu288/ray-optics@811f508d2b070898c241a568b0c167dcb8645251`, unmodified PhyDemo v5.4.0.

## Existing physics, not a new ray tracer

The pinned `src/core/sceneObjs/glass/CircleGlass.js` contains a finite circular glass region (`p1` centre, `p2` radius-point) with inside/outside incident classification and local-normal refraction through native `BaseGlass.refract`. Native `Glass.js` supports closed polygons of straight edges and arcs; `SphericalLens.js` is a thickness/material-index lens built on Glass. The planar-v5 Opticsim restriction to parallel `PlaneGlass` interfaces is **our validator's bound**, not an absence of these native primitives.

The accompanying `scripts/native-dielectric-probe.mjs` is test-only. It reuses a valid v6 `SingleRay` seed, replaces the optical object **only in an ephemeral native test scene**, and measures actual pinned `onRayIncident` calls for a circular region (normal/oblique entry, two boundary hits, internal TIR) and a nonparallel polygon (entry and exit). No schema, source archive, vendor code or production scene is modified.

## Decision: circle first, polygon second

Choose **one stationary finite circular dielectric region** as the next production optical family. Its LLM-authored facts should be centre x/y, positive radius, explicit inside/outside refractive indices, explicit Fresnel partial-reflection policy, source position/direction/brightness and requested native observables. The deterministic adapter should compile to existing native `CircleGlass` with relative index ratio. This is the 2D cross-section model, **not** arbitrary 3D spheres.

Introduce a separate canonical schema version and strict arrangement scope. Preserve v4/v5/v6, all existing qualified packages, pin, engine, player, and original first-attempt seals. Start with a single glass region, bounded source rays and up to two passive detectors outside the region; no automatic scene substitution, moving optical element, or special textbook answer shortcuts.

Reapply the existing observation machinery: per-instance real native encounter counts, first outgoing branches, native TIR, full-run hash/completeness gate, and explicit missing-branch status. Source region membership must be checked at original coordinates. Validate radius/coordinates, source-on-circle, detector-circle overlaps, dangerous tangencies and coincident encounters conservatively. Tests should independently verify Snell's law at *the actual local normal*, normal incidence, inside/outside, reverse direction, TIR and misses, plus viewer/exports/units.

The first test probe uses `partialReflect:false` **explicitly as a transmission-only Fresnel approximation**. It does not prove that complete full-Fresnel ray trees survive the native 8-depth/10000-segment limit. Before production claims, test full-Fresnel truncation and issue #23's known near-grazing, weak-branch behavior without silent retries or native cutoff edits.

## What is NOT solved merely by CircleGlass

- A half-spherical paperweight cut by a planar face requires a closed region with a circular arc **and** a flat boundary; it is not a full circle. Do not claim original P06 solved.
- Internal bubbles require a second interior region and explicit material boundaries; one circle is not a general nested dielectric.
- An image seen by an observer needs separately qualified optical measurement or a conditional paraxial imaging calculation; tracing rays does not detect images.
- Symbolic proofs, arbitrary source motion and full 3D ray paths remain unsupported.
- A nonparallel prism is a natural **second** reusable geometry: compile a validated convex polygon to native `Glass`, reuse the same physical index/provenance/observables, then add explicit apex-angle and ray-deviation operations only when justified.

## Architecture

LLM authors only stated **regions, indices, source rays, and requested observables**. Validation constructs a finite canonical region; pinned PhyDemo owns actual intersections/refraction/TIR. The existing native observation and qualification layers report what was actually measured, with no changed numerical thresholds or invented apparent images.

This milestone is test-first by design. The current branch is a feasibility investigation; turning it into a production authoring contract requires a separate, reviewable implementation commit and acceptance evidence. No new controls or native engine rewrite are prerequisites.

## Completed native probe evidence

The first pinned-native run [43391993280](https://github.com/physicsvigilante/opticsim/actions/runs/43391993280) completed successfully. It recorded two exact normal-circle hits, two oblique-circle hits with local-normal Snell agreement, at least one interior total-internal reflection, and two distinct native prism boundary hits with a changed outgoing heading. **Important qualification:** the internal TIR test's `simulationComplete` callback was accompanied by `totalTruncation = 0.1` relative brightness at an intentionally short ray depth. Under Opticsim's actual completion policy that is **incomplete**, not a publishable full native observation. The follow-up probe explicitly asserts truncated brightness and samples full Fresnel mode separately. No numerical cutoffs are changed.

## Repeated probe and numerical classification

The exact revised candidate `83a8945b882f48c1505b8d5e4b7246e71d70572b` completed [run 43392322380](https://github.com/physicsvigilante/opticsim/actions/runs/43392322380) on freshly built, unchanged pinned core.

| Test-only native arrangement | Actual native surface encounters | Raw native callback | Truncated relative brightness | Canonical Opticsim classification |
|---|---:|---|---:|---|
| Circle, normal incidence | 2 | simulationComplete | 0 | completed |
| Circle, oblique incidence | 2 | simulationComplete | 0 | completed |
| Circle, internal TIR, depth 3 | 3 | simulationComplete | 0.1 | **incomplete** |
| Circle, full Fresnel | 2 | simulationComplete | 0.00786636 | **incomplete** |
| Nonparallel triangular Glass polygon | 2 | simulationComplete | 0 | completed |

The raw native callback is *not* proof of full ray-energy coverage. `classifyRun` correctly suppresses accepted observables whenever native truncation or undefined behavior is nonzero. The Fresnel and TIR cases therefore demonstrate useful **physics plus a limitation**, not fully complete optical solutions. The probe's full-Fresnel branch is an actual native run; its numerical values are evidence for that fixture only, not an estimate of accuracy for every incidence.

[Downloaded evidence ZIP](https://github.com/physicsvigilante/opticsim/actions/runs/43392322380/artifacts/14021008114) contains `report.json`, with validated internal CRC and the actual incident-point/direction readings. The subsequent documentation-only cleanup removes the branch-triggered workflow to prevent ongoing CI duplication. Run the explicit probe locally as `npm run setup && node scripts/build.mjs --test && node scripts/native-dielectric-probe.mjs`.
