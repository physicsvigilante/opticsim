# Separate post-execution review of six original first requests

The first interpretations and requests were committed at
`cb9ad091bc2b93cee35b42dfb791f59d018b8cab`, before dispatcher execution.
This review is subsequent, by the same assistant, not independent adjudication.
No Solutions entry was read. No first request was repaired, no case replaced,
and no mathematical answer was inserted to make a native run pass.

| Case | What the image asks | Recorded outcome and limitation |
|---|---|---|
| U1 / plane mirror 015 | Initial incidence for two mirrors at 70° and a final ray parallel to mirror 1 | Unsupported requested inverse quantity. The engine has finite plane mirrors, but not this inverse angular operation. It is not a physically underdetermined question merely because our API lacks the operation. |
| U2 / curved mirror 013 | Image velocity components for a moving object near a concave mirror | Curved mirror plus differential image-motion analysis are not exposed. No plane-mirror replacement was made. |
| U3 / general refraction 012 | Trajectory/exit in continuously graded index sqrt(1+y), symbolic thickness d | Unsupported gradient-index and symbolic-trajectory capability. No finite layer approximation or invented y units were supplied. |
| U4 / TIR 010 | Condition to avoid TIR after entry into a half-cylinder | Full curved-surface question remains unavailable. An explicitly isolated flat-entry subproblem yields a conditional 30° internal angle, assuming external index 1. This is not a solution to the half-cylinder condition or evidence about the curved exit. |
| U5 / lens formula 027 | Symbolic focus from a parallel beam through two vertically displaced lenses | Decentered lenses, parallel-beam input and symbolic result are not exposed. The LLM did not force the axes into a coaxial model or replace the beam by a finite source. |
| U6 / instruments 009 | Telescope separation, refocus shift and angular magnifications | The requested instrument quantities are not exposed. The first notes flagged accommodation: a later reviewer should explicitly consider the conventional normal-adjustment interpretation; the note is a caveat, not proof the textbook problem is unsolvable. |

**No full original question is established by this trial.** Five requests
produce no supported answer; U4 supplies only an extra, explicitly limited
subresult. No native scene was proposed for any of these six requests. The
synthetic integration controls separately test actual native and mixed paths.

This is useful capability evidence but not six independently validated
interpretations, nor a claim of general LLM authoring accuracy. The full-path
exposure check cannot detect all earlier encounters with renamed or quoted
questions. The selection of highest-numbered questions deliberately remains
visible, because it can overrepresent advanced examples.

## Workload recorded, not advertised as token savings

There are six preserved first requests, zero automatic repairs, zero external
model calls, and no native-only geometry/brightness supplied. Only U4's
isolated subproblem has numeric analytical facts. The author did not supply
outgoing angles or solve the original requested unknowns. Numeric-input counts
and author-assumption counts are descriptive, not measured effort reductions.

## Direction supported by these observations

Do not add another orchestration layer merely to improve coverage statistics.
The smallest next reusable requested operation suggested by this sample is
plane-mirror angular constraints (U1): the native component already exists,
but the inverse result is missing. Curved mirrors/interfaces, gradient-index
media and decentered-lens/instrument analysis are separate larger gaps; they
should not be conflated with authoring-interface errors. These are priorities
for review, not features implemented by this PR.
