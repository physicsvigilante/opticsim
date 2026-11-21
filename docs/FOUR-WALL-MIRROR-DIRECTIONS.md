# Launch directions in a rectangular mirror box

Use a two-dimensional rectangle with bottom-left origin, width W and height H. Both endpoints A and B lie strictly inside the four ideal specular walls. The requested ray reflects once from each wall.

Two reflections in x and two in y unfold B into four possible translated copies B + (±2W, ±2H). The vector from A to each copy specifies a forward direction. In the numeric workflow the equation of this unfolded line orders the four crossings. Folding each crossing into the original rectangle recovers its boundary point. A tie is an exact corner hit. A contact within 10⁻¹⁰ of its wall length from an endpoint withholds the numerical branch and leaves coverage incomplete. Each accepted reverse direction is the negative of the corresponding forward direction and reverses its wall order.

For A04 the source gives no numeric coordinates or dimensions. The symbolic request gives the four directional constructions with corner conditions. The separate numeric controls choose explicit A and B, use genuine finite PhyDemo mirrors with corner gaps, and observe one actual absorbing target at the end of each independent run. [A04 request](../examples/four-wall-mirror-a04.json) · [Frozen native trials](../evaluation/four-wall-mirror-directions-v1/frozen.json)
