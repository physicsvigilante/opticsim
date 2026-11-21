# Finite conjugates of spherical thick lenses

Commit `2ed1512` froze three synthetic controls before the native run. Moving a finite object toward the first lens changes its real conjugate to a virtual one. Adding a separated second lens tests composition across four refracting surfaces and an air gap. Each distance is signed from the last rear pole along the common positive x axis.

Run `node scripts/build.mjs --test` and `node --test test/thick-lens-finite-conjugate-study.test.mjs`. Each control uses two object heights and three independent single-ray runs per height. Each ray transmitted at both spherical faces of every authored lens and reached the detector once. The test intersects pairs of measured outgoing lines, extending them backward for the virtual conjugate. These intersections estimate the paraxial image from samples.

Across 18 pairwise estimates from 18 native runs, the largest axial difference from the frozen prediction was 0.01546 mm. The largest transverse difference was 0.00002809 mm. The predeclared limits were 0.08 mm and 0.001 mm respectively. These results apply to the sampled heights, slopes and geometries. Each run writes callback evidence under a fresh directory in `test-artifacts/llm-authoring/`.
