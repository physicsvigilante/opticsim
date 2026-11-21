// Ray directions are normalized in y-up. Detector endpoints are native y-down.
// Read native power before delegation and compare after its own integration.
export function expectedDetectorPower(detector,ray,direction){
  const tangentX=detector.p2.x-detector.p1.x;
  const tangentY=detector.p2.y-detector.p1.y;
  const sign=Math.sign(direction.x*tangentY+direction.y*tangentX);
  const power=ray.brightness_s+ray.brightness_p;
  return sign&&power>0&&Number.isFinite(power)?detector.power+sign*power:NaN;
}

export function preservesDetectorPassage(detector,ray,point,result,expected){
  return Number.isFinite(expected)&&Math.abs(detector.power-expected)<=1e-9&&
    Math.hypot(ray.p1.x-point.x,ray.p1.y-point.y)<=1e-6&&
    !result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length;
}
