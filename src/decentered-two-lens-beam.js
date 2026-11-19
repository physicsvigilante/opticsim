// Bounded v20 native Beam plus two independently centred vertical IdealLens
// instances. This validates finite geometry; it never traces or changes rays.
import {compositionCountsMatch} from './composition-profiles.js';
import {parallelBeamGeometry,parallelBeamSamples,BEAM_CLEARANCE_MM} from './parallel-beam.js';

export const DECENTERED_BEAM_VERSION=20;
export const DECENTERED_BEAM_MODEL='native-parallel-two-lens-tracing';
const within=n=>Number.isFinite(n)&&Math.abs(n)<=10000;
const rimDistance=(y,lens)=>Math.abs(Math.abs(y-lens.y)-lens.apertureHeight/2);
const intercepted=(y,lens)=>Math.abs(y-lens.y)<lens.apertureHeight/2;
const refuse=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');

// Admission-only thin-lens ordinates guard near-rim/near-tip ambiguity for
// the sampled horizontal Beam. They are NOT an alternate native tracer or
// an observed/predicted image; finite lens misses remain unprescribed.
export function validateDecenteredTwoLensBeam(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(model!==DECENTERED_BEAM_MODEL||!compositionCountsMatch(components,model,DECENTERED_BEAM_VERSION))
  refuse(fail,path,'v20 admits one native Beam, exactly two vertical offset ideal lenses and 0–2 downstream detectors. No other optics.');
 const beam=components.find(c=>c.type==='parallel-beam').parameters;
 if(![0,180,-180].includes(beam.directionDeg))
  refuse(fail,path,'Beam must travel horizontally at 0, +180 or -180 degrees.');
 const dir=beam.directionDeg===0?1:-1,g=parallelBeamGeometry(beam);
 if(beam.width<10||beam.width>100||![g.p1,g.p2].every(p=>within(p.x)&&within(p.y)))
  refuse(fail,path,'Whole emitting segment must fit world bounds, with width 10–100 mm.');
 if(!Number.isFinite(rayDensity)||rayDensity<.048||rayDensity>1||beam.brightness>rayDensity)
  refuse(fail,'$.simulation.rayDensity','Beam must have density .048–1 and brightness no greater than density.');
 const samples=parallelBeamSamples(beam,rayDensity);
 if(!samples.length||samples.length>100)
  refuse(fail,path,'Only 1–100 native deterministic Beam samples are admitted.');
 const lenses=components.filter(c=>c.type==='ideal-lens')
   .sort((a,b)=>dir*(a.parameters.x-b.parameters.x));
 const [first,second]=lenses.map(c=>c.parameters);
 for(const c of lenses){
  const l=c.parameters,ix=components.indexOf(c);
  if(!within(l.x)||!within(l.y-l.apertureHeight/2)||!within(l.y+l.apertureHeight/2))
   refuse(fail,path+'['+ix+'].parameters','Both offset lens endpoints must be within world bounds.');
  if([g.p1,g.p2].some(e=>dir*(l.x-e.x)<BEAM_CLEARANCE_MM))
   refuse(fail,path,'Both lens planes must be ahead of the entire emitter with 0.01 mm clearance.');
 }
 const gap=dir*(second.x-first.x);
 if(gap<BEAM_CLEARANCE_MM)
  refuse(fail,path,'Distinct lens planes need at least 0.01 mm separation.');
 const clearances=[];
 for(const sample of samples){
  const y1=sample.y;
  if(rimDistance(y1,first)<=BEAM_CLEARANCE_MM)
   refuse(fail,path,'A native sample approaches the first lens rim within 0.01 mm.');
  const slope1=intercepted(y1,first)?-(y1-first.y)/first.focalLength:0;
  if(Math.abs(slope1)>1)
   refuse(fail,path,'First-lens high-angle propagation exceeds the bounded clearance policy.');
  const y2=y1+gap*slope1;
  if(rimDistance(y2,second)<=BEAM_CLEARANCE_MM)
   refuse(fail,path,'A possibly refracted sample approaches the second lens rim within 0.01 mm.');
  const slope2=slope1-(intercepted(y2,second)?(y2-second.y)/second.focalLength:0);
  if(Math.abs(slope2)>1)
   refuse(fail,path,'Second-lens high-angle propagation exceeds the bounded clearance policy.');
  clearances.push({y2,slope2});
 }
 for(const c of components.filter(c=>c.type==='ray-detector')){
  const p=c.parameters,line=mirrorEndpoints(p),ix=components.indexOf(c);
  if(![90,-90].includes(p.orientationDeg)||
     !line.every(v=>within(v.x)&&within(v.y)&&dir*(v.x-second.x)>=BEAM_CLEARANCE_MM))
   refuse(fail,path+'['+ix+']','v20 detectors must be finite vertical segments at least 0.01 mm after both lenses.');
  const travel=dir*(p.x-second.x);
  for(const ray of clearances){
   const arrival=ray.y2+travel*ray.slope2;
   if(Math.abs(Math.abs(arrival-p.y)-p.length/2)<=BEAM_CLEARANCE_MM)
    refuse(fail,path,'A propagated sample approaches a detector endpoint within 0.01 mm.');
  }
 }
}
