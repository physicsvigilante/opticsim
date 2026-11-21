// v22: strict JEE-first finite native Beam + native Glass triangle.
// This is geometry/admission ONLY. PhyDemo owns all refractions, total
// internal reflections, native misses and every finite detector crossing.
import {compositionCountsMatch} from './composition-profiles.js';
import {parallelBeamGeometry,parallelBeamSamples,BEAM_CLEARANCE_MM} from './parallel-beam.js';
import {prismFaces,prismVertices} from './triangular-prism.js';
import {PRISM_BEAM_VERTEX_CLEARANCE_MM,PRISM_BEAM_CRITICAL_SIN_MARGIN} from './prism-beam-qualification.js';
export {PRISM_BEAM_VERTEX_CLEARANCE_MM,PRISM_BEAM_CRITICAL_SIN_MARGIN};

export const PRISM_BEAM_VERSION=22;
export const PRISM_BEAM_MODEL='native-parallel-prism-tracing';
const world=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
const refuse=(fail,path,message)=>fail(path,message,'UNSUPPORTED_SCOPE');

export function validateNativePrismBeam(components,model,rayDensity,mirrorEndpoints,fail){
 const path='$.physics.components';
 if(model!==PRISM_BEAM_MODEL||!compositionCountsMatch(components,model,PRISM_BEAM_VERSION))
   refuse(fail,path,'v22 admits exactly one finite native Beam, one real Glass triangle and 0-2 downstream passive detectors; no other optics.');
 const g=components.find(c=>c.type==='triangular-prism').parameters;
 const vertices=prismVertices(g),faces=prismFaces(g);
 // Only the first narrow family: a VERTICAL flat entrance face and
 // a strictly right-facing finite apex. Explicit indices and all vertices
 // remain author-controlled; no inferred JEE material or angle.
 if(g.x1!==g.x2||g.y2-g.y1<2||g.x3-g.x1<1||
    !(g.y3>g.y1+1&&g.y3<g.y2-1))
   refuse(fail,path,'v22 requires vertices 1->2 to form a vertical upward flat entrance; vertex 3 must be a strictly rightward apex between the two base endpoints with >=1 mm geometric margins.');
 const cross=(a,b)=>a.x*b.y-a.y*b.x;
 const ab={x:vertices[1].x-vertices[0].x,y:vertices[1].y-vertices[0].y};
 const ac={x:vertices[2].x-vertices[0].x,y:vertices[2].y-vertices[0].y};
 const twiceArea=Math.abs(cross(ab,ac));
 if(vertices.some(v=>!world(v))||faces.some(f=>!Number.isFinite(f.length)||f.length<1||
    twiceArea/f.length<1))
   refuse(fail,path,'All three finite prism vertices must lie within +/-10000 mm; every native face and triangle altitude must be >=1 mm.');
 if(g.partialReflection!==false)
   refuse(fail,path,'Explicit Fresnel-off partialReflection=false is required in v22. Native TIR is never disabled.');
 if(!(g.insideIndex>g.outsideIndex))
   refuse(fail,path,'The admitted teaching geometry requires explicit insideIndex > outsideIndex; no medium is assumed.');
 const beam=components.find(c=>c.type==='parallel-beam').parameters;
 if(beam.directionDeg!==0)
   refuse(fail,path,'v22 admits only native horizontally rightward parallel rays entering the flat diameter; oblique/mirrored entries need separate native evidence.');
 const geometry=parallelBeamGeometry(beam),ends=[geometry.p1,geometry.p2];
 if(beam.width<10||beam.width>100||ends.some(v=>!world(v)||
    g.x1-v.x<BEAM_CLEARANCE_MM||
    v.y-g.y1<=PRISM_BEAM_VERTEX_CLEARANCE_MM||
    g.y2-v.y<=PRISM_BEAM_VERTEX_CLEARANCE_MM))
   refuse(fail,path,'The entire emitting segment must be within world bounds, at least 0.01 mm before the flat face and more than 0.1 mm from both flat-face endpoints.');
 if(!Number.isFinite(rayDensity)||rayDensity<.048||rayDensity>1||beam.brightness>rayDensity)
   refuse(fail,'$.simulation.rayDensity','Native density .048-1 and brightness <= density are mandatory; no saturated native samples.');
 const samples=parallelBeamSamples(beam,rayDensity);
 if(samples.length<1||samples.length>100)
   refuse(fail,path,'Native Beam requires 1–100 samples and a sample factor clear of a half-integer threshold.');
 // Only the ORIGINAL straight sample paths are screened. We do NOT
 // calculate outgoing Snell, TIR, or a prescribed route in admission.
 // Subsequent actual onRayIncident vertex ambiguity is rejected by the
 // v22-only 0.1-mm native Prism callback guard (historical v8 remains 0.01 mm).
 // Native critical-angle risk within dimensionless 1e-5 is independently
 // withheld at each actual Glass encounter; no alternate Snell ray is traced.
 if(samples.some(v=>vertices.some(q=>q.x>=v.x&&
    Math.abs(v.y-q.y)<=PRISM_BEAM_VERTEX_CLEARANCE_MM)))
   refuse(fail,path,'A deterministic initial ray can strike a triangle vertex within 0.1 mm (including the forward apex); shift/resize the explicit Beam.');
 const detectorComponents=components.filter(c=>c.type==='ray-detector');
 for(const c of detectorComponents){
   const detector=c.parameters,d=mirrorEndpoints(detector),ix=components.indexOf(c);
   if(![90,-90].includes(detector.orientationDeg)||
      d.some(q=>!world(q)||q.x-g.x3<BEAM_CLEARANCE_MM))
     refuse(fail,path+'['+ix+']','v22 detector must be a finite vertical segment wholly beyond the triangle apex with >=0.01 mm clearance; missed rays and zero native crossings are permitted.');
 }
 if(detectorComponents.length===2&&
   Math.abs(detectorComponents[0].parameters.x-detectorComponents[1].parameters.x)<BEAM_CLEARANCE_MM)
   refuse(fail,path,'Two downstream detectors must have distinct planes separated by at least 0.01 mm.');
}
