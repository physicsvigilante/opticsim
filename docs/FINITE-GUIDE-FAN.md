# Native fan through a finite dielectric guide

Use the explicit `native-finite-guide-fan-tracing` profile, schema v36. Give one directional point source, one homogeneous rectangular polygon dielectric and one vertical detector outside the right face. Order the corners bottom-left, bottom-right, top-right and top-left. The guide is 35–100 mm long and 15–35 mm high. Require exterior index 1, core index 1.2–1.6 and partial reflection disabled.

The source starts 1–5 mm before the entrance, at least 1 mm inside its transverse span. Its 10–30° cone lies within 82° of the forward axis. Use unsaturated source brightness and density 0.1–0.2. Every emitted sample needs a clear entrance. Place the detector 1–30 mm beyond the right face with length 10–150 mm.

Pinned AngleSource and Glass choose all rays and encounters. The audit tracks continuity until every emitted sample actually exits. It checks the finite face, signed Snell relation or total internal reflection, brightness channels and detector passivity. A sidewall-critical encounter, ambiguous vertex, unfinished ray, native warning, stop or truncation withholds all accepted results.

Request `guide-exit-counts` on the guide ID for sampled direct far-end exits, far-end exits after one or more total internal reflections and sidewall leakage. Detector crossings are independently measured. In the example all five samples reach the detector even though two leave through a sidewall. The counts describe a finite meridional section and its declared numerical sampling. The separate angular query handles the conditional A19 limit. [Native example](../examples/finite-guide-fan-v36.json) · [Frozen study](../evaluation/finite-guide-native-fan-study-v1/README.md) · [A19 angular query](PERPENDICULAR-DIELECTRIC-FACES.md)
