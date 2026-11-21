// Snapshot the point and both polarization channels before native integration.
// Callers derive the sign from their authored detector orientation and branch.
export function expectedDetectorPassage(detector,ray,point,previousPower,sign){
  const brightnessS=ray.brightness_s,brightnessP=ray.brightness_p;
  const power=brightnessS+brightnessP;
  const expectedPower=detector.power===previousPower&&brightnessS>=0&&brightnessP>=0&&power>0&&Number.isFinite(power)?
    previousPower+sign*power:NaN;
  return {power:expectedPower,brightnessS,brightnessP,x:point.x,y:point.y};
}

export function preservesDetectorPassage(detector,ray,point,result,expected){
  return Number.isFinite(expected.power)&&detector.power===expected.power&&
    point.x===expected.x&&point.y===expected.y&&ray.p1.x===expected.x&&ray.p1.y===expected.y&&
    ray.brightness_s===expected.brightnessS&&ray.brightness_p===expected.brightnessP&&
    !result?.isAbsorbed&&!result?.isUndefinedBehavior&&!result?.newRays?.length;
}
