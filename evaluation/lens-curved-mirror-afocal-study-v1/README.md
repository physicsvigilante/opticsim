# Two mirror placements for a parallel return

Lens Problem 012 gives a positive lens of focal length 1 m and a concave mirror of radius 1 m. Under the coaxial paraxial model, let d be the lens-to-mirror pole distance, f the lens focal length, and R the positive concave radius magnitude. A horizontal input ray of height h reaches the mirror at height h(1−d/f). Applying the reflection and the second pass through the same lens gives final travel slope −2h(1−d/f)[1/f+(1−d/f)/R]. The two zero-slope placements are d=f and d=f+R.

With the mirror pole at the first focus, the returning rays exchange transverse sides. With its centre of curvature at the first focus, they retrace. A parallel output corresponds to an axial image at infinity for the stated parallel input. An independently positioned finite object would require an object distance.

Commit `f94e628` froze the [source, three mirror placements, four launch heights and tolerances](frozen.json) before the pinned native tests ran. At input height +4 mm, the 1 m and 2 m placements returned to the lens at −4 mm and +4 mm. The final slopes toward the source were 0 and approximately −4×10⁻¹⁵. The 1.5 m control returned at −1.999980 mm with slope +0.001999988. Each of the twelve rays crossed the detector on the way in and out, with one native ArcMirror encounter between two encounters on the same IdealLens.

Run `node scripts/build.mjs --test` and `node --test test/lens-curved-mirror-afocal-study.test.mjs` for the raw event records at each sampled height.
