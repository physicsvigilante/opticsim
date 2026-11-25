# Which Model / Which Result? (Quick Guide for Teachers, Students & LLMs)

Opticsim separates **native 2D ray tracing** (pinned PhyDemo `811f508d2b070898c241a568b0c167dcb8645251`, sampled observations with `nativeObservation: true`) from **conditional analytical mathematics** (including exact `binary64-rational` coaxial paraxial propagation and numerically guarded angular/Snell calculations, with `nativeObservation: false` and `nativeImageDetected: false`).

Use this chooser to pick the right starting point without learning schema history.

## 1. Choosing a Native Ray-Tracing Bench (Browser or CLI)

Start with the unified **`v40` (`native-optical-bench`)** bench for all new JEE setups. Six curated `v40` JEE starters (`native-optical-bench`, `v40-billet-split-lens`, `v40-snell-window`, `v40-silvered-plano-convex`, `v40-cemented-doublet`, `v40-layered-mirror-tank`) are available directly in the browser **Scene** dropdown (`public/index.html`), and LLMs can fetch the complete slim JSON contract in one call via `node scripts/author-scene.mjs bench-capabilities`:

| Need | Model & Schema | What You Can Compose | Key Limits |
| --- | --- | --- | --- |
| **Recommended default: unified finite glass (signed/flat thick lenses, layered media & silvered optics) + decentered thin lenses + mirrors + fans & interior sources** | `native-optical-bench` (`v40`) — [docs](NATIVE-OPTICAL-BENCH.md) | Explicit `backgroundIndex` (`[1, 4]`) & deterministic `randomSeed`; `1–4` point sources (`single-ray`, `directional`, or `full-circle`; ambient **or strictly inside** circle/prism/quad) **OR** `1` external `parallel-beam`; `0–2` finite dielectrics (disjoint, coincident flat layered media, or coaxial cemented doublet; signed/flat `spherical-lens`, `2 → 1 → 0` deletion closure & index-matched neutral bodies); `0–4` vertical `ideal-lens` (independent `x`, `y`, including split lenses at the same `x`); `0–2` curved mirrors (disjoint or curved-silvered on lens/circle); `0–2` `plane-mirror` (disjoint or flat-silvered); `0–2` stops; `0–2` detectors (max 16) | `maxRayDepth <= 16` (`bench-v40` default); `>= 0.01 mm` exact finite-segment & body clearance (or `<= 1e-11 mm` clean coincident contact with matching `partialReflection` on touching glass); `spherical-lens` exterior-only; grazing/near-critical/failed-merge/truncation fail closed (`v40EndpointsVerified`). Fetch slim JSON spec with `node scripts/author-scene.mjs bench-capabilities`. |
| **Legacy air-only optical bench** | `native-general-optical-bench` (`v37`) — [docs](NATIVE-GENERAL-OPTICAL-BENCH.md) | Frozen air-only `1–4` point sources / `1` `parallel-beam`, `0–4` coaxial `ideal-lens`, `0–4` `plane-mirror`, `0–2` curved mirrors, `0–2` stops, `0–2` detectors (`maxRayDepth = 8`). | Preserved for backward compatibility and the `v37` paraxial witness bridge; use `v40` for new general setups. |
| **Legacy refractive / hybrid benches** | `native-general-refractive-bench` (`v38`) / `native-general-hybrid-bench` (`v39`) — [v38](NATIVE-GENERAL-REFRACTIVE-BENCH.md), [v39](NATIVE-GENERAL-HYBRID-BENCH.md) | Frozen `1–2` exterior-source dielectric benches (`maxRayDepth = 8`) used by the `v38`/`v39` paraxial witness bridges. | Preserved for backward compatibility and existing witness workflows; use `v40` for new general setups. |

> **Note on specialized historical profiles (`v1`–`v36`):** Specialized arrangements (such as interior emitters inside a circle/prism/cap, directional refractive fans `v29`, graded-index slabs `v25`/`v33`, or deeper `maxRayDepth = 16` two-thick-lens returns `v17`/`v18`) remain frozen in their dedicated schemas and are preserved for backward compatibility.

## 2. Choosing Analytical Paraxial Analysis & Native Witness Bridges

| Need | Module & CLI | What It Gives You |
| --- | --- | --- |
| **1–8 element coaxial paraxial stack** (thin lenses, planar/spherical refracting surfaces, media, optional terminal mirror, contact elements) | `src/coaxial-paraxial-stack.js` — [docs](COAXIAL-PARAXIAL-STACK.md) | Exact `binary64-rational` ABCD matrix, conjugates, collimated focus / afocal scaling, return self-conjugates (`nativeObservation: false`). |
| **Branching, structural edits, sweeps & replayable packages** over a paraxial stack | `scripts/explore-coaxial-stack.mjs` — [docs](COAXIAL-STACK-EXPLORATION.md) | SHA-guarded revisions, atomic add/remove, bounded 1–25 value sweeps, baseline-vs-variant comparisons. |
| **Recommended default: cross-check any coaxial paraxial stack against real `v40` rays** | `scripts/witness-optical-bench.mjs` — [docs](NATIVE-OPTICAL-BENCH.md#4-paraxial-vs-native-witness-bridge-v40) | Unified ABCD vs. pinned PhyDemo `v40` witness (`maxRayDepth = 16`) covering pure thin-lens/mirror stacks, signed/flat spherical lenses, touching layered slabs, cemented doublets, and flush flat/curved silvered optics. |
| **Legacy `v37`/`v38`/`v39` witness bridges** | `scripts/witness-coaxial-stack.mjs`, `scripts/witness-refractive-stack.mjs`, `scripts/witness-hybrid-stack.mjs` | Frozen compatibility bridges targeting `v37` ([docs](COAXIAL-STACK-NATIVE-WITNESS.md)), `v38` ([docs](REFRACTIVE-NATIVE-WITNESS.md)), and `v39` ([docs](HYBRID-NATIVE-WITNESS.md)) (`maxRayDepth = 8`). |

## 3. Reading Opticsim Result Statuses Honestly

- **`available` / `qualified` (native):** Complete, hash-matching native trace with endpoint/corner/tangency audit verified (`v37`–`v40`, including `v40EndpointsVerified` grazing/critical/failed-merge checks). `qualified` means an explicit warning applies (e.g., `partialReflection: false` omits Fresnel reflections). Counts are sampled native hits; detector power is relative native units, not watts or continuous flux.
- **`conditional` (analytical):** Valid under the declared first-order or angular model assumptions (`nativeImageDetected: false`).
- **`suppressed` / `incomplete`:** Native run truncated (e.g., `maxRayDepth = 16` in `v40` or `8` in `v37`–`v39` reached, or Fresnel weak branches clipped), stopped, or triggered an audit guard. Accepted readouts are intentionally withheld — this indicates a numerical or admission boundary, not physical impossibility.
- **`unavailable`:** The requested observable does not apply to the current apparatus (e.g., `ideal-image` on an arbitrary multi-element `v37`–`v40` bench).
