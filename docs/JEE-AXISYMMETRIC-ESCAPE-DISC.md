# JEE J11 — Axisymmetric escape cone and opaque surface disc

**JEE-first conditional 3D geometrical-optics model. Not a native 3D ray tracer, an image detector, a physical eye/observer model, or a source-complete JEE solution.**

## Source facts and the simulation boundary

The frozen JEE 20-case sample's **J11** (`08_Ray_Optics_Explanations/04_Total_Internal_Reflection_TIR/Problems/005.png`) describes an **isotropic point source** at depth **h** below a water surface with water refractive index **μ**. A floating opaque circular disc is to hide the source; it requests the minimum disc radius.

The source uses **symbolic** h and μ, not a particular numeric underwater apparatus. The prior source audit did **not** find a numeric exterior absolute index, finite interface geometry, disc thickness or material properties, observer position, source brightness, or a numerical detector. Those missing facts must not be manufactured.

The nine original/source/synthetic tests and the scope split were frozen **before implementation** in `evaluation/jee-j11-escape-disc-v1/frozen-protocol.json` at commit `bbb40ee6be4d62f910e9e3eefab3d198cd3d4873`, derived from the stable merged J08 production `main` `2a529aeca8cf4960f3c7f285e635c55ae5a130b9`. Original *Solutions* images are not used.

## Exact conditional 3D geometrical derivation

Assume one **infinite horizontal planar** interface between homogeneous isotropic media, a stationary source at (0,0,−h), `h>0`, inside index `n1`, upper exterior index `n0`, and a **truly opaque, centered disc** of radius R in the same plane as that interface. The ray from the source has polar incidence angle θ measured from the upward normal, with arbitrary azimuth φ. Its surface intersection is

```
(x,y) = (h tan(theta) cos(phi), h tan(theta) sin(phi)).
rho = sqrt(x²+y²) = h tan(theta).
```

If **n1 > n0**, total internal reflection begins at the critical half-angle `theta_c = asin(n0/n1)`. Strictly transmitted rays have `theta < theta_c` and their intersection points occupy a circular footprint of radius **strictly less than**

```
R_min = h tan(theta_c)
      = h n0 / sqrt(n1² - n0²).
```

An opaque centered disc with `R >= R_min` therefore intercepts every **geometrically upward-transmitted direct** ray, under the explicitly declared assumptions. Any smaller radius leaves at least one permitted ray direction uncovered. This is a **3D symmetry argument**: it considers every azimuth of the same polar escape cone, not a finite number of rays sampled in one vertical plane.

The boundary is a limiting **supremum**; no exact-critical grazing ray is certified as propagating to the upper medium. If `n1 <= n0`, the transmitted incident directions include arbitrary near-grazing polar angles, and `rho=h tan(theta)` is unbounded; thus **no finite disc** covers the full infinite-plane direct geometric escape set. The model does not claim all real observers see the source when such a disc is smaller or absent: diffraction, scattering, reflection, disc-edge wave effects and practical detection are outside this model.

## Original symbolic request

The original J11 information is sufficient for the **symbolic conditional expression**, not a specific numeric radius. The source-only example `examples/jee-j11-escape-disc-symbolic-v1.json` uses:

```json
{
  "format": "opticsim-axisymmetric-escape-disc-v1",
  "kind": "symbolic-escape-disc-radius",
  "model": "isotropic-point-planar-interface-axisymmetric-geometric",
  "geometry": "centered-opaque-surface-disc-infinite-interface",
  "emission": "isotropic-point-3d",
  "depthSymbol": "h",
  "insideIndexSymbol": "mu",
  "outsideIndexSymbol": "n_outside"
}
```

It returns the conditional expression `h*n_outside/sqrt(mu²-n_outside²)`, its physical domain `mu>n_outside>0`, and `native.status:'not-run'`. The symbol `n_outside` is an **unknown**, not a numerical material index inferred from the words "water" or "air".

A separate numerical example, `examples/jee-j11-escape-disc-synthetic-numeric-v1.json`, **explicitly adds** source depth 100 mm, underwater index 1.5 and exterior index 1, giving

```
theta_c = asin(2/3) ≈ 41.8103°
R_min = 100/sqrt(1.5²−1) ≈ 89.4427191 mm.
```

This is an illustrated numerical instance, **not an original J11 answer**. In numeric mode the index `outsideIndex` remains optional only in the sense that omission produces `needs-information`; it is never filled automatically.

## Numerical admission and refusal

The standalone analytical `src/axisymmetric-escape-disc.js` accepts only exact format, named model, an actual isotropic **3D** source policy, and centered infinite-interface disc geometry. Symbolic mode requires literal symbols h, mu and n_outside; numeric mode requires explicit unit `mm`/`cm`/`m`, finite numeric source depth in 1–10000 mm and numeric water index in [1,4]. The exterior index, when supplied, is a finite absolute index [1,4]. Missing exterior index causes `needs-information`, not an invented air assumption.

The numeric cases return `conditional` (n1>n0), `no-finite-coverage` (n1<=n0), `numerically-indeterminate` (near equal indices or unbounded report radius), or `rejected` for invalid physical facts. The near-index guard at relative contrast `1e−8` and output cap at 1,000,000 mm are conservative **engineering admission choices**, not universal error bounds. Unqualified, imaginary, nonfinite or missing inputs do not produce a false radius. The independent numeric regression checks arbitrary azimuths, that a smaller disc leaves a transmitting ray direction uncovered, several depth/index cases and unit conversions.

This standalone query **does not run pinned PhyDemo**; it reserves a fresh evidence directory under `test-artifacts/llm-authoring/`, writes the exact original input bytes and SHA-256 before parsing, and records conditional, needs-information, no-finite, indeterminate or rejected evidence. No native scene, image, simulated disc, watts or physical observer is created. Pre-existing `JSON.parse` duplicate-key behavior and the shared path helper's hostile concurrent-filesystem race limitation remain unchanged.

```sh
node scripts/axisymmetric-escape-disc-query.mjs capabilities
node scripts/axisymmetric-escape-disc-query.mjs examples/jee-j11-escape-disc-symbolic-v1.json --out test-artifacts/llm-authoring/j11-symbolic-01
node scripts/axisymmetric-escape-disc-query.mjs examples/jee-j11-escape-disc-synthetic-numeric-v1.json --out test-artifacts/llm-authoring/j11-numeric-01
```

## Separate genuine 2D pinned-PhyDemo ray study

`test/jee-j11-escape-disc-meridional-native.test.mjs` authors an existing supported **v5** source and one **PlaneGlass** interface: a native `SingleRay` emitter at depth 100 mm inside a region of explicitly added index 1.5, traveling toward an infinite planar interface with explicitly added exterior index 1. This is the **meridional cross-section** of the hypothetical 3D geometry and is not the actual original symbolic source or a 3D image/disc simulation.

The test observes real upstream callbacks for normal, 15°, 30°, 41°, just-below-critical, exactly-critical, just-above-critical, and 50° incidence, as well as reversed transverse direction, translation, a deliberately truncated depth-zero run and a processed-ray stop. Pinned PhyDemo alone computes actual hit coordinates, transmitted/reflected directions and TIR. Test-only observers delegate exactly once and never prescribe a route.

Safe positive meridional transmission/TIR witnesses demand genuine native completion, finite face hit, zero truncation/undefined/errors and sufficient distance from the declared near-critical sine margin 1e−6. The exact-critical event is explicitly **unqualified** regardless of its raw native terminal. Even a successfully qualified 2D ray event cannot certify an opaque **3D** circular disc covers all azimuths or that no real observer sees the source. We do **not** substitute a 2D line blocker or a detector miss for a 3D coverage proof.

## Verification and release hold

This is a reusable **axisymmetric escape-footprint** analytical extension plus an independently executed native cross-sectional illustration, not a new 3D optical engine. It adds a frozen protocol, three examples, model, original-byte CLI, mathematical tests, 2D native tests and this document. Existing upstream optics, native schema versions, finite 2D blockers, authoring/renderer code, JEE historical evaluation and original attempts remain unchanged.

After exact-source 11-workflow CI, archived native evidence checks and strict final-source merge-tree identity, request **one focused independent physics/math/numeric/evidence review** of this new conditional 3D rotational argument, source fidelity, and safe native nonclaim. Do not re-review unchanged v5 Snell logic or other previously cleared engine modules. PR remains draft and unmerged until independently cleared and separately integrated under the standing owner release decision.
