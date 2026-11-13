# Previously seen curved-mirror Problems — separate follow-up

These are same-assistant development follow-ups, not a blind test or independent accuracy score. No Solutions images were opened. The original U2 first request in `unified-workflow-v1/first-attempt.json` remains unchanged.

Direct reinspection of the original images corrected two uncommitted draft transcription mistakes: B03 is **u=1.5f and object height 2.5 cm**, not u=f/2. B04 is **harmonic motion x=f cos(omega t) about the centre of curvature**, not uniform motion from the focus. The committed follow-up records use the actual image statements. Do not treat a software regression as validation of an unchecked transcription.

## U2 — instantaneous image velocity

Under a stationary mirror, fixed f=20 cm and Gaussian/paraxial mapping, u=25 cm and object height initially zero. The object moves upward and toward the mirror at 5 cm/s at 45 degrees. With local positive axial coordinate away from the mirror and positive transverse upward, du/dt=-5/sqrt(2) and dy/dt=+5/sqrt(2). The engine calculates v=100 cm, m=-4, axial image velocity +40 sqrt(2) cm/s (away) and transverse velocity -10 sqrt(2) cm/s (down). These are conditional instantaneous image kinematics, not a native moving-image observation or a propagation-delay calculation.

## B03 — normalized position, dimensional object height

The object is at u/f=1.5, height 2.5 cm. The deterministic result is m=-2, image height -5 cm (5 cm magnitude, inverted), v/f=3 and a real image. No absolute f, scene brightness or mirror aperture is invented.

## B04 — symbolic oscillation remains outside numeric scope

From the declared coordinate origin, u/f=2+cos(omega t). Separate mathematical review gives v/f=(2+cos(omega t))/(1+cos(omega t)); the object and its Gaussian image coincide at the centre of curvature (x=0, cos(omega t)=0). These symbolic expressions are review reasoning, NOT output of an arbitrary symbolic solver.

The engine records the full symbolic request as unavailable. A separately labelled part-(c) request uses the declared half-period to obtain u/f=1 and returns image-at-infinity with no finite magnification. This does not count as solving the complete three-part original problem. Native finite-aperture circular rays can aberrate; the paraxial singularity is not proof that all native rays are parallel.
