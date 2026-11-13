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
