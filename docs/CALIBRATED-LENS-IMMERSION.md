# Focal length after a change of medium

Use `immersed-lens-focal-length` for one lens whose signed focal length is known in a reference exterior. Declare the unchanged thin-lens shape, material index, reference exterior index and signed focal length, and one to four target media with unique IDs. Request each target separately using `mediumId`. Each exterior must occupy both sides of the lens.

For lens index g, reference index r, target index t and reference focal length f, the target focal length is f(t/r)(g−r)/(g−t). This follows by eliminating the common curvature difference from the two lensmaker equations. A positive result converges and a negative one diverges. The matched target is afocal. A finite calibration in a matched reference is inconsistent.

Absolute indices range from 1 to 4. The reference focal magnitude spans 1–10000 mm, expressed in mm, cm or m. Calculations compare exact fractions of the represented inputs. Nonzero index contrasts within a relative 1e−10 band and focal distances beyond 10⁹ mm are withheld. Near matching in the reference affects the whole calibration. Near matching in a target affects that target alone.

The [Problem 005 example](../examples/calibrated-lens-immersion.json) treats the glass as a paraxial thin lens and air as having unit index. It gives +90 cm in the first medium and −102 cm in the second. The [frozen native controls](../evaluation/calibrated-lens-immersion-v1/README.md) separately compare actual finite-thickness detector intercepts against finite-thickness predictions.
