# Three-lens relay with unchanged axial image position

Lens Problem 016 specifies focal lengths 4a, a, 4a and gaps 4a with a positive scale a. In coordinates (y/a, dy/dx), a translation of length 4a adds four times the slope to the normalized height. Each thin lens subtracts its normalized height divided by its focal-length coefficient from the slope. The product between the outer lens planes has rows (−1,−8) and (0,−1). Applying it to a ray and extrapolating its emerging line gives the initial object x and the negative of its initial height.

Changing only the middle focal length to 2a gives rows (−1,0) and (0,−1). Transverse magnification is still −1 but the image moves downstream by 8a. This control distinguishes an unchanged image size from an unchanged axial position.

The [protocol](frozen.json) was frozen at `babf066` before native runs. It fixes a=25 mm for the finite experiment. Each of sixteen independent SingleRay rays crossed all three native IdealLens instances and a downstream detector. Each pair of measured lines was extended backward to its virtual image. Across the two object positions, two signed heights, and both arrangements, all eight estimated images satisfied the predeclared axial and transverse limits. The general position statement follows from the paraxial matrix; the native evidence covers the sampled objects and apertures.

Run `node scripts/build.mjs --test` and `node --test test/three-lens-relay-study.test.mjs` for fresh detector records.
