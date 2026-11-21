import {compositionCountsMatch} from './composition-profiles.js';
import {curvedPoints} from './curved-mirrors.js';

export const SLAB_ARC_MODEL='native-fan-slab-arc-return-tracing';
const version=31;
const rad=Math.PI/180;
const world=p=>[p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000);
const near=(a,b,tolerance=1e-6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
function arrangement(components){
  const source=components.find(c=>c.type==='point-source');
  const mirror=components.find(c=>c.type==='circular-arc-mirror');
  const detector=components.find(c=>c.type==='ray-detector');
  const faces=components.filter(c=>c.type==='planar-interface').sort((a,b)=>a.parameters.x-b.parameters.x);
  return {source,mirror,detector,faces};
}
function offsets(cone,density){
  const half=cone*rad/2,step=2*Math.PI/Math.floor(density*500),samples=[];
  for(let angle=-half;angle<half-1e-5&&samples.length<=16;angle+=step)samples.push(angle);
  return samples;
}
export function validateSlabArcReturn(components,density,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,SLAB_ARC_MODEL,version))
    reject('Require a directional source, two plane interfaces, a circular arc mirror and a passive detector.');
  const {source,mirror,detector,faces}=arrangement(components);
  const s=source.parameters,m=mirror.parameters,d=detector.parameters;
  const [front,rear]=faces.map(c=>c.parameters);
  if(faces.some(({parameters:p})=>p.normalDeg!==0||p.partialReflection!==false)||
    front.positiveIndex!==rear.negativeIndex||front.negativeIndex!==rear.positiveIndex||
    !(front.positiveIndex>front.negativeIndex&&front.positiveIndex/front.negativeIndex<=1.6))
    reject('Use parallel rightward normals, one denser matched slab interior, one common exterior and partial reflection disabled.');
  if(m.radius<100||m.radius>400||m.apertureHeight<40||m.apertureHeight>100||
    Math.abs(m.normalDeg)!==180||!curvedPoints(mirror).every(world))
    reject('Use a left-facing concave arc with radius 100–400 mm and aperture 40–100 mm.');
  if(Math.abs(d.orientationDeg)!==90||d.y!==m.y||d.length<40||d.length>200||
    !world({x:d.x,y:d.y-d.length/2})||!world({x:d.x,y:d.y+d.length/2}))
    reject('Use a vertical detector centred on the mirror axis with length 40–200 mm.');
  const arcStart=Math.min(...curvedPoints(mirror).map(p=>p.x));
  if(front.x-s.x<1||rear.x-front.x<1||d.x-rear.x<1||arcStart-d.x<1||
    m.x-s.x>450||Math.abs(s.y-m.y)>5)
    reject('Use separated source, front face, rear face, detector and mirror in that order, with at least 1 mm between them.');
  if(source.emission.mode!=='directional'||source.emission.directionDeg!==0||
    source.emission.angleDeg<1.5||source.emission.angleDeg>2||!Number.isFinite(density)||density<.95||density>1||
    s.brightness>density||offsets(source.emission.angleDeg,density).length<2)
    reject('Use a rightward directional cone of 1.5–2 degrees, density 0.95–1 and unsaturated brightness.');
}

function direction(ray){
  const dx=ray.p2.x-ray.p1.x,dy=ray.p2.y-ray.p1.y,length=Math.hypot(dx,dy);
  return {x:dx/length,y:dy/length};
}
export function slabArcReturnAudit(doc,scene,idMap){
  const {source,mirror,detector,faces:[front,rear]}=arrangement(doc.physics.components);
  const sequence=[front,rear,detector,mirror,detector,rear,front];
  const expected=offsets(source.emission.angleDeg,doc.simulation.rayDensity);
  const live=new Map();
  let starts=0,finished=0,fault=null;
  const emitter=scene.objs[idMap.get(source.id)],start=emitter.onSimulationStart;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);starts++;
    if(result?.newRays?.length!==expected.length||result?.brightnessScale!==1)fault??='unexpected emission count or brightness';
    else for(const [i,ray] of result.newRays.entries()){
      const d=direction(ray),s=source.parameters;
      if(live.has(ray)||ray.p1.x!==s.x||ray.p1.y!==-s.y||
        !near(d.x,Math.cos(expected[i]),1e-9)||!near(d.y,Math.sin(expected[i]),1e-9))fault??='unexpected launch direction or position';
      live.set(ray,{stage:0,p:{...ray.p1},d});
    }
    return result;
  };
  for(const c of new Set(sequence)){
    const obj=scene.objs[idMap.get(c.id)],incident=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,point,...rest){
      const state=live.get(ray),before=direction(ray),p=c.parameters;
      const dx=point.x-ray.p1.x,dy=point.y-ray.p1.y;
      if(!state||sequence[state.stage]!==c||!near(state.p.x,ray.p1.x)||!near(state.p.y,ray.p1.y)||
        !near(state.d.x,before.x,1e-9)||!near(state.d.y,before.y,1e-9)||
        !(dx*before.x+dy*before.y>0)||!near(dx*before.y,dy*before.x))fault??=c.id+': unexpected incoming encounter';
      const result=incident.call(this,ray,index,point,...rest),after=direction(ray);
      if(!near(ray.p1.x,point.x)||!near(ray.p1.y,point.y)||result?.isAbsorbed||
        result?.isUndefinedBehavior||result?.newRays?.length)fault??=c.id+': unexpected native outgoing branch';
      if(c===mirror){
        const n={x:(point.x-p.x+p.radius)/p.radius,y:(point.y+p.y)/p.radius};
        const projection=before.x*n.x+before.y*n.y;
        if(!near(Math.hypot(n.x,n.y),1,1e-8)||before.x<=0||after.x>=0||
          Math.abs(point.y+p.y)>=p.apertureHeight/2-.1||
          !near(after.x,before.x-2*projection*n.x,1e-8)||!near(after.y,before.y-2*projection*n.y,1e-8))fault??=c.id+': uncertain reflection or arc rim clearance';
      }else{
        if(!near(point.x,p.x)||!(before.x*after.x>0))fault??=c.id+': unexpected plane encounter';
        if(c===detector){
          if(Math.abs(point.y+p.y)>=p.length/2-.1||!near(before.y,after.y,1e-9))fault??=c.id+': uncertain detector direction or rim clearance';
        }else{
          const [from,to]=before.x>0?[p.negativeIndex,p.positiveIndex]:[p.positiveIndex,p.negativeIndex];
          if(!near(from*before.y,to*after.y,1e-8))fault??=c.id+': uncertain refraction';
        }
      }
      if(state?.stage===sequence.length-1){finished++;live.delete(ray);}
      else if(state)live.set(ray,{stage:state.stage+1,p:{...ray.p1},d:after});
      return result;
    };
  }
  return {
    key:'v31SlabArcVerified',
    finish(emitted,interfaces,warnings,reflections,detectors){
      if(fault)return 'Incomplete slab and curved mirror evidence: '+fault+'.';
      if(starts!==1||live.size||warnings.length||emitted!==expected.length||finished!==emitted||
        facesIncomplete()||reflections?.[mirror.id]!==emitted||detectors?.[detector.id]?.crossings!==2*emitted)
        return 'Incomplete slab and curved mirror callback evidence.';
      return null;
      function facesIncomplete(){
        return [front,rear].some(({id})=>interfaces?.[id]?.interactions!==2*emitted||
          interfaces?.[id]?.transmitted!==2*emitted);
      }
    }
  };
}
