// JEE-first v23: bounded finite native parallel Beam plus real CircleGlass.
// Admission and observation qualification only. The pinned PhyDemo engine
// chooses ALL actual refractions, TIR, misses, and detector crossings.
import {compositionCountsMatch} from './composition-profiles.js';
import {circularExtents,circularEncounter} from './circular-dielectric.js';
import {parallelBeamGeometry,parallelBeamSamples,BEAM_CLEARANCE_MM} from './parallel-beam.js';

export const CIRCLE_BEAM_VERSION=23;
export const CIRCLE_BEAM_MODEL='native-parallel-circle-tracing';
export const CIRCLE_BEAM_INITIAL_TRANSVERSE_FRACTION=.9;
export const CIRCLE_BEAM_NATIVE_RADIAL_TOLERANCE_MM=1e-5;
export const CIRCLE_BEAM_CRITICAL_MARGIN=1e-5;
export const CIRCLE_BEAM_GRAZING_COSINE=1e-4;
const finite=Number.isFinite;
const world=q=>finite(q.x)&&finite(q.y)&&Math.abs(q.x)<=10000&&Math.abs(q.y)<=10000;
const refuse=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');
const cross=(a,b)=>a.x*b.y-a.y*b.x;
const dot=(a,b)=>a.x*b.x+a.y*b.y;

// A real native CircleGlass incident at a measured point. This never
// reassigns the hit, reclassifies the native outgoing branch, or creates
// rays. Unlike v7, v23 explicitly refuses bad-circle-position callbacks,
// numerically grazing interfaces and exit-side critical ambiguity.
export function circleBeamNativeEncounter(component,nativePoint,incoming){
 const e=circularEncounter(component,nativePoint,incoming);
 const p=component.parameters,point=e.point,n=e.normal;
 const radial=Math.hypot(point.x-p.x,point.y-p.y);
 const incomingValid=incoming&&finite(incoming.x)&&finite(incoming.y);
 const cosine=incomingValid?dot(incoming,n):NaN;
 const nearCritical=incomingValid&&e.incidentIndex>e.destinationIndex&&
    Math.abs(e.incidentIndex*Math.abs(cross(incoming,n))-e.destinationIndex)<=
      CIRCLE_BEAM_CRITICAL_MARGIN;
 const invalid=!finite(radial)||Math.abs(radial-p.radius)>CIRCLE_BEAM_NATIVE_RADIAL_TOLERANCE_MM||
   !finite(n.x)||!finite(n.y)||!finite(cosine)||
   Math.abs(cosine)<CIRCLE_BEAM_GRAZING_COSINE||nearCritical;
 return {...e,invalid,radialResidualMm:radial-p.radius,nearCritical:!!nearCritical};
}

export function validateCircleBeam(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(model!==CIRCLE_BEAM_MODEL||!compositionCountsMatch(components,model,CIRCLE_BEAM_VERSION))
   refuse(fail,path,'v23 admits exactly one true native Beam, one CircleGlass and 0–2 finite external detectors; no other optical objects.');
 const c=components.find(x=>x.type==='circular-dielectric').parameters;
 if(c.radius<20||circularExtents(c).some(q=>!world(q)))
   refuse(fail,path,'The entire real circular region must be within +/-10000 mm with explicit radius at least 20 mm.');
 if(c.partialReflection!==false)
   refuse(fail,path,'v23 requires explicit partialReflection=false. Native TIR remains active; Fresnel weak branches are not admitted.');
 const b=components.find(x=>x.type==='parallel-beam').parameters;
 if(![0,180,-180].includes(b.directionDeg))
   refuse(fail,path,'v23 initially admits only horizontal forward/reverse parallel beams, not oblique illumination.');
 const g=parallelBeamGeometry(b),ends=[g.p1,g.p2],sign=b.directionDeg===0?1:-1;
 const enteringX=c.x-sign*c.radius;
 if(b.width<10||b.width>100||ends.some(e=>!world(e)||
   sign*(enteringX-e.x)<BEAM_CLEARANCE_MM||
   Math.abs(e.y-c.y)>=c.radius*CIRCLE_BEAM_INITIAL_TRANSVERSE_FRACTION))
   refuse(fail,path,'The complete emitter must fit the world, start at least 0.01 mm before the near circle boundary, and remain inside the central 90% impact-parameter strip.');
 if(!finite(rayDensity)||rayDensity<.048||rayDensity>1||b.brightness>rayDensity)
   refuse(fail,'$.simulation.rayDensity','Sampling density must be .048–1 and Beam brightness <= density.');
 const samples=parallelBeamSamples(b,rayDensity);
 if(!samples.length||samples.length>100)
   refuse(fail,path,'Only 1–100 actual native deterministic Beam emissions are admitted.');
 for(const s of samples){
   const tangentSine=Math.abs(s.y-c.y)/c.radius;
   // Necessary *first-surface* Snell admission only, not predicted
   // propagation. An outside-higher-index Beam reaching a lower-index
   // circle can undergo TIR before entry; this first iteration refuses
   // that risk instead of silently treating it as a transmitted sample.
   if(c.outsideIndex>c.insideIndex&&
      c.outsideIndex*tangentSine>=c.insideIndex-CIRCLE_BEAM_CRITICAL_MARGIN)
      refuse(fail,path,'A sampled first encounter is at/near/beyond the entry critical condition; v23 refuses uncertain entry TIR rather than inventing transmission.');
 }
 const detectors=components.filter(x=>x.type==='ray-detector');
 for(const d of detectors){
   const p=d.parameters,segment=mirrorEndpoints(p),idx=components.indexOf(d);
   if(![90,-90].includes(p.orientationDeg)||
      segment.some(q=>!world(q)||sign*(q.x-(c.x+sign*c.radius))<BEAM_CLEARANCE_MM))
     refuse(fail,path+'['+idx+']','v23 detector must be a finite vertical line fully beyond the far side of the circle with at least 0.01 mm clearance.');
 }
 if(detectors.length===2&&
    Math.abs(detectors[0].parameters.x-detectors[1].parameters.x)<BEAM_CLEARANCE_MM)
   refuse(fail,path,'Two distinct downstream detector planes need >=0.01 mm separation.');
}
