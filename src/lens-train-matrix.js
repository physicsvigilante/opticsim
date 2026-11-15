// Shared ideal thin-lens calculation, extracted from analysis.js.
// Pure conditional mathematics: no scene construction or native ray generation.
// Callers validate and order lenses, and normalize all dimensions to millimetres.
export const LENS_INFINITY_TOLERANCE = 1e-10;
export const LENS_MAGNIFICATION_TOLERANCE = 1e-7;

/**
 * @param {number} objectX - Axial position in millimetres.
 * @param {Array<{x:number, focalLength:number}>} lenses - Increasing axial order.
 * @param {number|undefined} objectHeight - Omit when transverse output is unrequested.
 * @returns {{matrix:{a:number,b:number,c:number,d:number}, prediction:object}}
 */
export function calculateLensTrain(objectX, lenses, objectHeight) {
  // ABCD transfer matrix to immediately after the last lens. Arithmetic order
  // and legacy numerical thresholds are preserved, not replaced with a solver.
  let [a, b, c, d] = [1, 0, 0, 1];
  let x = objectX;
  for (const lens of lenses) {
    const gap = lens.x - x;
    [a, b] = [a + gap * c, b + gap * d];
    [c, d] = [c - a / lens.focalLength, d - b / lens.focalLength];
    x = lens.x;
  }
  const matrix = { a, b, c, d };
  const result = prediction => ({ matrix, prediction });
  const unavailable = () => result({ kind: 'unavailable', reason: 'The lens-train matrix is numerically unreliable at these parameters.' });
  if (![a, b, c, d].every(Number.isFinite)) return unavailable();
  const tolerance = LENS_INFINITY_TOLERANCE;
  if (Math.abs(d) <= tolerance * Math.max(1, Math.abs(b) / 100)) return result({ kind: 'at-infinity', tolerance });
  const distance = -b / d;
  // det(M)=1 implies magnification=1/D, checked against A+z*C for cancellation.
  const magnification = 1 / d, checkMagnification = a + distance * c;
  const imageX = x + distance;
  // No invented zero height when only longitudinal facts were supplied.
  const imageY = objectHeight === undefined ? undefined : magnification * objectHeight;
  if (![distance, magnification, checkMagnification, imageX].every(Number.isFinite) ||
      (imageY !== undefined && !Number.isFinite(imageY)) ||
      Math.abs(checkMagnification - magnification) > LENS_MAGNIFICATION_TOLERANCE * Math.abs(magnification)) return unavailable();
  return result({ kind: distance >= 0 ? 'finite-real' : 'finite-virtual', x: imageX,
    ...(imageY === undefined ? {} : { y: imageY }), distance, magnification });
}
