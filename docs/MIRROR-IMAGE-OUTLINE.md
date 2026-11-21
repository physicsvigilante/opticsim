# Projecting an ordered outline through a concave mirror

The input fixes the pole as origin. Positive axial distance runs toward the object and positive transverse height runs upward. For an object point (u,h), the first paraxial concave mirror image is (fu/(u−f), −fh/(u−f)). Adopt one focal length and one unit for a complete authored outline.

The numeric query accepts a strictly convex ordered polygon of three to six labelled vertices, all beyond the focal plane and within the paraxial height bounds. It preserves vertex identities and edge order. The coordinate map is projective, so it takes straight edges to straight edges when the outline stays in the admitted axial domain. A degenerate, near-singular or crossed outline is withheld.

For A09 the drawing supplies order and shape rather than absolute dimensions. A and D stay on the axis. E and B appear below it. Relative to A, D was nearer to the mirror and therefore images farther away. E's side is taller in the source and has the larger magnification magnitude, so E's image is farther below the axis than B's image. The image is an inverted trapezoid between the focus and centre, with its end edges parallel. These relations also handle initially equal-height ends. [A09 request](../examples/mirror-outline-a09.json)

The numerical controls trace each corner as its own native source run with a pinned ArcMirror. Their outgoing detector lines provide local checks against the conditional vertex locations. The source text gives none of those verification dimensions. [Frozen protocol](../evaluation/mirror-image-outline-v1/frozen.json)
