import {compositionCountsMatch} from './composition-profiles.js';

export const CAP_TYPE='circular-cap-dielectric';
export const CAP_MODEL='native-inside-cap-tracing';
export const CAP_VERSION=32;
export const CAP_PARAMETERS=Object.freeze(['x','y','radius','capHeight','insideIndex','outsideIndex','partialReflection']);
export const CAP_V40_PARAMETERS=Object.freeze(['x','y','radius','capHeight','normalDeg','insideIndex','outsideIndex','partialReflection']);
const near=(a,b,tolerance=1e-6)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
const world=p=>[p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000);
export function capFrame(p){
  const deg=p.normalDeg??0;
  if(deg===0)return {u:{x:1,y:0},t:{x:0,y:1}};
  if(deg===90)return {u:{x:0,y:1},t:{x:-1,y:0}};
  if(deg===-90)return {u:{x:0,y:-1},t:{x:1,y:0}};
  if(Math.abs(deg)===180)return {u:{x:-1,y:0},t:{x:0,y:-1}};
  const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return {u:{x:c,y:s},t:{x:-s,y:c}};
}
export function capGeometry(p){
  const {u,t}=capFrame(p);
  const halfChord=Math.sqrt(p.capHeight*(2*p.radius-p.capHeight));
  const base={x:p.x,y:p.y};
  const center={x:p.x+(p.capHeight-p.radius)*u.x,y:p.y+(p.capHeight-p.radius)*u.y};
  const p1={x:p.x+halfChord*t.x,y:p.y+halfChord*t.y};
  const apex={x:p.x+p.capHeight*u.x,y:p.y+p.capHeight*u.y};
  const p2={x:p.x-halfChord*t.x,y:p.y-halfChord*t.y};
  const flatNormal={x:-u.x,y:-u.y};
  const capHalfAngle=Math.acos(Math.max(-1,Math.min(1,(p.radius-p.capHeight)/p.radius)));
  return {base,u,t,center,radius:p.radius,capHeight:p.capHeight,halfChord,p1,apex,p2,flatNormal,capHalfAngle};
}
export function capPathPoints(p){
  const g=capGeometry(p);
  return [g.p1,g.apex,g.p2];
}
export function capExtents(p){
  const g=capGeometry(p);
  const pts=[g.p1,g.apex,g.p2];
  // Include cardinal circle extrema lying strictly on the curved arc (important for major caps h > R and tilted caps).
  const cardinals=[
    {x:g.center.x+g.radius,y:g.center.y},{x:g.center.x-g.radius,y:g.center.y},
    {x:g.center.x,y:g.center.y+g.radius},{x:g.center.x,y:g.center.y-g.radius}
  ];
  for(const q of cardinals){
    if((q.x-g.base.x)*g.u.x+(q.y-g.base.y)*g.u.y>1e-12&&
       pts.every(existing=>Math.hypot(existing.x-q.x,existing.y-q.y)>1e-9))pts.push(q);
  }
  return pts;
}
export function compileCircularCap(c){
  const path=capPathPoints(c.parameters).map(({x,y},i)=>({x,y:-y,arc:i===1}));
  const p=c.parameters;
  return {type:'Glass',path,notDone:false,refIndex:p.insideIndex/p.outsideIndex,partialReflect:p.partialReflection};
}
export function capEncounter(component,nativePoint,incoming,seamClearance=0.1){
  const p=component.parameters,g=capGeometry(p),point={x:nativePoint?.x,y:-nativePoint?.y};
  const rx=point.x-g.base.x,ry=point.y-g.base.y;
  const axial=rx*g.u.x+ry*g.u.y,trans=rx*g.t.x+ry*g.t.y;
  const dx=point.x-g.center.x,dy=point.y-g.center.y,radial=Math.hypot(dx,dy);
  const seam=Math.min(Math.hypot(point.x-g.p1.x,point.y-g.p1.y),Math.hypot(point.x-g.p2.x,point.y-g.p2.y));
  const candidates=[];
  if([axial,trans,radial,seam].every(Number.isFinite)&&seam>seamClearance){
    if(near(axial,0,1e-5)&&Math.abs(trans)<g.halfChord)
      candidates.push({faceId:'face-flat',normal:g.flatNormal});
    if(axial>0&&radial>0&&near(radial,g.radius,1e-5))
      candidates.push({faceId:'face-arc',normal:{x:dx/radial,y:dy/radial}});
  }
  if(candidates.length!==1)
    return {point,normal:{x:NaN,y:NaN},faceId:null,invalid:true,from:'unverified',incidentIndex:null,destinationIndex:null};
  const {faceId,normal}=candidates[0];
  const projection=incoming?.x*normal.x+incoming?.y*normal.y;
  if(!Number.isFinite(projection)||Math.abs(projection)<1e-10)
    return {point,normal,faceId:null,invalid:true,from:'unverified',incidentIndex:null,destinationIndex:null};
  const leaving=projection>0;
  return {point,normal,faceId,invalid:false,from:leaving?'inside':'outside',
    incidentIndex:leaving?p.insideIndex:p.outsideIndex,destinationIndex:leaving?p.outsideIndex:p.insideIndex};
}
export function validateCircularCap(components,density,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,CAP_MODEL,CAP_VERSION))
    reject('Require one inside directional source, one finite circular cap and one outside detector.');
  const cap=components.find(c=>c.type===CAP_TYPE).parameters;
  const source=components.find(c=>c.type==='point-source'),s=source.parameters;
  const d=components.find(c=>c.type==='ray-detector').parameters;
  const pole=cap.x+cap.capHeight;
  if(cap.radius<25||cap.radius>400||cap.capHeight/cap.radius<.2||cap.capHeight>cap.radius||
    !capExtents(cap).every(world)||!world({x:pole-cap.radius,y:cap.y})||cap.partialReflection!==false||
    cap.insideIndex<=cap.outsideIndex||cap.insideIndex/cap.outsideIndex>1.7)
    reject('Use a 25–400 mm radius, height 0.2–1 times the radius, a denser interior with ratio at most 1.7 and partial reflection disabled.');
  if(s.y!==cap.y||s.x-cap.x<.05||pole-s.x<1||source.emission.mode!=='directional'||
    source.emission.directionDeg!==0||source.emission.angleDeg<1.5||source.emission.angleDeg>2||density!==1)
    reject('Use a rightward on-axis source at least 0.05 mm beyond the base and 1 mm before the pole, with a 1.5–2 degree cone and dense sampling.');
  if(d.y!==cap.y||d.x-pole<1||d.x-pole>4*cap.radius||Math.abs(d.orientationDeg)!==90||d.length<20||d.length>200||
    !world({x:d.x,y:d.y-d.length/2})||!world({x:d.x,y:d.y+d.length/2}))
    reject('Use an axial vertical detector 1 mm to four radii beyond the pole, with length 20–200 mm.');
}
function direction(ray){
  const dx=ray.p2.x-ray.p1.x,dy=ray.p1.y-ray.p2.y,m=Math.hypot(dx,dy);
  return {x:dx/m,y:dy/m};
}
export function capNativeAudit(doc,scene,idMap){
  const source=doc.physics.components.find(c=>c.type==='point-source');
  const cap=doc.physics.components.find(c=>c.type===CAP_TYPE);
  const detector=doc.physics.components.find(c=>c.type==='ray-detector');
  const emittedAngles=[];
  // The pinned AngleSource adds its offsets in y-down coordinates. The
  // authoring profile fixes density to 1 and axial horizontal launch.
  const half=source.emission.angleDeg*Math.PI/360;
  for(let offset=-half;offset<half-1e-5;offset+=2*Math.PI/500)emittedAngles.push(-offset);
  const emitter=scene.objs[idMap.get(source.id)],glass=scene.objs[idMap.get(cap.id)],gauge=scene.objs[idMap.get(detector.id)];
  const start=emitter.onSimulationStart,glassIncident=glass.onRayIncident,detectorIncident=gauge.onRayIncident;
  const pending=new Map();
  let starts=0,crossings=0,fault=false;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args);starts++;
    if(result?.newRays?.length!==emittedAngles.length||result?.brightnessScale!==1)fault=true;
    else for(const [i,ray] of result.newRays.entries()){
      const d=direction(ray),s=source.parameters;
      if(pending.has(ray)||ray.p1.x!==s.x||ray.p1.y!==-s.y||
        !near(d.x,Math.cos(emittedAngles[i]),1e-9)||!near(d.y,Math.sin(emittedAngles[i]),1e-9))fault=true;
      pending.set(ray,{stage:0,x:ray.p1.x,y:ray.p1.y,d});
    }
    return result;
  };
  function incoming(ray,point,stage){
    const before=direction(ray),previous=pending.get(ray),dx=point.x-ray.p1.x,dy=ray.p1.y-point.y;
    if(previous?.stage!==stage||!near(ray.p1.x,previous.x)||!near(ray.p1.y,previous.y)||
      !near(before.x,previous.d.x,1e-9)||!near(before.y,previous.d.y,1e-9)||
      !(dx*before.x+dy*before.y>0)||!near(dx*before.y,dy*before.x))fault=true;
    return before;
  }
  glass.onRayIncident=function(ray,index,point,...rest){
    const before=incoming(ray,point,0),event=capEncounter(cap,point,before);
    const result=glassIncident.call(this,ray,index,point,...rest),after=direction(ray),n=event.normal;
    const tangent=d=>d.x*n.y-d.y*n.x;
    if(event.invalid||event.faceId!=='face-arc'||event.from!=='inside'||!(after.x*n.x+after.y*n.y>1e-5)||
      !near(ray.p1.x,point.x)||!near(ray.p1.y,point.y)||!result||result.isUndefinedBehavior||result.isAbsorbed||
      result.newRays?.length||!near(event.incidentIndex*tangent(before),event.destinationIndex*tangent(after),1e-8))fault=true;
    pending.set(ray,{stage:1,x:ray.p1.x,y:ray.p1.y,d:after});
    return result;
  };
  gauge.onRayIncident=function(ray,index,point,...rest){
    const before=incoming(ray,point,1),p=detector.parameters;
    const tangentX=this.p2.x-this.p1.x,tangentY=this.p2.y-this.p1.y;
    const sign=Math.sign(before.x*tangentY+before.y*tangentX);
    const incidentPower=ray.brightness_s+ray.brightness_p;
    const expectedPower=this.power+sign*incidentPower;
    const result=detectorIncident.call(this,ray,index,point,...rest),after=direction(ray);
    if(!near(point.x,p.x)||Math.abs(point.y+p.y)>=p.length/2-.1||
      !near(ray.p1.x,point.x)||!near(ray.p1.y,point.y)||!near(before.x,after.x,1e-9)||!near(before.y,after.y,1e-9)||
      result?.isAbsorbed||result?.isUndefinedBehavior||result?.newRays?.length||
      !sign||!(incidentPower>0)||!near(this.power,expectedPower,1e-9))fault=true;
    pending.delete(ray);crossings++;
    return result;
  };
  return {
    key:'v32CapVerified',
    finish(emitted,interfaces,warnings,_reflections,detectors){
      const boundary=interfaces?.[cap.id];
      if(fault||starts!==1||pending.size||warnings.length||emitted!==emittedAngles.length||
        crossings!==emitted||boundary?.transmitted!==emitted||boundary?.interactions!==emitted||
        boundary.faces?.['face-arc']?.interactions!==emitted||detectors?.[detector.id]?.crossings!==emitted)
        return 'The cap exit samples could not be verified.';
      return null;
    }
  };
}
