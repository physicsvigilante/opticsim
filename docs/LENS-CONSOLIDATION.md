# Lens-draft reconciliation — 13 November 2026

## One candidate, not two overlapping implementations

The starting points are PR #30 head
`4470c49a3d2d2c17f0909a02f74725631798cb94` and PR #29 head
`e4e741c729a377963d00bbc8f85b411c34a7db3c`, both based on main
`be2009616d8ef541e5f9d0962afdea5d352ae705` after merging #27 then #28.
Continue integration in #30. Do not also merge #29's alternative motion
implementation. Its branch/history remains available; no history rewrite or
branch deletion is necessary. The consolidated candidate still requires
separate merge approval. No main merge or public website is part of this work.

## Deliberate choices

| Concern | Retained decision |
|---|---|
| Optical scope | #30: exactly one fixed ideal lens and one moving source; no lens detectors or added optics. |
| Motion/player/camera/export | #30's existing shared implementation; no new schema or player. |
| Example | #30's explicitly synthetic 61-frame, 3-second focal crossing; do not relabel #29's different example as an original question. |
| Aperture controls | #29's generic optical field plus curved-mirror-only historical alias, and matching shared UI. |
| Native tests | Retain #30 checks and incorporate #29's actual per-instance lens-hit observer. |
| Analytical tests | Both sides of focus, negative f, off-axis product rule, exact focus and unresolved near-focus states. |
| Integrity/player tests | Preserve old mirror behavior; test lens tampering, ambiguous aperture edits, snapshots and the same player. |
| Evaluation | Copy the two #29 first-attempt records and its replay script as the exact original Git blobs. Add a pinned-byte regression and exposure note. |

#29's broader optional lens-detector proposal and parallel analytical module
are NOT imported. They are not needed to prove reuse with a second optical
family. This is a bounded capability, not arbitrary moving optical systems.
The upstream pin, native core, canonical scene schemas, source archives and
all previously integrated sealed evaluations are unchanged.

## A numerical correction found during review

The static ABCD lens prediction uses a tolerance band for its infinity result.
The previous motion adapter displayed every such state as exact infinity.
It now distinguishes the exactly represented single-lens focal condition
from a nonzero focal gap within the existing unresolved band. Near-focus
states withhold image position and velocity as numerically indeterminate.
The same static threshold remains authoritative; no finite fallback is added.

## Less duplicated CI, without deleting coverage

The existing source-motion workflow now includes lens acceptance and the
preserved historical trial replay. Remove the separate thin-lens workflow,
which otherwise repeats setup, the complete Node suite and all three motion
browser suites. Run once per main-targeted PR update, not both feature push
and PR; also run after a main push. Concurrency cancels superseded PR motion
runs only. Retain all other optical-family workflows and their checks.
This is a targeted reduction, not a claim that repository-wide CI is optimal.
Use one atomic branch update for the reconciliation rather than triggering
CI separately for every edited file. Motion artifact retention is 7 days.

## Next milestone: first-attempt authoring, not more controls

After the consolidated implementation is reviewed and integrated, select new
questions before viewing them, exclude every recorded prior case (including
PR #29's three paths), freeze the candidate code and capability description,
and seal each first interpretation before deterministic execution. Preserve
missing facts, unsupported results and failed native runs without repair.
Keep analytical answers, native execution, interpretation fidelity and
illustrative completeness separate. Do not invent source brightness,
apertures or apparatus merely to force a supported scene.

Replaying #29 is historical regression evidence, not a fresh unseen trial.
Using this same assistant is not an independent-model evaluation. Independent
inference and adjudication need their own recorded protocol; neither is
claimed by this consolidation. No Solutions are read here.

## Public-repository note

Repository visibility was changed by the owner. This work does not change
visibility, enable Pages, add credentials, or publish an external model key.
The existing problem ZIPs are part of the repository and are therefore also
public; confirm that their public distribution is intended and permitted.
No archives or Git history are automatically removed by this code change.
