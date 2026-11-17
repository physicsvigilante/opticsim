// Opt-in statistics from ALREADY OBSERVED native detector crossings.
// No ray intersections, source ancestry, brightness weighting, extrapolation,
// image finding, path pairing or change to the pinned PhyDemo simulator.
// Crossings in opposite directions are NEVER combined into a fake spot.
import {mirrorEndpoints} from './contract.js';

export const DIRECTIONAL_FOOTPRINT_METHOD='native-detector-directional-footprint';
const EVENT_LIMIT=32;
const ENDPOINT_MM=.01;
const POSITION_RESIDUAL_MM=1e-5;
const UNIT_TOLERANCE=1e-7;
const GRAZING_DIRECTION=1e-8;

const finite=Number.isFinite;
const unavailable=reasonCode=>({status:'unavailable',reasonCode,value:null});
function statistics(distances,p1,tangent){
 const count=distances.length;
 if(count===0)return {count:0,minDistanceFromP1Mm:null,maxDistanceFromP1Mm:null,
  meanDistanceFromP1Mm:null,meanPointMm:null,spanMm:null,rmsSpreadMm:null};
 // Native events are retained only up to 32: arithmetic is bounded and uses
 // mean-centered residuals, never E[x^2]-E[x]^2 cancellation.
 const min=Math.min(...distances),max=Math.max(...distances);
 const mean=distances.reduce((s,x)=>s+x,0)/count;
 const variance=distances.reduce((s,x)=>s+(x-mean)*(x-mean),0)/count;
 return {count,minDistanceFromP1Mm:min,maxDistanceFromP1Mm:max,
  meanDistanceFromP1Mm:mean,
  meanPointMm:{x:p1.x+tangent.x*mean,y:p1.y+tangent.y*mean},
  spanMm:max-min,rmsSpreadMm:Math.sqrt(variance)};
}

export function directionalDetectorFootprint(sample,detectorParameters){
 if(!sample||sample.status!=='complete'||!Array.isArray(sample.events)||
   !Number.isInteger(sample.observedCount)||sample.observedCount!==sample.events.length||
   sample.events.length>EVENT_LIMIT||sample.limit!==EVENT_LIMIT)
  return unavailable('MISSING_COMPLETE_NATIVE_DETECTOR_HITS');
 const [p1,p2]=mirrorEndpoints(detectorParameters),dx=p2.x-p1.x,dy=p2.y-p1.y;
 const length=Math.hypot(dx,dy);
 if(!(finite(length)&&length>2*ENDPOINT_MM))
  return unavailable('INVALID_DETECTOR_GEOMETRY');
 const tangent={x:dx/length,y:dy/length},
  normal={x:-tangent.y,y:tangent.x};
 const positive=[],negative=[];
 for(const e of sample.events){
  const x=e?.pointMm?.x,y=e?.pointMm?.y;
  const ux=e?.incomingUnit?.x,uy=e?.incomingUnit?.y;
  const along=e?.distanceFromP1Mm;
  if(![x,y,ux,uy,along].every(finite)||
    !(along>=ENDPOINT_MM&&length-along>=ENDPOINT_MM)||
    Math.abs(Math.hypot(ux,uy)-1)>UNIT_TOLERANCE)
   return unavailable('INCONSISTENT_NATIVE_DETECTOR_EVENT');
  // Confirm the native point still lies on the same finite physical segment
  // after snapshot/replay. Do not "repair" a contradictory event.
  if(Math.hypot(x-(p1.x+tangent.x*along),y-(p1.y+tangent.y*along))>
    POSITION_RESIDUAL_MM)
   return unavailable('INCONSISTENT_NATIVE_DETECTOR_EVENT');
  const direction=ux*normal.x+uy*normal.y;
  if(!finite(direction)||Math.abs(direction)<=GRAZING_DIRECTION)
   return unavailable('UNRESOLVED_GRAZING_DETECTOR_DIRECTION');
  (direction>0?positive:negative).push(along);
 }
 const value={observedCount:sample.events.length,detectorLengthMm:length,
  detectorNormalUnit:normal,
  towardPositiveNormal:statistics(positive,p1,tangent),
  towardNegativeNormal:statistics(negative,p1,tangent)};
 if(value.towardPositiveNormal.count+value.towardNegativeNormal.count!==value.observedCount)
  return unavailable('INCONSISTENT_NATIVE_DETECTOR_EVENT');
 return {status:'complete',reasonCode:null,value};
}
