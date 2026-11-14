# Reduced-facts inverse optics (Milestone 28)

This is an **analytical capability**, not a new PhyDemo scene primitive. It extends the existing `opticsim-problem-v1` unified request with two explicitly named calculation kinds:

- `plane-mirror-reflection-point`: one specular reflection on a declared straight mirror supporting line, connecting two points on the same side.
- `paraxial-focal-length-inverse`: one static Gaussian thin lens or paraxial spherical mirror, based on 1–4 explicit real-object magnification observations. Both signed magnification and unsigned magnitude (with optional orientation) are supported. An unsigned single observation can return multiple candidates; multiple observations can intersect those candidate sets without assuming image orientation.

All lengths must carry a declared `mm`, `cm` or `m` unit. Inputs use `physical.format="opticsim-reduced-inverse-facts-v1"`. The supported `model` values are `plane-mirror`, `ideal-thin-lens` and `spherical-mirror-paraxial`. No source brightness, emission, physical aperture, detector position or numerical ray density is required or created to solve an analytical fact query.

## Example A — Reflection point

```json
{
  "format":"opticsim-problem-v1",
  "physical":{
    "format":"opticsim-reduced-inverse-facts-v1",
    "model":"plane-mirror",
    "lengthUnit":"cm",
    "mirror":{"x":0,"y":0,"tangentDeg":0},
    "points":{"A":{"x":0,"y":5},"B":{"x":20,"y":20}}
  },
  "requests":[{"id":"hit","kind":"plane-mirror-reflection-point"}]
}
```

Coordinates are x-right/y-up and tangentDeg is the mirror *surface tangent*, not its normal. A reflection from A(0,5) to B(20,20) strikes at (4,0) cm in the stated frame, 4 cm from the foot of A and 16 cm from that of B. The exact incident angle and reflected path length are also returned. A mirror **without** an explicit length is an **infinite supporting line**: the result is conditional, not proof that an unknown finite mirror contains the strike point. If length is supplied, endpoints are tested; misses and endpoint contact are withheld.

## Example B — Curved mirror magnification inverse

```json
{
  "format":"opticsim-problem-v1",
  "physical":{
    "format":"opticsim-reduced-inverse-facts-v1",
    "model":"spherical-mirror-paraxial",
    "lengthUnit":"m",
    "signConvention":"real-object-positive",
    "observations":[{"id":"O1","objectDistance":2.5,"signedMagnification":4}]
  },
  "requests":[{"id":"f","kind":"paraxial-focal-length-inverse"}]
}
```

The real-object-positive convention is `u>0`, `m=-v/u`, `1/f=1/u+1/v`. For u=2.5 m and erect magnification +4, v=-10 m, f=10/3 m, signed curvature radius 20/3 m (concave). All these are **conditional Gaussian/paraxial results**, not a measured native image or exact finite-aperture spherical-mirror result.

## Example C — Two unsigned magnifications for a thin lens

```json
{
  "format":"opticsim-problem-v1",
  "physical":{
    "format":"opticsim-reduced-inverse-facts-v1",
    "model":"ideal-thin-lens",
    "lengthUnit":"cm",
    "signConvention":"real-object-positive",
    "observations":[
      {"id":"far","objectDistance":16,"absoluteMagnification":3},
      {"id":"near","objectDistance":8,"absoluteMagnification":3}
    ]
  },
  "requests":[{"id":"f","kind":"paraxial-focal-length-inverse"}]
}
```

The 16-cm observation alone admits f=12 cm with inverted real image or f=24 cm with erect virtual image. The 8-cm observation alone admits f=6 cm or f=12 cm. Requiring one **common** optic selects f=12 cm, v=48 cm for the 16-cm case and v=-24 cm for the 8-cm case. No orientation is selected by author preference. If multiple focal lengths survive, the result has `status:"multiple-solutions"`, `value:null`, and explicit candidates; such ambiguity is not scored as a single answered quantity.

## Integration and evidence

The same bounded unified problem dispatcher handles these two kinds alongside existing planar-angle, mirror-angle, curved-mirror and native observable requests. New calculations count toward its existing limit of four analytical queries. A reduced fact input cannot become an executable scene, even when `verifyNative` is requested. The existing `run-problem.mjs` produces hash-bound analysis/plan/report artifacts with `nativeCalls:0` and no qualified native-scene package. When a native observable is also requested without a full physical scene, that observable remains unavailable or in need of information while the independent analytical result is retained. No result from an analytical inverse is relabelled as a detector observation.

No old schema, ray-tracing code, core pin, historical first attempts, browser renderer, published package or external model endpoint is changed. Unknown values, contradictory observations, impossible single-bounce geometry, near-unit magnification and unsupported methods do not result in guessed apparatus or repairs.

## Boundaries

This solver does **not** derive physical lens-maker indices, dispersion, wave/3D shadow visibility, beam profiles, moving optics or combined refractive/reflective routes. A reported analytical agreement with archived textbook arithmetic is **not an original-question accuracy score**. Previously exposed original cases R01/R03/R08 motivate these generic formulas but their saved first attempts are never changed or replayed as fresh independent answers.
