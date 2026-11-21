// Observer for a bounded, explicitly qualified sequence of actual native interactions.
import {expectedDetectorPassage,preservesDetectorPassage} from './native-detector-audit.js';
const rad=Math.PI/180;
const near=(a,b,tolerance=1e-6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
export function nativeFanOffsets(cone,density){
  const half=cone*rad/2,step=2*Math.PI/Math.floor(density*500),samples=[];
  for(let angle=-half;angle<half-1e-5&&samples.length<=16;angle+=step)samples.push(angle);
  return samples;
}

function direction(ray){
  const dx=ray.p2.x-ray.p1.x,dy=ray.p2.y-ray.p1.y,length=Math.hypot(dx,dy);
  return {x:dx/length,y:dy/length};
}
export function installAxialFanAudit({doc,scene,idMap,source,mirror,detector,faces,sequence,key,label}){
  const expected=nativeFanOffsets(source.emission.angleDeg,doc.simulation.rayDensity);
  const axis=source.emission.directionDeg*rad;
  const channelBrightness=source.parameters.brightness/doc.simulation.rayDensity/2;
  const hasAuthoredBrightness=ray=>ray.brightness_s===channelBrightness&&ray.brightness_p===channelBrightness;
  const reflectedAt=sequence.indexOf(mirror),detectorOrientation=Math.sign(detector.parameters.orientationDeg);
  const live=new Map();
  let starts=0,finished=0,fault=null,expectedPower=0;
  const emitter=scene.objs[idMap.get(source.id)],start=emitter.onSimulationStart;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);starts++;
    if(result?.newRays?.length!==expected.length||result?.brightnessScale!==1)fault??='unexpected emission count or brightness';
    else for(const [i,ray] of result.newRays.entries()){
      const d=direction(ray),s=source.parameters;
      if(live.has(ray)||ray.p1.x!==s.x||ray.p1.y!==-s.y||!hasAuthoredBrightness(ray)||
        !near(d.x,Math.cos(axis+expected[i]),1e-9)||!near(d.y,Math.sin(axis+expected[i]),1e-9))
        fault??='unexpected launch direction, position or brightness';
      live.set(ray,{stage:0,p:{...ray.p1},d});
    }
    return result;
  };
  for(const c of new Set([...sequence,mirror])){
    const obj=scene.objs[idMap.get(c.id)],incident=obj.onRayIncident;
    obj.onRayIncident=function(ray,index,point,...rest){
      const state=live.get(ray),before=direction(ray),p=c.parameters;
      const x=point.x,y=point.y,dx=x-ray.p1.x,dy=y-ray.p1.y;
      if(!state||sequence[state.stage]!==c||!hasAuthoredBrightness(ray)||state.p.x!==ray.p1.x||state.p.y!==ray.p1.y||
        !near(state.d.x,before.x,1e-9)||!near(state.d.y,before.y,1e-9)||
        !(dx*before.x+dy*before.y>0)||!near(dx*before.y,dy*before.x))fault??=c.id+': unexpected incoming encounter';
      const directionSign=state?.stage<reflectedAt?1:-1;
      const detectorSign=-directionSign*detectorOrientation;
      const passage=c===detector?expectedDetectorPassage(this,ray,point,expectedPower,detectorSign):null;
      const result=incident.call(this,ray,index,point,...rest),after=direction(ray);
      if(point.x!==x||point.y!==y||!near(ray.p1.x,x)||!near(ray.p1.y,y)||!hasAuthoredBrightness(ray)||result?.isAbsorbed||
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
          if(before.x*directionSign<=0||Math.abs(point.y+p.y)>=p.length/2-.1||
            !near(before.x,after.x,1e-9)||!near(before.y,after.y,1e-9)||
            !preservesDetectorPassage(this,ray,point,result,passage))fault??=c.id+': uncertain detector direction, rim clearance or signed power';
          expectedPower+=detectorSign*(channelBrightness+channelBrightness);
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
    key,
    finish(emitted,interfaces,warnings,reflections,detectors){
      if(fault)return label+': '+fault+'.';
      const encounters=c=>sequence.filter(component=>component===c).length*emitted;
      if(starts!==1||live.size||warnings.length||emitted!==expected.length||finished!==emitted||
        faces.some(c=>interfaces?.[c.id]?.interactions!==encounters(c)||interfaces?.[c.id]?.transmitted!==encounters(c))||
        reflections?.[mirror.id]!==encounters(mirror)||detectors?.[detector.id]?.crossings!==encounters(detector)||
        detectors?.[detector.id]?.signedPower!==expectedPower)
        return label+'.';
      return null;
    }
  };
}
