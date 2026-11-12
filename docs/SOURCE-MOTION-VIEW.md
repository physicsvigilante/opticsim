# Moving-source camera correction

The original motion page fit only the nearby apparatus. U2's source begins 25 cm in front of the mirror but the conditional image begins 100 cm away and moves farther out; the native ray intersection was outside the camera. The separate coordinate plot also used fixed U2-specific limits.

The default **Whole motion** camera now fits the physical optical endpoints, all sampled source positions, and every supported finite calculated image over the entire experiment. Its scale and centre stay fixed during playback, so camera motion does not disguise physical motion. **Current frame** fits the selected instant; **Apparatus close-up** deliberately omits the image, with an explicit notice. Resizing refits presentation only.

A dashed image guide is drawn on a separate annotation canvas using the **actual loaded native Scene transform**. It labels an analytical point; it is not a simulated source, synthetic ray, or claim of native image detection. For circular mirrors it remains a paraxial guide, not an assertion that finite-aperture native rays share an exact focus. The separate diagram also uses adaptive limits and equal x/y scale.

The accepted baseline, experiment hash, ray brightness, aperture, velocity, sampling and native ray budgets remain unchanged. Camera choice is a transient UI preference. Static scene exports still retain the accepted frame's saved presentation; they do not capture this transient viewport. Frame evidence includes the actual display camera separately.

The fit obeys existing camera limits (zoom 0.03–10 and centre coordinates within ±10000 mm). Finite images beyond ±10000 mm are excluded from automatic range selection and explicitly reported when off-screen. Infinity and indeterminate calculations never create a finite guide or connect across a singularity. No claim is made about fitting singularities between discrete sampled times.

Regression coverage includes all 61 U2 time samples for ideal/circular mirrors at wide and phone-sized viewports, actual native coordinate-transform checks, camera-mode switching, unchanged native observations, immutable baselines and focal/near-focal cases. The portable package is rebuilt in CI and tested directly from file://; no public deployment or upstream physics edit is involved.
