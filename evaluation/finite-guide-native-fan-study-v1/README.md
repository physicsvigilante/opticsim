# Native fan through a finite meridional guide

The Problems-only A19 source motivates the angular limit. It does not supply guide length, guide height or emitter geometry. The [frozen trial](frozen.json) gives those explicit synthetic inputs for a 2D homogeneous Glass rectangle with the same exterior on all sides.

The noncritical controls record three rays exiting through the far end after three or four total internal reflections and two leaking through a sidewall. Every emitted heading is replayed with its own pinned SingleRay. The proof compares real encounter points, order and branch directions. The critical control records the actual outcome separately and withholds whole-fan qualification.

The first checker incorrectly assumed that sidewall leakage would miss the downstream detector. With the frozen geometry, a leaking ray can reach that detector through exterior air. The corrected check uses the sidewall callback, the outgoing direction from Snell's law and the finite detector span. A downstream crossing alone does not establish which face a ray exited. No public authoring contract is extended in this study.
