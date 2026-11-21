# Angular limits at two perpendicular dielectric faces

The public problem workflow accepts `opticsim-perpendicular-dielectric-facts-v1`. The authored model is `perpendicular-faces-meridional`. Give the entry and observation faces distinct IDs. The incident ray lies in the plane of the two normals and enters a homogeneous core. The calculation is conditional on reaching the named adjacent wall. Lengths, light-source properties and a finite ray path are unnecessary for this result.

Run either [the A17 square-section example](../examples/two-face-grazing-entry.json) or [the A19 meridional guide example](../examples/two-face-sidewall-acceptance.json) through the usual CLI, with a fresh output directory.

```sh
node scripts/run-problem.mjs examples/two-face-sidewall-acceptance.json --out test-artifacts/llm-authoring/guide-limit-01
```

## Materials and angles

Use `materials.basis` to select one representation.

- `symbolic-common-exterior` declares the unknown ratio m = nCore / nExterior > 1. Both faces border the same exterior.
- `common-exterior` requires a numeric `coreToExteriorRatio` in (1,4]. Results depend only on this ratio.
- `absolute-indices` requires `entranceIndex`, `coreIndex` and `wallExteriorIndex` in [1,4]. Require core > wall exterior and core ≥ entrance. The grazing-entry query requires equal exterior indices at the two faces.

Take launch magnitude i from the entry normal and emergence magnitude θ from the wall normal. Snell's law preserves nEntrance sin(i) at the first face. The component tangent to the second face inside the core is therefore sqrt(nCore² − (nEntrance sin(i))²). Compare it with nWall for the second transmission condition.

**Grazing-entry emergence limit.** Request `grazing-entry-emergence-limit`. As i approaches 90° from below in a common exterior, the limiting Snell relation is sin(θ) = sqrt(m² − 1) = cot(α), where α is the core/exterior critical angle. Strictly below m = sqrt(2) this permits emergence in the limit. At equality the limiting direction is tangent and finite i < 90° stays on the TIR side. Above it the wall undergoes TIR. The symbolic result distinguishes equality from a measured emerging ray. The bound applies to the relative index. An absolute glass-index bound also requires the common exterior index.

**Sidewall TIR launch limit.** Request `sidewall-tir-launch-limit`. Strict TIR requires nEntrance sin(i) < sqrt(nCore² − nWall²). An interior equality is the critical condition. If the right side reaches or exceeds nEntrance, all launch magnitudes strictly between 0° and 90° satisfy the angular condition. At zero an axial ray misses a straight sidewall; at 90° the ray does not enter across the end face. The returned supremum can therefore be an excluded endpoint. This contract covers meridional rays. It makes no claim about skew rays, wall reach before the end of a finite pipe, or guided wave modes.

**Numerical policy.** Ratios within the shared angular uncertainty (2 × 10⁻¹²) of a branch change withhold the numeric value. Nearly matched core and wall indices are withheld as well. For the launch query an exact Pythagorean equality of the supplied binary64 indices can identify a critical wall condition at the excluded grazing-entry limit. Exact symbolic predicates remain available independently of approximate input values.

The [frozen protocol](../evaluation/perpendicular-dielectric-faces-v1/frozen-protocol.json) separates source facts, analytical conditions and four synthetic finite native controls. The tests build real schema-v9 Glass and SingleRay objects on the existing PhyDemo pin and record native entry/wall events. The analytical query returns no native scene, ray or critical-angle crossing. v29 fan withholding remains in force.
