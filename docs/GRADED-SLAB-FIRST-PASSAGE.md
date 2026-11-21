# First passage across a graded-index slab

Give the squared-index law n² = A + y/L, where y is the inward distance from a flat entrance. The positive tangent axis x lies along both parallel faces, with the entry point as origin. Give both exterior indices. A finite incidence is measured from the inward normal. The separately declared grazing case is a limit of inward trajectories.

Tangential invariance conserves q = nEntry sin i through refraction and propagation. For q > 0, dy/dx = √(A + y/L − q²)/q. The forward solution is y = √(A − q²)x/q + x²/(4q²L). At matched grazing entry the linear term vanishes. The eikonal equation gives an immediate inward change of normal momentum because ∂n/∂y is positive at entry, fixing the limiting branch of the first-order equation. For q = 0 the path stays on x = 0.

At thickness d, the first far-face coordinate is x = 2qd/[√(A + d/L − q²) + √(A − q²)]. This expression avoids cancellation. Outgoing transmission, critical proximity and TIR are classified at that encounter using the same conserved q and the separately supplied exit index.

For A15, the symbolic option measures x and y in units of L and keeps d/L unspecified. With A = 1 and both exteriors of index one, y/L = (x/L)²/4 and the first far-face point is (2√(d/L), d/L). The far-side direction is critical. The native controls run finite entry angles with two Euler steps and inspect actual GrinGlass and detector callbacks. The v25 authoring and numerical restrictions still govern public native GRIN. [A15 request](../examples/graded-slab-a15.json) · [Frozen controls](../evaluation/graded-slab-first-passage-v1/frozen.json)
