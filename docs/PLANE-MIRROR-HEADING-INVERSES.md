# Incidence from headings and inclination from crossed mirror constraints

The two queries use versioned angular facts in the public problem workflow. Mirror extent and location are absent from those facts. Finite interception requires separate evidence.

For one mirror, the given incoming and outgoing vectors are normalized. Their difference lies along the mirror normal. If the shortest angle between the directions is D, the unsigned incidence from the normal is (180° − D)/2. Equal and nearly equal unit directions with a chord at most 1e-9 leave the inferred normal numerically indeterminate. Opposed directions give normal incidence. [A01 request](../examples/mirror-incidence-a01.json)

For two nonparallel mirrors, the first tangent defines 0°, the second tangent is θ, and the endpoint line constraints give p and q of 0° or 90°. The incoming heading relative to the first mirror is θ + p modulo 180°. The two reflections give an outgoing heading of 3θ + p modulo 180°. Solve 3θ = q − p modulo 180°, keep both directed incident headings and withhold branches that graze either mirror. Reflector ordering is a condition of this calculation.

For the parallel constraints in A02, the unsigned angle between the mirrors is 60°. The shortest heading deviation has magnitude 120°. The two individual turns have magnitudes of 120° each, totaling 240° along the two turns. The result exposes both measures and keeps the signs for each directional branch. [A02 request](../examples/two-mirror-inclination-a02.json)

The frozen Problems-only cases supply the scope of these claims. Five native controls use separate finite PhyDemo scenes and record the actual reflection order, incoming and outgoing headings, and eventual absorption by a finite target. [Frozen record](../evaluation/plane-mirror-heading-inverses-v1/frozen.json)
