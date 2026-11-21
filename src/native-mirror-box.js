import {compositionCountsMatch} from './composition-profiles.js';

export const MIRROR_BOX_VERSION=35;
export const MIRROR_BOX_MODEL='native-rectangular-mirror-box';
const wallTypes=['plane-mirror','line-blocker'];
const isVertical=p=>Math.abs(p.orientationDeg)===90;
const axial=p=>[0,90,-90,180,-180].includes(p.orientationDeg);
const near=(a,b,tolerance=1e-7)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const inside=(p,min,max)=>p>=min+1&&p<=max-1;
const world=p=>Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000;
const samePoint=(a,b)=>a.x===b.x&&a.y===b.y;

function parts(components){
  return {
    source:components.find(c=>c.type==='point-source'),
    mirrors:components.filter(c=>c.type==='plane-mirror'),
    target:components.find(c=>c.type==='line-blocker')
  };
}

export function validateMirrorBox(components,endpoints,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,MIRROR_BOX_MODEL,MIRROR_BOX_VERSION))
    reject('Use four finite plane mirrors, one single-ray source and one interior opaque line blocker.');
  const {source,mirrors,target}=parts(components),s=source.parameters;
  const all=[...mirrors,target];
  if(all.some(c=>!axial(c.parameters)||!endpoints(c.parameters).every(world)))
    reject('Use axis-aligned segments with all endpoints inside the coordinate bounds.');
  const vertical=mirrors.filter(c=>isVertical(c.parameters)).map(c=>c.parameters).sort((a,b)=>a.x-b.x);
  const horizontal=mirrors.filter(c=>!isVertical(c.parameters)).map(c=>c.parameters).sort((a,b)=>a.y-b.y);
  if(vertical.length!==2||horizontal.length!==2)reject('Use two vertical and two horizontal mirror walls.');
  const [left,right]=vertical.map(p=>p.x),[bottom,top]=horizontal.map(p=>p.y);
  const width=right-left,height=top-bottom;
  if([width,height].some(span=>span<40||span>1000))
    reject('Use a rectangle 40–1000 mm in both dimensions.');
  const fits=(span,mid,center,length)=>near(mid,center,1e-9)&&(span-length)/2>=.1&&(span-length)/2<=2;
  if(vertical.some(p=>!fits(height,(bottom+top)/2,p.y,p.length))||
    horizontal.some(p=>!fits(width,(left+right)/2,p.x,p.length)))
    reject('Center each wall on its edge with a 0.1–2 mm physical gap at both ends.');
  if(source.emission.mode!=='single-ray'||!inside(s.x,left,right)||!inside(s.y,bottom,top)||
    !endpoints(target.parameters).every(p=>inside(p.x,left,right)&&inside(p.y,bottom,top)))
    reject('Use one explicit single ray and keep its origin and the entire target at least 1 mm inside the rectangle.');
  const p=target.parameters;
  if(p.length<2||p.length>20||Math.abs(isVertical(p)?p.x-s.x:p.y-s.y)<1)
    reject('Use a 2–20 mm opaque target at least 1 mm from the source on its supporting line.');
}

function direction(ray){
  const dx=ray.p2.x-ray.p1.x,dy=ray.p2.y-ray.p1.y,magnitude=Math.hypot(dx,dy);
  return {x:dx/magnitude,y:dy/magnitude};
}

export function mirrorBoxAudit(doc,scene,idMap){
  const {source,mirrors,target}=parts(doc.physics.components);
  const emitter=scene.objs[idMap.get(source.id)],nativeStart=emitter.onSimulationStart;
  const sourceAngle=source.emission.directionDeg*Math.PI/180;
  const expectedDirection={x:Math.cos(sourceAngle),y:-Math.sin(sourceAngle)};
  const half=source.parameters.brightness/2;
  const hasAuthoredBrightness=ray=>ray.brightness_s===half&&ray.brightness_p===half;
  const matchesDirection=(a,b)=>near(a.x,b.x,1e-9)&&near(a.y,b.y,1e-9);
  let starts=0,ray=null,last=null,absorbed=0,fault=null;
  const seen=new Set();
  emitter.onSimulationStart=function(...args){
    const result=nativeStart.apply(this,args);
    starts++;
    if(starts!==1||result?.newRays?.length!==1){fault??='unexpected native emission';return result;}
    [ray]=result.newRays;
    const s=source.parameters,heading=direction(ray);
    if(!samePoint(ray.p1,{x:s.x,y:-s.y})||!matchesDirection(heading,expectedDirection)||!hasAuthoredBrightness(ray))
      fault??='emitted ray disagrees with authored origin, direction or brightness';
    last={point:{...ray.p1},heading};
    return result;
  };
  for(const c of doc.physics.components.filter(c=>wallTypes.includes(c.type))){
    const obj=scene.objs[idMap.get(c.id)],incident=obj.onRayIncident,p=c.parameters,vertical=isVertical(p);
    const rimClearance=c === target ? 0.1 : 1;
    obj.onRayIncident=function(input,index,point,...rest){
      const hit={x:point.x,y:point.y},heading=direction(input);
      const dx=hit.x-input.p1.x,dy=hit.y-input.p1.y;
      const normal=vertical?heading.x:heading.y;
      if(input!==ray||absorbed||!last||!samePoint(input.p1,last.point)||!matchesDirection(heading,last.heading)||
        !hasAuthoredBrightness(input)||!near(dx*heading.y,dy*heading.x)||dx*heading.x+dy*heading.y<=1e-4||
        Math.abs(normal)<.02||!near(vertical?hit.x:hit.y,vertical?p.x:-p.y)||
        Math.abs(vertical?hit.y+p.y:hit.x-p.x)>p.length/2-rimClearance)
        fault??=c.id+': ambiguous finite encounter or broken ray continuity';
      const result=incident.call(this,input,index,point,...rest);
      if(!samePoint(hit,point)||result?.isUndefinedBehavior||result?.newRays?.length||!hasAuthoredBrightness(input))
        fault??=c.id+': unexpected native continuation';
      if(c===target){
        if(result?.isAbsorbed!==true||seen.size!==mirrors.length)
          fault??=c.id+': absorption did not follow one hit on each mirror';
        else absorbed++;
      }else{
        const reflected=vertical?{x:-heading.x,y:heading.y}:{x:heading.x,y:-heading.y};
        const after=direction(input);
        if(seen.has(c.id)||result?.isAbsorbed||!samePoint(hit,input.p1)||!matchesDirection(after,reflected))
          fault??=c.id+': repeated or inconsistent reflection';
        seen.add(c.id);
        last={point:{...input.p1},heading:after};
      }
      return result;
    };
  }
  return {
    key:'v35MirrorBoxVerified',
    finish(emitted,_interfaces,warnings,reflections,_detectors,blockers){
      if(fault)return 'Native mirror box: '+fault+'.';
      if(starts!==1||emitted!==1||seen.size!==4||absorbed!==1||warnings.length||
        mirrors.some(m=>reflections?.[m.id]!==1)||blockers?.[target.id]?.absorptions!==1)
        return 'Native mirror box did not complete the four separate reflections and interior absorption.';
      return null;
    }
  };
}
