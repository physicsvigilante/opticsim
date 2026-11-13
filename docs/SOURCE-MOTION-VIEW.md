# Moving-source camera correction

The original motion page fit only the nearby apparatus. U2's source begins 25 cm in front of the mirror but the conditional image begins 100 cm away and moves farther out; the native ray intersection was outside the camera. The separate coordinate plot also used fixed U2-specific limits.

The default **Whole motion** camera now fits the physical optical endpoints, all sampled source positions, and every supported finite calculated image over the entire experiment. Its scale and centre stay fixed during playback, so camera motion does not disguise physical motion. **Current frame** fits the selected instant; **Apparatus close-up** deliberately omits the image, with an explicit notice. Resizing refits presentation only.

A dashed image guide is drawn on a separate annotation canvas using the **actual loaded native Scene transform**. It labels an analytical point; it is not a simulated source, synthetic ray, or claim of native image detection. For circular mirrors it remains a paraxial guide, not an assertion that finite-aperture native rays share an exact focus. The separate diagram also uses adaptive limits and equal x/y scale.

The accepted baseline, experiment hash, ray brightness, aperture, velocity, sampling and native ray budgets remain unchanged. Camera choice is a transient UI preference. Static scene exports still retain the accepted frame's saved presentation; they do not capture this transient viewport. Frame evidence includes the actual display camera separately.

The fit obeys existing camera limits (zoom 0.03–10 and centre coordinates within ±10000 mm). Finite images beyond ±10000 mm are excluded from automatic range selection and explicitly reported when off-screen. Infinity and indeterminate calculations never create a finite guide or connect across a singularity. No claim is made about fitting singularities between discrete sampled times.

Regression coverage includes all 61 U2 time samples for ideal/circular mirrors at wide and phone-sized viewports, actual native coordinate-transform checks, camera-mode switching, unchanged native observations, immutable baselines and focal/near-focal cases. The portable package is rebuilt in CI and tested directly from file://; no public deployment or upstream physics edit is involved.


## Reusable zoom and pan — not a U2 calculation

Every supported source-motion experiment uses the same presentation pipeline:

`collectMotionView(experiment)` gathers finite optics, source and calculated
image positions; `fitMotionView(..., mode)` finds a scene-independent
automatic camera; `applyMotionCameraControl(fit, control)` applies bounded
manual zoom/pan. These pure functions depend on accepted component geometry,
not a problem number or authored velocity. There is **no U2-specific zoom
constant**, fabricated scene dimension, new optical component, or image-detection
claim.

The motion page provides **+ / −**, a zoom percentage relative to the chosen
automatic fit (**100% means Fit**, not an absolute laboratory magnification),
and **Fit** to reset manual adjustments. Wheel/trackpad zoom holds the point
under the pointer fixed, and dragging either the native ray panel or the
conditional coordinate diagram pans the view. Each input is bounded; apparent
image positions that become offscreen after a manual zoom are labelled offscreen
rather than clamped onto a misleading marker.

Manual relative zoom and world-coordinate pan persist when moving between
time samples, so the whole-motion mode retains a stable camera during playback.
Changing an automatic camera mode deliberately returns to its new fitted view.
Window resizing reapplies the same relative adjustments at the new aspect
ratio. The default opening still fits the whole sampled motion when supported.

Camera inputs only modify a temporary rendering copy and can cause the *same*
native frame to be retraced for display. They do not alter source motion,
the accepted scene, stationary optical aperture, ray-emission policy, numerical budgets,
experiment identity, qualified static-scene exports or conditional formulas.
Frame evidence records the temporary display adjustment separately.

The generalization strategy is to add **small validated capabilities per
new problem family**: motion laws, observable calculations and supported native
geometry evolve separately, while camera/presentation and provenance remain
shared. For now the physics scope is still one uniformly translating source
and either a stationary curved mirror (canonical v6) or a stationary ideal
thin lens (canonical v4), with optional passive detectors. The same camera
fits the lens's existing finite aperture endpoints as it does curved-mirror
endpoints, and includes supported finite real and virtual image points while
withholding infinity. More general movement
or optical combinations must be designed and tested when new examples justify
them; camera zoom does not imply support for arbitrary moving apparatus.

Regression cases exercise generic non-U2 point sets, wheel anchoring,
pan geometry, fitting bounds, native/analytical agreement, time-scrubbing
invariance, responsive layouts and actual Chrome interactions. A successful
display check alone never certifies a textbook interpretation.
