# Sampled transmission past a downstream finite aperture

Set `physical.model` to `native-post-lens-aperture-tracing` in a problem request. Schema and adapter version 28 admit one rightward horizontal deterministic Beam, one ideal lens centered at y = 0, one finite vertical aperture after the lens, and zero or one finite vertical detector farther downstream. Positive and negative focal lengths are supported. Consecutive planes require at least 1 mm separation. Unmarked requests keep their historical selection, including v19’s downstream-stop refusal. Qualified edits retain the declared schema.

The example supplies synthetic dimensions, brightness, and sampling explicitly. Run the public authoring workflow in a fresh evidence directory:

```sh
node scripts/run-problem.mjs examples/native-post-lens-aperture-v28.json --out test-artifacts/llm-authoring/my-post-lens-example
```

In the example the Beam emits eight samples. With f = +100 mm the downstream stop absorbs four and the detector receives four. Changing f to −100 mm gives six absorptions and two crossings. A finite stop also allows rays to pass beyond its outer ends. Detector counts alone cannot distinguish passage through the gap from passage outside the stop. Native relative power and sampled counts do not establish continuous throughput, diffraction, or a detected image.

## Geometry and qualification

Width is 10–100 mm, density 0.048–1, and relative brightness may not exceed density. Admission reuses the corrected native Beam sampler and its half-integer exclusion. Every emitted sample must meet the finite lens, with post-lens slope magnitude at most one. For each parallel incident sample at lens ordinate y, its necessary ordinate at a farther plane a distance d away is y(1−d/f). The lens rim, all four stop endpoints, and either detector endpoint for surviving samples require more than 0.1 mm clearance plus a 0.001 mm numerical reserve.

PhyDemo selects all interactions. On terminal completion, a scene-local audit checks native lens incidents and outgoing ray sections against admission. It evaluates the two native aperture arm supporting lines separately and checks actual absorption callbacks, detector hits and misses. Its bounded temporary arrays do not enter the portable package. Failed, incomplete, stale, or unverified execution withholds requested measurements. An optional detector position list above the existing 32-hit cap is withheld in full. A complete count can still be read.

The frozen feasibility protocol and its raw native results remain separate from public authoring. See [the experiment](../research/native-post-lens-aperture/README.md) and [the public example](../examples/native-post-lens-aperture-v28.json).
