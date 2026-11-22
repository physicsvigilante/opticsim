# Composition architecture: apparatus data, shared contracts, native physics

> [!NOTE]
> **Historical milestone snapshot (v1–v12).** This document preserves the original v1–v12 profile-catalog architecture note. Opticsim now spans `v1`–`v39`, including composable optical (`v37`), refractive (`v38`), and hybrid (`v39`) benches plus the coaxial paraxial stack. For current model selection and capabilities, see [docs/WHICH-MODEL.md](WHICH-MODEL.md).

Opticsim must not require a new controller for every optical apparatus. Components
and physical parameters are authored as data; reviewed whole-system compatibility
rules determine admission; pinned PhyDemo determines every actual ray encounter.
Examples and textbook questions are not production dispatch keys.

This milestone consolidates the existing contracts. It adds **no optical family,
component mixture, saved schema version, migration, physical default, numerical
repair or provider integration**. In particular, a lens plus finite glass, two
finite dielectric regions and nested media remain unsupported.

## One catalog, several responsibilities

`src/composition-profiles.js` is a dependency-free, deeply frozen catalog of the
17 existing model/version contracts across saved versions 1–12. A profile records:

- Per-type cardinalities, combined limits and exclusive groups. The two-stop
  allowance is shared across line blockers, circular blockers and apertures;
  v12 admits exactly one triangular OR quadrilateral region, not one of each.
- Admitted source modes and the ordered validation-rule names for the complete
  system. Rule order is validation order, **never a ray route**.
- Which components an existing validator inspects. A validation subset does not
  remove anything from the canonical apparatus or its native compilation.

The canonical validator uses this catalog for model choices, source modes and
rule dispatch. Existing family geometry validators now consult the same count
rules. Geometry arithmetic, material checks, error messages and native physics
remain in their existing implementations. Historical v10 deliberately retains
its original staged rejection order, including the delegated polygon checks.

The authoring layer uses a declarative selector for NEW requests and publishes
`capabilities().composition`. Existing downloaded model context and CLI capability
output inherit that catalog. A caller cannot mutate the internal rules through a
capability response. `GENERAL_SCOPE` remains a backward-compatible per-component
capacity envelope derived from the profiles; its maxima are NOT permission to
combine components from incompatible optical families.

Parameter names and value bounds still come from the existing component contract.
The finite-region registry still supplies each shape's established geometry and
material validator. No duplicate physical-parameter schema or native compiler is
introduced. There is no runtime installation of arbitrary user-provided rules.

## Admission is not a single boolean shortcut

The stages remain distinct:

1. Validate explicit component fields, identities, units and source modes.
2. Apply the reviewed whole-system counts and ordered geometry/material rules.
3. Execute the entire accepted apparatus using unchanged native components.
4. Qualify only fresh, hash-matching, complete native observations.

Passing the count check does not prove valid separation, material consistency,
well-defined corner intersections or numerical completion. A source on a boundary
is still rejected. A valid full-Fresnel system can still truncate. An unsupported
conservative geometry guard is not a claim of physical impossibility.

`validateCompositionRules` resolves every named handler before dispatch, fails
closed for an unknown contract/missing handler, and stops on a validator failure.
The normal canonical boundary supplies the closed implementation table; scene
JSON cannot inject handler names or code.

## Authoring selection versus saved-model meaning

For minimal new requests, `selectAuthoringComposition` retains the established
component-based precedence. It returns a candidate model/version; the normal
canonical validator must still approve the complete apparatus. Selection does
not discard incompatible optics, invent physics or fall back to a looser profile
when validation fails. Names, titles and example filenames have no role.

Saved documents are validated under their declared contracts. This refactor does
not upgrade v10 when another mirror is added, reinterpret historical v8 prism
scenes as v12, or reset a one-mirror v11 structural branch back to v10. The existing
opt-in qualified v10-to-v11 upgrade remains the separate, hash-guarded operation
described in `COMPOSITION-CONTRACT-UPGRADE.md`.

Source provenance, retired IDs, stale-result suppression and physical approval
remain responsibilities of the existing qualified/exploration layers. The
registry neither certifies an LLM interpretation nor stores an execution result.

## What should require code, and what should require only JSON?

**Within a reviewed profile:** changing positions, orientations, material values,
source identities or permitted component counts should use ordinary apparatus
JSON and existing revision operations. No example-specific route or controller
may be added. Every variant still needs its own validation and native run.

**Outside a reviewed profile:** first establish the missing physics or geometry
rule, then add the smallest reusable rule/profile extension and physical tests.
Registration of two native component types does not establish compatibility of
all possible systems containing them. New nested-media or overlapping-boundary
semantics cannot be obtained merely by increasing a count limit.

File-format evolution and supported physics are distinct concerns. No new save
version is introduced for this refactor. Existing contracts stay immutable; any
future expansion must explicitly decide how its compatibility policy is identified
without silently broadening old saves. The catalog is a reusable admission
architecture, not a claim that arbitrary mixtures are already verified.

## Verification without replacing the physics

`test/composition-profiles.test.mjs` covers the 17 contracts, defensive capability
copies, version/source-mode isolation, whole-system group limits, closed ordered
rule dispatch, invalid geometry, qualified structural identity, incomplete and
stale evidence, and context export through the existing authoring API.

`test/fixtures/composition-profile-cases.json` contains seven explicitly specified
synthetic apparatus assemblies: lenses with two mirrors; aperture and detector;
planar refraction with mirror and detector; circular glass and detector; prism
with two mirrors; a nonrectangular quadrilateral with two mirrors; and curved
reflection with an external plane mirror and detector. They run through the
ordinary authoring/validation/native pipeline, without production example names.

`composition-profile-baseline.json` freezes canonical, native-object and full
execution-report fingerprints from retained, source-matched pre-refactor code at
`3d302858ae99b6afdef233d7459940baa09e79de`. Its source blob identities are recorded.
Do not refresh these fingerprints to hide a regression. Matching them establishes
behavior preservation, not independent physical correctness; the existing native
Snell/reflection and historical regression suites remain necessary.

Run `npm test` for the complete repository suite. Existing workflows also exercise
the browser, qualified upgrades and physical composition acceptance; no new
workflow or public deployment is required. Actual CI logs/artifacts, not this
architecture description, establish which checks ran. No independent LLM or
classroom evaluation is claimed.
