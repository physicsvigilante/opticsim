import {compositionCountsMatch} from './composition-profiles.js';
import {GRIN_V25_TYPE,compileGrinV25,grinV25Extents} from './native-grin-v25.js';
import {expectedDetectorPassage,preservesDetectorPassage} from './native-detector-audit.js';

export const GRIN_SLAB_VERSION=33;
export const GRIN_SLAB_MODEL='native-entering-graded-slab';
export const GRIN_SLAB_POLICY=Object.freeze({step:.00025,maxRayDepth:8192,processedRayLimit:10000,rayDensity:.2});
const tolerance=.003;
const clearance=.1;
const within=(x,lo,hi)=>Number.isFinite(x)&&x>=lo&&x<=hi;
const world=({x,y})=>within(x,-500,500)&&within(y,-500,500);
const near=(a,b,t=1e-6)=>Number.isFinite(a)&&Math.abs(a-b)<=t;
const primary=(ray)=> {
  const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,length=Math.hypot(dx,dy);
  return {x:dx/length,y:dy/length};
};
function parts(components){
  return {
    source:components.find(c=>c.type==='point-source'),
    glass:components.find(c=>c.type===GRIN_V25_TYPE),
    detector:components.find(c=>c.type==='ray-detector')
  };
}
function reference(source,glass,detector){
  const p=glass.parameters,s=source.parameters,d=detector.parameters;
  const angle=source.emission.directionDeg*Math.PI/180,q=Math.cos(angle),inward=Math.sin(angle);
  const entryX=s.x+(p.axisY-s.y)*q/inward;
  const exitY=p.axisY+p.upHeight;
  const exitX=entryX+2*q*p.upHeight/(Math.sqrt(inward*inward+p.upHeight)+inward);
  return {entryX,exitX,exitY,q,inward,detectorX:exitX+(d.y-exitY)*q/inward};
}
export function compileEnteringGradedSlab(c){
  return {...compileGrinV25(c),refIndexFn:'\\sqrt{1-y}',stepSize:GRIN_SLAB_POLICY.step};
}
export function validateEnteringGradedSlab(components,simulation,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,GRIN_SLAB_MODEL,GRIN_SLAB_VERSION))
    reject('Require one exact source ray, one graded rectangle and one outside detector.');
  const {source,glass,detector}=parts(components),p=glass.parameters,s=source.parameters,d=detector.parameters;
  if(p.downHeight!==0||p.indexSquaredAtAxis!==1||p.gradientLength!==1||p.outsideIndex!==1||
    p.partialReflection!==false||!within(p.upHeight,.2,.4)||!within(p.spanX,2,5)||!grinV25Extents(p).every(world))
    reject('Use a positive linear squared index from 1 with a 1 mm gradient length, exterior index one, 0.2–0.4 mm thickness and partial reflection disabled.');
  if(source.emission.mode!=='single-ray'||!within(source.emission.directionDeg,10,70)||
    !near(p.axisY-s.y,.1,1e-9)||!world(s))
    reject('The incident single ray starts 0.1 mm below the entrance. Launch from 10–70 degrees above the forward tangent.');
  if(![0,180,-180].includes(d.orientationDeg)||!near(d.y-p.axisY-p.upHeight,.2,1e-9)||!within(d.length,1,5)||
    !world({x:d.x-d.length/2,y:d.y})||!world({x:d.x+d.length/2,y:d.y}))
    reject('Use a horizontal passive detector 0.2 mm beyond the far face.');
  const ref=reference(source,glass,detector);
  if(![ref.entryX,ref.exitX].every(x=>within(x,p.leftX+clearance,p.leftX+p.spanX-clearance))||
    Math.abs(ref.detectorX-d.x)>=d.length/2-clearance)
    reject('The qualified witness needs at least 0.1 mm of lateral clearance at both glass faces and the detector.');
  if(simulation?.rayDensity!==GRIN_SLAB_POLICY.rayDensity||simulation?.maxRayDepth!==GRIN_SLAB_POLICY.maxRayDepth||
    simulation?.processedRayLimit!==GRIN_SLAB_POLICY.processedRayLimit)
    fail('$.simulation','Use the versioned native entering-slab numerical policy.','UNSUPPORTED_SCOPE');
}

export function enteringGradedSlabAudit(doc,scene,idMap){
  const {source,glass,detector}=parts(doc.physics.components);
  const ref=reference(source,glass,detector),p=glass.parameters,d=detector.parameters;
  const emitter=scene.objs[idMap.get(source.id)],body=scene.objs[idMap.get(glass.id)],gauge=scene.objs[idMap.get(detector.id)];
  const start=emitter.onSimulationStart,incident=body.onRayIncident,detect=gauge.onRayIncident;
  const halfBrightness=source.parameters.brightness/2;
  const hasAuthoredBrightness=input=>input.brightness_s===halfBrightness&&input.brightness_p===halfBrightness;
  const detectorSign=d.orientationDeg===0?1:-1;
  const expectedSignedPower=detectorSign*source.parameters.brightness;
  let starts=0,contacts=0,entry=0,exit=0,hits=0,ray=null,last=null,fault=false;
  const startsAtLastContact=input=>last&&input.p1.x===last.x&&input.p1.y===-last.y;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);starts++;
    if(result?.newRays?.length!==1||starts!==1)fault=true;
    else{
      ray=result.newRays[0];const direction=primary(ray),s=source.parameters;
      if(ray.p1.x!==s.x||ray.p1.y!==-s.y||!near(direction.x,ref.q,1e-9)||!near(direction.y,ref.inward,1e-9)||
        !hasAuthoredBrightness(ray))fault=true;
      last={x:ray.p1.x,y:-ray.p1.y,d:direction};
    }
    return result;
  };
  body.onRayIncident=function(input,index,point,...rest){
    const before=primary(input),x=point.x,y=-point.y,arrivedWithAuthoredBrightness=hasAuthoredBrightness(input);
    const continuous=startsAtLastContact(input);
    const result=incident.call(this,input,index,point,...rest),after=primary(input);
    contacts++;
    if(input!==ray||contacts>GRIN_SLAB_POLICY.maxRayDepth||!continuous||!arrivedWithAuthoredBrightness||!hasAuthoredBrightness(input)||
      result?.isAbsorbed||result?.isUndefinedBehavior||
      result?.newRays?.length||point.x!==x||point.y!==-y||!near(input.p1.x,x)||!near(input.p1.y,-y)||
      !within(x,p.leftX+clearance-tolerance,p.leftX+p.spanX-clearance+tolerance)||
      !(before.x>0&&before.y>0&&after.x>0&&after.y>0))fault=true;
    const dx=x-ref.entryX,expectedY=p.axisY+dx*(ref.inward/ref.q+dx/(4*ref.q*ref.q));
    if(!near(y,expectedY,tolerance)||!last||!(x>last.x&&y>last.y)||
      !near(before.x,last.d.x,1e-9)||!near(before.y,last.d.y,1e-9)||
      !near((x-last.x)*before.y,(y-last.y)*before.x))fault=true;
    last={x:input.p1.x,y:-input.p1.y,d:after};
    if(contacts===1){
      if(result&&near(x,ref.entryX)&&near(y,p.axisY)&&near(after.x,ref.q,1e-8))entry++;
      else fault=true;
    }else if(near(y,ref.exitY)){
      if(result&&near(x,ref.exitX,tolerance)&&near(after.x,ref.q,tolerance))exit++;
      else fault=true;
    }else if(exit!==0||!within(y,p.axisY,ref.exitY))fault=true;
    return result;
  };
  gauge.onRayIncident=function(input,index,point,...rest){
    const direction=primary(input),x=point.x,y=-point.y,arrivedWithAuthoredBrightness=hasAuthoredBrightness(input);
    const continuous=startsAtLastContact(input);
    const expected=expectedDetectorPassage(this,input,point,0,detectorSign);
    const result=detect.call(this,input,index,point,...rest);
    const after=primary(input);
    hits++;
    if(input!==ray||exit!==1||!continuous||!arrivedWithAuthoredBrightness||
      !near(direction.x,last.d.x,1e-9)||!near(direction.y,last.d.y,1e-9)||
      !near((x-last.x)*direction.y,(y-last.y)*direction.x)||!near(y,d.y)||!near(x,ref.detectorX,tolerance)||
      !near(direction.x,ref.q,tolerance)||direction.y<=0||Math.abs(x-d.x)>=d.length/2-clearance/2||
      !near(direction.x,after.x,1e-9)||!near(direction.y,after.y,1e-9)||
      !preservesDetectorPassage(this,input,point,result,expected))fault=true;
    return result;
  };
  return {
    key:'v33GradedSlabVerified',
    finish(emitted,_interfaces,warnings,_mirrors,detectors){
      if(fault||starts!==1||emitted!==1||contacts<10||entry!==1||exit!==1||hits!==1||
        warnings.length||detectors?.[detector.id]?.crossings!==1||
        detectors[detector.id].signedPower!==expectedSignedPower)
        return 'Native graded-slab propagation failed its finite path and detector checks.';
      return null;
    }
  };
}
