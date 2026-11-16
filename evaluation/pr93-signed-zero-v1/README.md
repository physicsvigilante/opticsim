# PR #93 signed-zero follow-up — separate disposable research

This intentionally separate **test-only** probe fixes the **interpretation** of independent Chat B PR #93 review N-01, not the reviewed PR #93 code or archive.

It pulls the **unchanged original** PR #92 native-capture artifact by run **43854663361**, verifies SHA-256 for all original JSON inputs, replays pinned `geometry.linesIntersection` expression order in actual JavaScript Number operations and Python in both original parsed-value and explicitly binary64-coerced variants. Each of the original 87 recorded callback points is uniquely grounded against archived authored y-up face vertices converted to native y-down. It separately reports signed-zero *bit* differences with **serialized JSON**, not unobserved original in-memory native signs. JavaScript's `JSON.stringify` itself does not preserve negative zero.

Expected reproducibility checks (from Chat B's independent review): 87 numerical equalities; 18 sign-only differences in original Python-vs-JSON, 12 in JavaScript-vs-JSON and explicitly normalized Python-vs-JSON; six Python-only zero cases at original ordinals 2,3,6,8,9,11, hit index 0. All assertions fail closed; hashes and all seven recorded failed native statuses remain untouched. This is a **same-assistant follow-up**, not independent validation of a solver change.

No new PhyDemo process or physical run is executed. Do not merge this draft/its temporary workflow, change the numerical cutoff, declare an incident-point tolerance, infer the true native pre-serialization zero signs, or impose Stage-2 withholding. Preserve original PR #93 immutable tested head `1346c4132382823dc81977e0b5964590f408bbd2` and its PASS with N-01.

Local use, with original three JSONs already extracted: `node evaluation/pr93-signed-zero-v1/replay.mjs INPUT_DIR /tmp/js.json && python3 evaluation/pr93-signed-zero-v1/compare.py INPUT_DIR /tmp/js.json`.
