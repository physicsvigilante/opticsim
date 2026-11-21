# Real-object placements for a stated mirror magnification

Give a signed paraxial focal length. Positive means concave and negative means convex. A signed magnification includes orientation. A magnitude-only request evaluates both signs independently. Object distance is positive toward the incident-side real object.

For signed magnification m, the placement and conjugate are u = f(1 − 1/m) and v = f(1 − m). The shared mirror query verifies the recovered branch. A placement at the pole, a required virtual object or an unresolved distance remains explicit. If one sign yields a verified placement and the other remains numerically unresolved, the result retains the verified placement and reports partially indeterminate coverage.

A07 specifies magnitude four and focal length 10 cm. The upright virtual branch places the object at 7.5 cm and its image 30 cm behind the mirror. The inverted real branch places the object at 12.5 cm and its image 50 cm in front. Four finite native controls using the same spherical mirror compare both object placements at two source heights. [A07 request](../examples/mirror-magnification-a07.json) · [Frozen cases](../evaluation/mirror-magnification-inverse-v1/frozen.json)
