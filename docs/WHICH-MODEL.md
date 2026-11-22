# Which Model / Which Result? (Quick Guide for Teachers, Students & LLMs)

Opticsim separates **native 2D ray tracing** (pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`, sampled observations with `nativeObservation: true`) from **conditional analytical mathematics** (including exact `binary64-rational` coaxial paraxial propagation and numerically guarded angular/Snell calculations, with `nativeObservation: false` and `nativeImageDetected: false`).

Use this chooser to pick the right starting point without learning schema history.

## 1. Choosing a Native Ray-Tracing Bench (Browser or CLI)

All three modern composable benches are available directly in the browser **Scene** dropdown (`public/index.html`) and via explicit `model` selection in `prepareScene`:

| Need | Model & Schema | What You Can Compose | Key Limits |
| --- | --- | --- | --- |
| **Ideal thin lenses, plane/curved mirrors, stops & detectors** (no glass bodies) | `native-general-optical-bench` (`v37`) — [docs](NATIVE-GENERAL-OPTICAL-BENCH.md) | `1–4` point sources (`single-ray`, `directional`, or `full-circle`) **OR** `1` `parallel-beam`; `0–4` coaxial `ideal-lens`; `0–4` `plane-mirror`; `0–2` curved mirrors; `0–2` stops; `0–2` detectors (max 16) | Homogeneous air only; `>= 0.01 mm` clearance; `maxRayDepth = 8`; no route-independent `ideal-image`. |
| **Finite glass / refractive bodies, plane mirrors, stops & detectors** | `native-general-refractive-bench` (`v38`) — [docs](NATIVE-GENERAL-REFRACTIVE-BENCH.md) | `1–4` `single-ray` point sources **OR** `1` `parallel-beam`; `1–2` disjoint finite dielectrics (`triangular-prism`, `polygon-dielectric`, `circular-dielectric`, biconvex `spherical-lens`, shared `outsideIndex`); `0–2` `plane-mirror`; `0–2` stops; `0–2` detectors (max 12) | Emitters strictly outside glass; `partialReflection` explicit (`false` omits Fresnel branches with warning, keeps TIR); `maxRayDepth = 8`. |
| **Hybrid: finite glass + ideal thin lenses + curved/plane mirrors + stops** | `native-general-hybrid-bench` (`v39`) — [docs](NATIVE-GENERAL-HYBRID-BENCH.md) | `1–4` `single-ray` sources **OR** `1` `parallel-beam`; `1–2` disjoint finite dielectrics (shared `outsideIndex`); `0–2` coaxial `ideal-lens` (`focalLength` in `outsideIndex`); `0–2` curved mirrors; `0–2` `plane-mirror`; `0–2` stops; `0–2` detectors (max 14) | Emitters strictly outside glass; requires `>= 1` finite dielectric (for pure lens/mirror use `v37`); `maxRayDepth = 8`. |

> **Note on specialized historical profiles (`v1`–`v36`):** Specialized arrangements (such as interior emitters inside a circle/prism/cap, directional refractive fans `v29`, graded-index slabs `v25`/`v33`, or deeper `maxRayDepth = 16` two-thick-lens returns `v17`/`v18`) remain frozen in their dedicated schemas and are preserved for backward compatibility.

## 2. Choosing Analytical Paraxial Analysis & Native Witness Bridges

| Need | Module & CLI | What It Gives You |
| --- | --- | --- |
| **1–8 element coaxial paraxial stack** (thin lenses, planar/spherical refracting surfaces, media, optional terminal mirror, contact elements) | `src/coaxial-paraxial-stack.js` — [docs](COAXIAL-PARAXIAL-STACK.md) | Exact `binary64-rational` ABCD matrix, conjugates, collimated focus / afocal scaling, return self-conjugates (`nativeObservation: false`). |
| **Branching, structural edits, sweeps & replayable packages** over a paraxial stack | `scripts/explore-coaxial-stack.mjs` — [docs](COAXIAL-STACK-EXPLORATION.md) | SHA-guarded revisions, atomic add/remove, bounded 1–25 value sweeps, baseline-vs-variant comparisons. |
| **Cross-check thin-lens / mirror paraxial stack against real `v37` rays** | `scripts/witness-coaxial-stack.mjs` — [docs](COAXIAL-STACK-NATIVE-WITNESS.md) | Side-by-side ABCD prediction vs. observed `v37` outgoing ray lines (including spherical aberration on `circular-arc-mirror`). |
| **Cross-check thick-lens / planar-slab paraxial stack against real `v38` Snell rays** | `scripts/witness-refractive-stack.mjs` — [docs](REFRACTIVE-NATIVE-WITNESS.md) | Side-by-side ABCD prediction vs. observed `v38` Snell rays (paraxial vs. marginal spherical aberration, immersed media, zero-TIR/rim-free encounter gating). |

## 3. Reading Opticsim Result Statuses Honestly

- **`available` / `qualified` (native):** Complete, hash-matching native trace with endpoint/corner/tangency audit verified (`v37`/`v38`/`v39`). `qualified` means an explicit warning applies (e.g., `partialReflection: false` omits Fresnel reflections). Counts are sampled native hits; detector power is relative native units, not watts or continuous flux.
- **`conditional` (analytical):** Valid under the declared first-order or angular model assumptions (`nativeImageDetected: false`).
- **`suppressed` / `incomplete`:** Native run truncated (e.g., `maxRayDepth = 8` reached or Fresnel weak branches clipped), stopped, or triggered a `< 0.01 mm` endpoint/corner/tangency guard. Accepted readouts are intentionally withheld — this indicates a numerical or admission boundary, not physical impossibility.
- **`unavailable`:** The requested observable does not apply to the current apparatus (e.g., `ideal-image` on an arbitrary multi-element `v37`–`v39` bench).
