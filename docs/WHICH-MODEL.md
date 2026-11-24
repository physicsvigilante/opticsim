# Which Model / Which Result? (Quick Guide for Teachers, Students & LLMs)

Opticsim separates **native 2D ray tracing** (pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`, sampled observations with `nativeObservation: true`) from **conditional analytical mathematics** (including exact `binary64-rational` coaxial paraxial propagation and numerically guarded angular/Snell calculations, with `nativeObservation: false` and `nativeImageDetected: false`).

Use this chooser to pick the right starting point without learning schema history.

## 1. Choosing a Native Ray-Tracing Bench (Browser or CLI)

Start with the unified **`v40` (`native-optical-bench`)** bench for all new JEE setups. All modern benches are available in the browser **Scene** dropdown (`public/index.html`) and via explicit `model` selection in `prepareScene`:

| Need | Model & Schema | What You Can Compose | Key Limits |
| --- | --- | --- | --- |
| **Recommended default: unified finite glass (signed/flat thick lenses, layered media & silvered optics) + decentered thin lenses + mirrors + fans & interior sources** | `native-optical-bench` (`v40`) — [docs](NATIVE-OPTICAL-BENCH.md) | Explicit `backgroundIndex` (`[1, 4]`) & deterministic `randomSeed`; `1–4` point sources (`single-ray`, `directional`, or `full-circle`; ambient **or strictly inside** circle/prism/quad) **OR** `1` external `parallel-beam`; `0–2` finite dielectrics (disjoint, coincident flat layered media, or coaxial cemented doublet; signed/flat `spherical-lens`, `2 → 1 → 0` deletion closure & index-matched neutral bodies); `0–4` vertical `ideal-lens` (independent `x`, `y`, including split lenses at the same `x`); `0–2` curved mirrors (disjoint or curved-silvered on lens/circle); `0–2` `plane-mirror` (disjoint or flat-silvered); `0–2` stops; `0–2` detectors (max 16) | `maxRayDepth <= 16` (`bench-v40` default); `>= 0.01 mm` exact finite-segment & body clearance (or `<= 1e-8 mm` clean coincident contact); `spherical-lens` exterior-only; grazing/near-critical/truncation fail closed (`v40EndpointsVerified`). Fetch slim JSON spec with `node scripts/author-scene.mjs bench-capabilities`. |
| **Legacy air-only optical bench** | `native-general-optical-bench` (`v37`) — [docs](NATIVE-GENERAL-OPTICAL-BENCH.md) | Frozen air-only `1–4` point sources / `1` `parallel-beam`, `0–4` coaxial `ideal-lens`, `0–4` `plane-mirror`, `0–2` curved mirrors, `0–2` stops, `0–2` detectors (`maxRayDepth = 8`). | Preserved for backward compatibility and the `v37` paraxial witness bridge; use `v40` for new general setups. |
| **Legacy refractive / hybrid benches** | `native-general-refractive-bench` (`v38`) / `native-general-hybrid-bench` (`v39`) — [v38](NATIVE-GENERAL-REFRACTIVE-BENCH.md), [v39](NATIVE-GENERAL-HYBRID-BENCH.md) | Frozen `1–2` exterior-source dielectric benches (`maxRayDepth = 8`) used by the `v38`/`v39` paraxial witness bridges. | Preserved for backward compatibility and existing witness workflows; use `v40` for new general setups. |

> **Note on specialized historical profiles (`v1`–`v36`):** Specialized arrangements (such as interior emitters inside a circle/prism/cap, directional refractive fans `v29`, graded-index slabs `v25`/`v33`, or deeper `maxRayDepth = 16` two-thick-lens returns `v17`/`v18`) remain frozen in their dedicated schemas and are preserved for backward compatibility.

## 2. Choosing Analytical Paraxial Analysis & Native Witness Bridges

| Need | Module & CLI | What It Gives You |
| --- | --- | --- |
| **1–8 element coaxial paraxial stack** (thin lenses, planar/spherical refracting surfaces, media, optional terminal mirror, contact elements) | `src/coaxial-paraxial-stack.js` — [docs](COAXIAL-PARAXIAL-STACK.md) | Exact `binary64-rational` ABCD matrix, conjugates, collimated focus / afocal scaling, return self-conjugates (`nativeObservation: false`). |
| **Branching, structural edits, sweeps & replayable packages** over a paraxial stack | `scripts/explore-coaxial-stack.mjs` — [docs](COAXIAL-STACK-EXPLORATION.md) | SHA-guarded revisions, atomic add/remove, bounded 1–25 value sweeps, baseline-vs-variant comparisons. |
| **Cross-check thin-lens / mirror paraxial stack against real `v37` rays** | `scripts/witness-coaxial-stack.mjs` — [docs](COAXIAL-STACK-NATIVE-WITNESS.md) | Side-by-side ABCD prediction vs. observed `v37` outgoing ray lines (including spherical aberration on `circular-arc-mirror`). |
| **Cross-check thick-lens / planar-slab paraxial stack against real `v38` Snell rays** | `scripts/witness-refractive-stack.mjs` — [docs](REFRACTIVE-NATIVE-WITNESS.md) | Side-by-side ABCD prediction vs. observed `v38` Snell rays (paraxial vs. marginal spherical aberration, immersed media, zero-TIR/rim-free encounter gating). |
| **Cross-check hybrid glass + thin-lens + mirror paraxial stack against real `v39` rays** | `scripts/witness-hybrid-stack.mjs` — [docs](HYBRID-NATIVE-WITNESS.md) | Side-by-side ABCD prediction vs. observed `v39` hybrid rays across dielectrics, ideal thin lenses, and plane/curved terminal mirrors (with `maxRayDepth = 8` budget and full-stack encounter gating). |

## 3. Reading Opticsim Result Statuses Honestly

- **`available` / `qualified` (native):** Complete, hash-matching native trace with endpoint/corner/tangency audit verified (`v37`/`v38`/`v39`). `qualified` means an explicit warning applies (e.g., `partialReflection: false` omits Fresnel reflections). Counts are sampled native hits; detector power is relative native units, not watts or continuous flux.
- **`conditional` (analytical):** Valid under the declared first-order or angular model assumptions (`nativeImageDetected: false`).
- **`suppressed` / `incomplete`:** Native run truncated (e.g., `maxRayDepth = 8` reached or Fresnel weak branches clipped), stopped, or triggered a `< 0.01 mm` endpoint/corner/tangency guard. Accepted readouts are intentionally withheld — this indicates a numerical or admission boundary, not physical impossibility.
- **`unavailable`:** The requested observable does not apply to the current apparatus (e.g., `ideal-image` on an arbitrary multi-element `v37`–`v39` bench).
