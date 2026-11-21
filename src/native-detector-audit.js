// Ray directions are normalized in y-up. Detector endpoints are native y-down.
// Snapshot the point and both polarization channels before native integration.
export function expectedDetectorPassage(detector,ray,direction,point){
  const tangentX=detector.p2.x-detector.p1.x;
  const tangentY=detector.p2.y-detector.p1.y;
  const sign=Math.sign(direction.x*tangentY+direction.y*tangentX);
  const brightnessS=ray.brightness_s,brightnessP=ray.brightness_p;
  const power=brightnessS+brightnessP;
  const expectedPower=sign&&brightnessS>=0&&brightnessP>=0&&power>0&&Number.isFinite(power)?
    detector.power+sign*power:NaN;
  return {power:expectedPower,brightnessS,brightnessP,x:point.x,y:point.y};
}

export function preservesDetectorPassage(detector,ray,point,result,expected){
  return Number.isFinite(expected.power)&&Math.abs(detector.power-expected.power)<=1e-9&&
    point.x===expected.x&&point.y===expected.y&&Math.hypot(ray.p1.x-expected.x,ray.p1.y-expected.y)<=1e-6&&
    ray.brightness_s===expected.brightnessS&&ray.brightness_p===expected.brightnessP&&
    !result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length;
}
