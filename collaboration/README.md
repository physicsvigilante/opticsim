# Two-ChatGPT collaboration for Opticsim

This is the shared handoff folder for TWO SEPARATE ChatGPT conversations working through the same GitHub repository.

- **Chat A — implementer:** design, edits, PR publication, tests, responses to findings.
- **Chat B — reviewer:** a fresh chat, reads a pinned GitHub commit and a fixed review packet, independently inspects source and evidence, submits findings. No implementing or merging as part of the first review.
- **Owner:** chooses what to pursue and separately authorizes merges.
- **Deterministic CI:** verifies the exact code; neither assistant may claim its own inspection is an independent LLM review.

No model API, webhook, autonomous agent, new provider, GitHub Actions automation, or Opticsim physics changes are needed. GitHub is the shared persistence layer. Both chats use the same GitHub repository; the reviewer should not receive Chat A's private conversational reasoning or a proposed verdict. A fresh chat is context-separated, not necessarily a different model or an independent human physics expert.

## Entry points

1. Read [REVIEW-PROTOCOL.md](REVIEW-PROTOCOL.md).
2. Choose a frozen review request in [review-packets/](review-packets/).
3. Open the corresponding REVIEWER-PROMPT.md in Chat B. The review should inspect the **pinned head SHA**, not floating main, latest PR state, or the implementer's summary alone.
4. Chat B writes a report using [REVIEW-REPORT-TEMPLATE.md](REVIEW-REPORT-TEMPLATE.md), in a new GitHub branch/PR under `collaboration/review-results/<packet-id>/` (preferable), or initially posts the complete report as a comment on the reviewed PR with a link and a stable review ID. A GitHub review comment is not a committed folder file.
5. Chat A reads the report from GitHub, verifies/reproduces findings, fixes defects on the feature branch, reruns exact-source CI, and requests a fresh review when the head SHA changes.
6. Only the owner authorizes merging.

## Review packets

- [PR #75 native detector-hit measurements](review-packets/pr-75/REQUEST.md): ready for Chat B's first review; **no independent Chat B verdict recorded yet**.

The existing Opticsim source/physical rules in `AGENTS.md` are authoritative. This folder is coordination material, not a new Opticsim runtime contract. Do not rewrite a first-attempt report to match later corrections.
