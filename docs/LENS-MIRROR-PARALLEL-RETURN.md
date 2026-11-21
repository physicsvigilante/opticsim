# Lens-to-mirror spacings for parallel return

`parallel-return-mirror-placements` finds the axial mirror positions that return a parallel beam through the same positive ideal thin lens. Declare a facing concave mirror, a common axis in air, the lens focal length f and the mirror's positive radius magnitude R. Each input spans 1–10000 mm in a common unit. Output gaps are measured from the lens plane to the mirror pole.

* At d=f, the first lens focus lies on the mirror pole. Rays return through the lens with transverse height −h for input height h.
* At d=f+R, the first lens focus lies at the mirror's centre of curvature. Rays retrace with transverse height +h.

Both placements give a paraxial image at infinity for the stated axial collimated input. The returned height scale refers to the lens plane. A finite object's conjugate requires a different request. The [source example](../examples/lens-mirror-parallel-return.json) gives 1 m and 2 m. The [frozen native study](../evaluation/lens-curved-mirror-afocal-study-v1/README.md) measures both branches and an intermediate nonparallel control with finite native components.
