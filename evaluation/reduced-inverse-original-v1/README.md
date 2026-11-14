# Six new original archive problems — reduced inverse scope audit

This is a **same-assistant development evaluation**, not an independent or new held-out model benchmark. It measures **the applicability of the two registered reduced-inverse quantity kinds** from Milestone 28 to a preselected sample of actual user-supplied optics textbook problems. Selection is not based on whether the new formula succeeds.

## Immutable chronology
1. Freeze six original Problems paths in Git `65ae404522f6015c09496c885ae106c4661f33ab`, excluding **all 40 atlas-reviewed entries** and the preceding **ten original trial paths**. For each of plane-reflection, curved-reflection and lens chapters, take the first and middle remaining lexicographic paths.
2. Extract **only those six Problems PNGs** from source archive `08_Ray_Optics_Explanations.zip` pinned by SHA-256 `03fa29dc8a09f157692ea389354bc7393a96e49f792b60329164c03e56bc5939`, via source-only workflow `43551695262`.
3. Freeze the unaltered six first responses and their precise original requested kinds in Git `dd5a095bf3dc9ac8f68cf6bed6aba68cccfa9aec` — before opening the solutions. First attempts include separate same-assistant manual mathematics, **never** an Opticsim-native answer.
4. Open the six matched Solutions only after the transfer workflow `43552028543` checks frozen Git ancestry and byte equality. Store solution hashes and post-solution review separately. Do not alter original first attempts.
5. Remove the temporary branch transfer workflow before PR review/merge. Ordinary CI reads **Problems images only** and replays the six exact submitted requests without answer substitution, repairs or native simulation.

## Outcome

The six preselected originals cover two unknown-incidence/reflection or finite observer-visibility tasks, two displaced/graphical curved-mirror tasks, and two silvered-thin-lens composition/proof tasks. **None directly asks for the two newly registered reduced-inverse v1 results from the provided facts.** Hence the truthful v1 numerical interface applicability is **0/6**. The original tasks were submitted as explicitly unregistered descriptions; the CLI reports **0/6 results available from those submissions, zero native calls**, and no qualified native scene. This is **not** proof that every alternative analytical formulation is impossible: existing mirror-angle query capabilities may overlap the two-bounce setup but are not evaluated by this inverse-v1-only audit.

Separate post-solution review recorded **3 manual agreements**, **1 physical agreement with opposite signed focal convention**, **1 partial graphical construction**, and **1 derivation of a formula that is already printed in the question**. These are not successes from the Opticsim execution engine or independent LLM accuracy. V05's first focal-length magnitude `15 cm` and concave classification correspond to the solution's Cartesian `F=-15 cm`; similarly V06's given positive magnitude differs from the key's signed representation.

## Implications for architecture

- A general point-reflection calculation can check a single finite hit. It does not solve **a continuous observer visibility interval**, even in 2D. Treat that as a distinct mathematical reduction if separately justified.
- Two rotated mirrors with **unknown inclination** cannot be solved by a point-reflection calculation that requires a declared tangent. Existing mirror-angle capabilities deserve independent suitability testing.
- Off-axis **displaced mirror halves** and graphical pole/focus construction need explicit geometric constraints; do not extract physical lengths from uncalibrated diagram pixels.
- A **silvered lens** is combined refraction and reflection, not an ordinary lens or mirror. Any new analytical result must use an explicit thin/paraxial model, sign conventions and tests rather than quietly replacing optics with a proxy.
- More sample breadth is useful, but it must remain a frozen, unselected-by-success collection. An unregistered request is lack of a registered method, **not** a claim about fundamental physics.

## Reproduce
```sh
npm run setup
npm test
node evaluation/reduced-inverse-original-v1/replay.mjs
```

The replay uses the existing `runProblemEvidence`, preserved input bytes and source-image SHA checks, and stores evidence in the ignored `test-artifacts/llm-authoring/reduced-inverse-original-v1` directory. It neither opens Solutions nor executes a separate LLM or PhyDemo ray simulation. No changes to engine pin, physics objects, public deployment, old first attempts, or source archives.
