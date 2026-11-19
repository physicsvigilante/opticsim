// v24: a strictly bounded JEE curved-entry observation apparatus.
// Reuses the exact native semicircular Glass, SingleRay, Detector and Blocker.
// It neither traces nor prescribes refracted rays, images, or native outcomes.
// A real full flat back face remains in the Glass, behind the absorbing screen.
import {compositionCountsMatch} from './composition-profiles.js';
import {SEMICIRCULAR_TYPE,semicircularExtents} from './semicircular-dielectric.js';

export const CURVED_ENTRY_VERSION=24;
export const CURVED_ENTRY_MODEL='native-curved-entry-observation-tracing';
export const CURVED_ENTRY_BOUNDARY_CLEARANCE_MM=1;
export const CURVED_ENTRY_MIN_RADIUS_MM=50;
export const CURVED_ENTRY_MAX_RADIUS_MM=1000;

const world=n=>Number.isFinite(n)&&Math.abs(n)<=10000;
const refuse=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');

// Validates authored geometry only. No Snell ray, route, focal point, or
// downstream hit is calculated in this validator. The native engine may
// still MISS a detector or screen; a qualified zero is not an image.
export function validateCurvedEntryObservation(components,model,rayDensity,endpoints,fail){
 const path='$.physics.components';
 if(model!==CURVED_ENTRY_MODEL||
  !compositionCountsMatch(components,model,CURVED_ENTRY_VERSION))
  refuse(fail,path,'v24 requires exactly one single-ray point source, one right semicircular Glass region, two internal vertical detectors and one internal opaque line blocker. No other optics.');
 const g=components.find(c=>c.type===SEMICIRCULAR_TYPE),p=g.parameters;
 const R=p.radius;
 if(R<CURVED_ENTRY_MIN_RADIUS_MM||R>CURVED_ENTRY_MAX_RADIUS_MM||
  semicircularExtents(p).some(q=>!world(q.x)||!world(q.y)))
  refuse(fail,path,'The full right semicircle must lie in-world with radius 50-1000 mm.');
 if(p.partialReflection!==false)
  refuse(fail,path,'The initial v24 contract requires Fresnel-off; native TIR is retained.');
 if(!(p.insideIndex>p.outsideIndex))
  refuse(fail,path,'The v24 curved entry is explicitly from lower-index exterior to higher-index interior.');
 const src=components.find(c=>c.type==='point-source'),s=src.parameters;
 if(src.emission.mode!=='single-ray'||![180,-180].includes(src.emission.directionDeg))
  refuse(fail,path,'A single real native ray directed horizontally from right to left (±180°) is required.');
 if(src.emission.angleDeg!==30)
  refuse(fail,path,'Inactive single-ray angleDeg must be the canonical explicit 30° placeholder, not a hidden illumination cone.');
 if(s.x<p.x+R*1.2||s.x>p.x+R*4||
  Math.abs(s.y-p.y)>R*.08||!world(s.x)||!world(s.y))
  refuse(fail,path,'The real source must be right of the curved pole by 0.2R-3R and within ±0.08R of the axis.');
 // Only initial *unrefracted* straight geometry is checked. In this narrow
 // near-axis range, the left-going ray first meets the curved right-hand arc.
 const xArc=p.x+Math.sqrt(R*R-(s.y-p.y)**2);
 if(s.x-xArc<10)
  refuse(fail,path,'The source must be safely separated from the true curved arc.');
 const stop=components.find(c=>c.type==='line-blocker'),dets=
  components.filter(c=>c.type==='ray-detector').sort((a,b)=>b.parameters.x-a.parameters.x);
 const inner=(c,role)=>{
  const q=c.parameters,i=components.indexOf(c);
  const where=path+'['+i+'].parameters';
  if(![90,-90].includes(q.orientationDeg)||q.y!==p.y)
   refuse(fail,where,role+' must be a vertical segment exactly centred on the material axis.');
  if(q.length<R*.5||q.length>R*1.4)
   refuse(fail,where,role+' must have a finite length between 0.5R and 1.4R.');
  const [a,b]=endpoints(q);
  if([a,b].some(z=>!world(z.x)||!world(z.y)||
     z.x<=p.x+CURVED_ENTRY_BOUNDARY_CLEARANCE_MM||
     Math.hypot(z.x-p.x,z.y-p.y)>=R-CURVED_ENTRY_BOUNDARY_CLEARANCE_MM))
   refuse(fail,where,role+' must lie fully inside true glass with at least 1 mm clearance from BOTH flat and curved boundaries.');
 };
 inner(stop,'Absorbing screen');
 for(const d of dets)inner(d,'Passive detector');
 const bx=stop.parameters.x;
 if(bx<p.x+.2*R||bx>p.x+.5*R)
  refuse(fail,path,'Absorber must be placed in the internal 0.2R-0.5R band, ahead of the retained flat face.');
 if(dets.some(d=>d.parameters.x<p.x+.55*R||d.parameters.x>p.x+.9*R))
  refuse(fail,path,'The two passive detector planes must lie in the internal 0.55R-0.9R band.');
 if(dets[0].parameters.x-dets[1].parameters.x<Math.max(1,.05*R)||
   dets[1].parameters.x-bx<Math.max(1,.05*R))
  refuse(fail,path,'The two detectors and absorber require at least max(1 mm, 0.05R) ordered axial separation.');
 // Normal numeric gate remains shared with the other public contracts.
 if(!Number.isFinite(rayDensity)||rayDensity<.048||rayDensity>1)
  refuse(fail,'$.simulation.rayDensity','The existing real sampling density must be .048-1.');
}

export function curvedEntryCapabilities(){
 return {schemaVersion:CURVED_ENTRY_VERSION,model:CURVED_ENTRY_MODEL,
  composition:'one exact single-ray point source, one native right semicircular Glass, two passive internal detectors, one opaque internal line blocker',
  boundary:'Entire native right half-disk including flat face; real native absorption, not an open spherical interface',
  entrance:'single right-to-left near-axis ray from the exterior to denser glass, ±180°',
  radiusMm:[CURVED_ENTRY_MIN_RADIUS_MM,CURVED_ENTRY_MAX_RADIUS_MM],
  insideMedium:'explicit 1-4 index, strictly above explicitly declared exterior index',
  detectorPositions:'two vertical internal planes at 0.55R-0.9R to the right of flat face',
  screenPosition:'vertical internal absorber at 0.2R-0.5R to the right of flat face',
  measured:['native first-face and count','native detector crossings and bounded hit events','native blocker absorptions'],
  limitations:[
   'Native ray propagation decides all actual intersections; neither this contract nor its tests prescribe a path.',
   'The true flat glass boundary remains intact; if rays reach it, the run is not single-entry evidence.',
   'No physical focal-plane hit, Gaussian image, ray-field completeness, source attribution or 3D visibility is established.',
   'Opaque screening is a declared teaching control and alters the physical system.',
   'No Fresnel partial reflection; native total internal reflection remains active.'
  ]};
}
