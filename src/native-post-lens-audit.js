import geometry from '../vendor/ray-optics/src/core/geometry.js';
import {postLensWitness,onArm,ENDPOINT_MM,SECTION_BUDGET_MM} from './post-lens-aperture.js';

// Effective lines and contacts come from this run's own native instances.
// Project an already-selected lens output for qualification only.
export function installPostLensAudit(doc,scene,idMap) {
  const parts=doc.physics.components;
  const w=postLensWitness(parts,doc.simulation.rayDensity);
  const native=type=>scene.objs[idMap.get(parts.find(c=>c.type===type)?.id)];
  const lens=native('ideal-lens'),stop=native('finite-aperture');
  const detector=w.detector && native('ray-detector');
  const lowerArm={p1:stop.p1,p2:stop.p3},upperArm={p1:stop.p2,p2:stop.p4};
  const nativeEdges=[stop.p1,stop.p2,stop.p3,stop.p4].map(p=>-p.y).sort((a,b)=>a-b);
  const lensY=[],stopY=[],detectorY=[],absorptions=[],crossings=[];
  let fault=null;
  const limit=w.samples.length;
  function add(list,y) {
    if(list.length>=limit || !Number.isFinite(y))throw Error('Missing or excess native geometry');
    list.push(y);
  }
  function project(ray,segment,x) {
    const p=geometry.linesIntersection(ray,segment);
    if(!(Math.abs(p.x-x)<=SECTION_BUDGET_MM)||!Number.isFinite(p.y)||!geometry.intersectionIsOnRay(p,ray))
      throw Error('Uncertain forward native section');
    return -p.y;
  }
  function checkStop(y) {
    if(nativeEdges.some(e=>Math.abs(y-e)<=ENDPOINT_MM))throw Error('Native aperture endpoint uncertainty');
  }
  function checkDetector(y) {
    if([detector.p1,detector.p2].some(p=>Math.abs(y+p.y)<=ENDPOINT_MM))throw Error('Native detector endpoint uncertainty');
  }
  function observe(target,after) {
    const previous=target.onRayIncident;
    target.onRayIncident=function(...args) {
      const result=previous.apply(this,args);
      try { after(args[0],args[2],result); } catch(error) { fault??=error.message; }
      return result;
    };
  }
  observe(lens,(ray,p)=>{
    const y=-p.y;
    if(!(Math.abs(p.x-w.lens.x)<=SECTION_BUDGET_MM)||!(ray.p2.x>ray.p1.x)||
        !(w.lens.apertureHeight/2-Math.abs(y)>ENDPOINT_MM))throw Error('Native finite lens rim or direction uncertainty');
    add(lensY,y);
    const a=project(ray,lowerArm,w.stop.x),b=project(ray,upperArm,w.stop.x);
    checkStop(a);checkStop(b);
    if(Math.abs(a-b)>SECTION_BUDGET_MM || onArm(a,nativeEdges)!==onArm(b,nativeEdges))
      throw Error('Native aperture supporting lines disagree');
    // Use the corresponding arm's native operand order when there is a hit.
    const section=geometry.intersectionIsOnSegment(geometry.linesIntersection(ray,upperArm),upperArm)?b:a;
    add(stopY,section);
    if(detector && !onArm(section,nativeEdges)) {
      const d=project(ray,detector,w.detector.x);
      checkDetector(d);add(detectorY,d);
    }
  });
  observe(stop,(_ray,p,result)=>{
    const y=-p.y;
    checkStop(y);
    if(result?.isAbsorbed!==true || !(Math.abs(p.x-w.stop.x)<=SECTION_BUDGET_MM) || !onArm(y,nativeEdges))
      throw Error('Unconfirmed native aperture arm absorption');
    add(absorptions,y);
  });
  if(detector)observe(detector,(_ray,p)=>{
    const y=-p.y;checkDetector(y);
    if(!(Math.abs(p.x-w.detector.x)<=SECTION_BUDGET_MM) || !(Math.abs(y-w.detector.y)<w.detector.length/2))
      throw Error('Unconfirmed finite detector crossing');
    add(crossings,y);
  });
  function agree(a,b,budget) {
    if(a.length!==b.length)return false;
    const sorted=v=>[...v].sort((x,y)=>x-y);
    const ref=sorted(b);
    return sorted(a).every((y,i)=>Math.abs(y-ref[i])<=budget);
  }
  return function finish(emitted) {
    if(fault)return fault;
    const expected=w.samples;
    const detectorHits=detectorY.filter(y=>Math.abs(y-w.detector.y)<w.detector.length/2);
    if(emitted!==limit || !agree(lensY,expected.map(s=>s.y),SECTION_BUDGET_MM) ||
        !agree(stopY,expected.map(s=>s.atStop),SECTION_BUDGET_MM) ||
        !agree(detectorY,expected.map(s=>s.atDetector).filter(y=>y!==null),SECTION_BUDGET_MM) ||
        !agree(absorptions,stopY.filter(y=>onArm(y,nativeEdges)),0) || !agree(crossings,detectorHits,0))
      return 'v28 native finite lens, aperture or detector evidence disagrees with its sampled cross-section';
    return null;
  };
}
