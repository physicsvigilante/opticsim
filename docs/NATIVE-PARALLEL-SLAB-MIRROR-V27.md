# v27 — Native finite Beam through a two-plane slab and separated finite Mirror

**Public candidate under review hold.** This is an engine-composition extension, not a special JEE-answer solver. The original upstream pinned PhyDemo remains `811f508d2b070898c241a568b0c167dcb8645251`; no native ray tracer or reflected-ray fitting has been implemented.

## Supported optical system

An explicitly authored **finite deterministic parallel Beam** travels toward a first planar interface, refracts through a homogeneous finite-thickness slab, exits through its second planar interface, reaches a separated finite plane Mirror in the third medium, then returns through both refracting interfaces. Up to two passive source-side detectors may observe real crossings.

The public composition `native-parallel-slab-mirror-tracing`, schema **27**, requires exactly one `parallel-beam`, **two** `planar-interface` components, **one** independent `plane-mirror`, and **zero to two** passive `ray-detector` components. Each refracting plane is vertical with `normalDeg:0`. The two exterior absolute indices must be **explicit and equal**, and the slab's explicit index must be at least the exterior index. Both interfaces must have `partialReflection:false`. This is an intentionally transmitted-only Fresnel approximation; genuine native total internal reflection remains enabled.

**The slab is real but the mirror must not touch it.** Slab thickness is at least 1 mm and the finite vertical Mirror must be at least **1 mm beyond the back refracting plane**. Direct contact (coincident second interface and mirror) and gaps smaller than 1 mm are refused. Original JEE J08 specifies a mirror *resting on the plate*, so the separated mirror system is a valuable analogous teaching apparatus but **not** the original J08 physical geometry or a certified textbook result.

The example `examples/native-parallel-two-plane-mirror-v27.json` authorizes a native Beam at x=−100 mm (width 40 mm, +30°), first interface x=0 (n0=1→n1=1.5), second x=60 (n1=1.5→n2=1), finite Mirror x=90 mm (30-mm air gap), and passive detector x=−10 mm. Its own numerical dimensions/indices/brightness are additional **synthetic authored choices**, not assumed JEE facts. The source emits eight genuine native samples at density .2; the pinned engine decides all actual interactions.

## Numerical and geometrical admission

v27 reuses the **independently reviewed and corrected v26** exact pinned Beam emission calculation. It compiles the actual native y-down Beam segment endpoints and determines native emission count/positions using the pinned `Math.sqrt(dx*dx+dy*dy)`, ray density/lengthScale=1, and inclusive midpoint loop. A native count within `1e−10` of a half-integer threshold is **refused**, including the reviewed 50-mm/1°/.29 counterexample. No older v19 or v26 file/schema behavior is modified.

The finite emitter must fit entirely before the first plane, travel forward at 0–60°, have width 10–100 mm, density 0.048–1, brightness no more than density, and 1–100 sampled rays. The ray-depth budget remains at most 8. Each exact emitted sample is screened by an **independent necessary Snell calculation**, not a ray path supplied to PhyDemo, for a finite first Mirror encounter strictly **more than 0.1 mm from either endpoint**; front/back/return points must be finite and within the authored world. Passive detector positions must lie between the Beam and the front interface and be clear of finite detector rims by 0.1 mm. Invalid full source, missing indices, arbitrary third medium, mirror touching the second surface, weak Fresnel branching, extra optics, tilted mirror, unknown reverse illumination and stale/incomplete execution fail closed.

The numerical guard checks only the declared first outbound/return single-route geometry. It neither proves a general ray-lineage identity nor certifies continuous irradiance, all waves, a physical image, optical power or 3D visibility. At more than 32 genuine detector hits, the full hit-position list is withheld (not silently truncated), while actual complete native crossing counts can remain available.

## Public use and evidence

An LLM or user can provide the complete physical JSON scene; no hand-placed ray trajectories are required. The ordinary Opticsim authoring pipeline selects schema 27, validates the full apparatus, invokes **unchanged pinned PhyDemo**, and produces qualified sampled observables only for a completed native run. The example requests genuine Beam emissions, real first and second interface counts, first Snell event, Mirror reflections, detector crossings and individual detector-hit positions.

```sh
node scripts/native-two-plane-mirror-v27-acceptance.mjs
node scripts/native-two-plane-mirror-v27-browser.mjs
```

The public acceptance verifies fully qualified portable saves, changed Beam width, changed homogeneous slab indices and separated mirror distance, plus refusal of a contacting/near-contact Mirror, inconsistent refractive index, Fresnel-on and missing exterior material **before** native execution. The real Chrome test imports a qualified package, edits Beam width, confirms a single-interface material edit is invalid until the second interface is updated, saves a valid changed package, refuses physical mirror contact/short mirror, and reopens the saved scene with fresh actual native outputs. All browser artifacts are captured only when Chrome itself runs; no fictitious screenshot, route or cache of rays is authored.

The **separate pre-execution research protocol** was frozen in `research/native-parallel-two-plane-mirror-v27/frozen-protocol.json` at `e3f18c39bc83cae77d86d8c2e672c2411442627b` before raw pinned-native tests. Its eleven genuine research controls disclose that **coincident mirror + rear interface causes zero rear-interface callbacks** in a real completed native run. This is precisely why a naive result based on `simulationComplete` is insufficient. Raw Fresnel-on is truncated and native depth/processed-limit controls remain incomplete or stopped, never accepted as a full result.

**Release gate:** draft and unmerged until all eleven exact-source CI workflows, public native and real Chrome evidence and **one focused independent review** of this **single combined raw feasibility + versioned authoring candidate**. Preserve old v19/v26 rules and earlier independent optics reviews; no duplicate foundational review is needed.
