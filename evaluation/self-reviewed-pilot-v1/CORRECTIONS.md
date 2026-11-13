# Corrections before the approved merge

The questions and first-attempt blobs remain byte-for-byte frozen. This review fixes evidence handling, not the original attempts or native physics.

1. Raw-response files previously appended a newline while their digest covered the unmodified string. They now contain exactly the bytes covered by the recorded digest.
2. Native-count discrepancies previously appeared only as a flag, while the same row could still be labelled supported. Expected-count failure now blocks the supported outcome and increments an explicit mismatch count. Evidence completion and evaluation outcome remain separately reported.
3. Readings previously used quantity kind as a dictionary key, losing identity when more than one component shared that kind. The report now preserves request ID, kind and component ID; ambiguous shorthand comparisons fail closed.
4. The evidence directory now uses the existing fresh-directory/symlink guard before any writes. Reference bytes also receive a SHA-256 provenance record.

Claim correction: these two positive scenes substantially reuse geometries already exercised by project fixtures. New wording does not make them unseen problems or establish generalization. The historical model label and reference-secrecy field in the frozen payload are author-supplied metadata, not independently verified model identity or proof of blinding. A later real-problem trial must preserve its own selection, attempts and post-attempt review separately.
