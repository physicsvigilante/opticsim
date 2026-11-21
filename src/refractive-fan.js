import {compositionCountsMatch} from './composition-profiles.js';

export const REFRACTIVE_FAN_MODEL='native-refractive-fan-tracing';
const rad=Math.PI/180;
const cap=100;
const critical=(p,sine)=>Math.abs(p.negativeIndex*Math.abs(sine)-p.positiveIndex)<=1e-6;

// Admission witnesses only. The pinned AngleSource creates every simulated ray.
function sampleAngles(emission,density){
  const half=emission.angleDeg*rad/2;
  const step=2*Math.PI/Math.floor(density*500);
  const angles=[];
  for(let offset=-half;offset<half-1e-5 && angles.length<=cap;offset+=step)
    angles.push((90-emission.directionDeg)*rad+offset);
  return angles;
}
export function validateRefractiveFan(components,density,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,REFRACTIVE_FAN_MODEL,29))
    reject('v29 requires exactly one directional source and one planar interface.');
  const source=components.find(c=>c.type==='point-source');
  const plane=components.find(c=>c.type==='planar-interface').parameters;
  if(plane.normalDeg!==90 || plane.partialReflection || plane.y-source.parameters.y<1)
    reject('Require an upward interface normal, at least 1 mm above the source, with partial reflection disabled.');
  if(!Number.isFinite(density)||density<.048||density>1||source.parameters.brightness>density)
    reject('Require unsaturated source brightness and ray density between 0.048 and 1.');
  const emission=source.emission;
  if(Math.abs(90-emission.directionDeg)+emission.angleDeg/2>75)
    reject('The entire emission cone must lie within 75 degrees of the upward normal.');
  const angles=sampleAngles(emission,density);
  if(!angles.length||angles.length>cap)reject('The fan must contain 1–100 native samples.');
  if(angles.some(a=>critical(plane,Math.sin(a))))reject('Near-critical incidence withholds the entire sampled fan.');
}

function direction(ray){
  const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y,length=Math.hypot(x,y);
  return {x:x/length,y:y/length};
}
const close=(a,b,tolerance)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;

export function installRefractiveFanAudit(doc,scene,idMap){
  const components=doc.physics.components;
  const source=components.find(c=>c.type==='point-source');
  const plane=components.find(c=>c.type==='planar-interface');
  const emitter=scene.objs[idMap.get(source.id)],glass=scene.objs[idMap.get(plane.id)];
  const angles=sampleAngles(source.emission,doc.simulation.rayDensity);
  const pending=new Map();
  let starts=0,incidents=0,reflections=0,invalid=false;
  const start=emitter.onSimulationStart;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);
    starts++;
    if(result?.newRays?.length!==angles.length || result.brightnessScale!==1)invalid=true;
    else for(const [i,ray] of result.newRays.entries()){
      const d=direction(ray),a=angles[i];
      if(pending.has(ray)||ray.p1.x!==source.parameters.x||ray.p1.y!==-source.parameters.y||
        !close(d.x,Math.sin(a),1e-9)||!close(d.y,Math.cos(a),1e-9))invalid=true;
      pending.set(ray,d);
    }
    return result;
  };
  const original=glass.onRayIncident;
  glass.onRayIncident=function(ray,index,point,...rest){
    const before=direction(ray),root=pending.get(ray),p=plane.parameters;
    const hitX=source.parameters.x+(p.y-source.parameters.y)*before.x/before.y;
    if(!root||!close(before.x,root.x,1e-9)||!close(before.y,root.y,1e-9)||
      !close(point.x,hitX,1e-6)||!close(point.y,-p.y,1e-6)||critical(p,before.x))invalid=true;
    pending.delete(ray);
    incidents++;
    const result=original.call(this,ray,index,point,...rest);
    const after=direction(ray);
    if(result===undefined)reflections++;
    const tir=p.negativeIndex*Math.abs(before.x)>p.positiveIndex;
    const tangent=tir?before.x:before.x*p.negativeIndex/p.positiveIndex;
    if((result===undefined)!==tir||result?.newRays?.length||result?.isAbsorbed||result?.isUndefinedBehavior||
      !close(after.x,tangent,1e-8)||!close(after.y,(tir?-1:1)*Math.sqrt(1-tangent*tangent),1e-8))invalid=true;
    return result;
  };
  return (emitted,interfaces,warnings)=>{
    const meter=interfaces?.[plane.id];
    if(invalid||starts!==1||pending.size||incidents!==angles.length||emitted!==incidents||
      warnings.length||meter?.interactions!==incidents||meter.transmitted!==incidents-reflections||
      meter.totalInternalReflections!==reflections||meter.reflected!==reflections)
      return 'Incomplete or inconsistent native refractive fan evidence. All fan readings withheld.';
    return null;
  };
}
