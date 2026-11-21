import {compositionCountsMatch} from './composition-profiles.js';
import {POLYGON_TYPE,polygonVertices} from './polygon-dielectric.js';
import {finiteGlassEncounter} from './finite-glass-geometry.js';
import {nativeFanOffsets} from './axial-native-fan-audit.js';
import {expectedDetectorPassage,preservesDetectorPassage} from './native-detector-audit.js';

export const GUIDE_FAN_VERSION=36;
export const GUIDE_FAN_MODEL='native-finite-guide-fan-tracing';
const radians=Math.PI/180;
const clearance=.1;
const criticalBand=1e-6;
const near=(value,expected,tolerance=1e-7)=>Number.isFinite(value)&&Math.abs(value-expected)<=tolerance;
const within=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const world=({x,y})=>within(x,-10000,10000)&&within(y,-10000,10000);
const samePoint=(a,b)=>a.x===b.x&&a.y===b.y;
const entrance='face-41',farFace='face-23';
const sideFaces=['face-12','face-34'];

function parts(components){
  return {source:components.find(c=>c.type==='point-source'),
    glass:components.find(c=>c.type===POLYGON_TYPE),
    detector:components.find(c=>c.type==='ray-detector')};
}
function expectedAngles(source,density){
  return nativeFanOffsets(source.emission.angleDeg,density)
    .map(offset=>source.emission.directionDeg*radians-offset);
}

export function validateGuideFan(components,density,endpoints,fail){
  const reject=message=>fail('$.physics.components',message,'UNSUPPORTED_SCOPE');
  if(!compositionCountsMatch(components,GUIDE_FAN_MODEL,GUIDE_FAN_VERSION))
    reject('Use one directional source, one rectangular Glass guide and one external vertical detector.');
  const {source,glass,detector}=parts(components),p=glass.parameters,s=source.parameters,d=detector.parameters;
  const vertices=polygonVertices(p),[leftBottom,rightBottom,rightTop,leftTop]=vertices;
  const left=leftBottom.x,right=rightBottom.x,bottom=leftBottom.y,top=rightTop.y;
  if(!vertices.every(world)||rightBottom.y!==bottom||rightTop.x!==right||leftTop.x!==left||leftTop.y!==top||
    !within(right-left,35,100)||!within(top-bottom,15,35)||
    !within(p.insideIndex,1.2,1.6)||p.outsideIndex!==1||p.partialReflection!==false)
    reject('Authored vertices must be bottom-left, bottom-right, top-right, top-left. Use one uniform guide 35–100 mm long and 15–35 mm high, unit exterior, inside index 1.2–1.6 and partial reflection disabled.');
  const e=source.emission;
  if(e.mode!=='directional'||!within(left-s.x,1,5)||!within(s.y,bottom+1,top-1)||
    !within(e.angleDeg,10,30)||Math.abs(e.directionDeg)+e.angleDeg/2>82||
    !within(density,.1,.2)||s.brightness>density)
    reject('Use an unsaturated rightward cone of 10–30 degrees within 82 degrees of the axis. Start 1–5 mm in front of the guide, with density 0.1–0.2.');
  const angles=expectedAngles(source,density);
  if(angles.length<2||angles.length>12||angles.some(a=>!within(s.y+(left-s.x)*Math.tan(a),bottom+.2,top-.2)))
    reject('Require two to twelve native samples, each entering the left face with at least 0.2 mm of vertex clearance.');
  if(Math.abs(d.orientationDeg)!==90||!within(d.x-right,1,30)||!within(d.length,10,150)||!endpoints(d).every(world))
    reject('Use a vertical detector 1–30 mm past the right face, with length 10–150 mm.');
}

function direction(ray){
  const x=ray.p2.x-ray.p1.x,y=ray.p1.y-ray.p2.y,norm=Math.hypot(x,y);
  return {x:x/norm,y:y/norm};
}
const headingMatches=(a,b)=>near(a.x,b.x,1e-9)&&near(a.y,b.y,1e-9);
function arrives(state,ray,point,before){
  if(!state||!samePoint(ray.p1,state.origin)||!headingMatches(before,state.heading))return false;
  const dx=point.x-ray.p1.x,dy=ray.p1.y-point.y;
  return dx*before.x+dy*before.y>0&&near(dx*before.y,dy*before.x);
}

export function guideFanAudit(doc,scene,idMap){
  const {source,glass,detector}=parts(doc.physics.components),p=glass.parameters,d=detector.parameters;
  const vertices=polygonVertices(p),density=doc.simulation.rayDensity;
  const angles=expectedAngles(source,density),channel=source.parameters.brightness/density/2;
  const hasBrightness=ray=>ray.brightness_s===channel&&ray.brightness_p===channel;
  const emitter=scene.objs[idMap.get(source.id)],body=scene.objs[idMap.get(glass.id)],gauge=scene.objs[idMap.get(detector.id)];
  const start=emitter.onSimulationStart,incident=body.onRayIncident,detect=gauge.onRayIncident;
  const active=new Map();
  const counts={emitted:angles.length,directFarFace:0,guidedFarFace:0,sideLeak:0};
  const detectorSign=-Math.sign(d.orientationDeg);
  let starts=0,contacts=0,reflections=0,hits=0,expectedPower=0,fault=null;
  emitter.onSimulationStart=function(...args){
    const result=start.apply(this,args),s=source.parameters;
    starts++;
    if(starts!==1||result?.newRays?.length!==angles.length||result.brightnessScale!==1){
      fault??='unexpected native fan sampling';
      return result;
    }
    for(const [i,ray] of result.newRays.entries()){
      const heading=direction(ray),origin={...ray.p1},angle=angles[i];
      if(active.has(ray)||!samePoint(origin,{x:s.x,y:-s.y})||!hasBrightness(ray)||
        !headingMatches(heading,{x:Math.cos(angle),y:Math.sin(angle)}))fault??='unexpected native fan launch';
      active.set(ray,{origin,heading,stage:'incoming',bounces:0,expectedDetector:false,detected:false});
    }
    return result;
  };
  body.onRayIncident=function(ray,index,point,...rest){
    const state=active.get(ray),hit={x:point.x,y:point.y},before=direction(ray);
    const e=finiteGlassEncounter(p,vertices,hit,before,clearance,true);
    const isEntry=state?.stage==='incoming',side=sideFaces.includes(e.faceId);
    const incomingNormal=before.x*e.normal.x+before.y*e.normal.y;
    const tangent=side?before.x:before.y;
    const margin=e.incidentIndex*Math.abs(tangent)-e.destinationIndex;
    const tir=margin>0;
    contacts++;
    if(!arrives(state,ray,hit,before)||!hasBrightness(ray)||before.x<=0||e.invalid||
      (isEntry?e.faceId!==entrance||incomingNormal>=0:
        state?.stage!=='inside'||e.faceId===entrance||incomingNormal<=0))
      fault??='unqualified native guide encounter';
    if(!Number.isFinite(margin)||Math.abs(margin)<=criticalBand)
      fault??='near-critical guide encounter';
    const result=incident.call(this,ray,index,point,...rest),after=direction(ray);
    const outgoingNormal=after.x*e.normal.x+after.y*e.normal.y;
    const expectedTangent=tir?tangent:tangent*e.incidentIndex/e.destinationIndex;
    if(!samePoint(point,hit)||!near(ray.p1.x,hit.x)||!near(ray.p1.y,hit.y)||!hasBrightness(ray)||
      result?.isUndefinedBehavior||result?.isAbsorbed||result?.newRays?.length||after.x<=0||
      (result===undefined)!==tir||!near(side?after.x:after.y,expectedTangent,1e-8)||
      (tir?incomingNormal*outgoingNormal>=0:incomingNormal*outgoingNormal<=0))
      fault??='unqualified native guide branch';
    if(state){
      if(isEntry)state.stage='inside';
      else if(tir){
        if(!side)fault??='total internal reflection on an unqualified face';
        state.bounces++;
        reflections++;
      }else{
        if(e.faceId===farFace)counts[state.bounces?'guidedFarFace':'directFarFace']++;
        else if(side&&state.bounces===0)counts.sideLeak++;
        else fault??='unqualified exit from the guide';
        // The remainder is free space. Check the finite detector aperture
        // against this actual outgoing ray and require its native callback
        // when it should cross well inside the segment.
        const detectorY=-ray.p1.y+(d.x-ray.p1.x)*after.y/after.x;
        const edgeGap=Math.abs(detectorY-d.y)-d.length/2;
        if(!Number.isFinite(edgeGap)||Math.abs(edgeGap)<=clearance+1e-7)
          fault??='ambiguous downstream detector endpoint';
        state.expectedDetector=edgeGap<0;
        state.stage='exited';
      }
      state.origin={...ray.p1};
      state.heading=after;
    }
    return result;
  };
  gauge.onRayIncident=function(ray,index,point,...rest){
    const state=active.get(ray),before=direction(ray);
    if(!arrives(state,ray,point,before)||state?.stage!=='exited'||!state.expectedDetector||state.detected||
      !hasBrightness(ray)||before.x<=0||!near(point.x,d.x)||Math.abs(point.y+d.y)>=d.length/2-clearance)
      fault??='unqualified downstream detector encounter';
    const expected=expectedDetectorPassage(this,ray,point,expectedPower,detectorSign);
    const result=detect.call(this,ray,index,point,...rest);
    if(!headingMatches(before,direction(ray))||!preservesDetectorPassage(this,ray,point,result,expected))
      fault??='unqualified downstream detector passage';
    if(state)state.detected=true;
    hits++;
    expectedPower+=detectorSign*(channel+channel);
    return result;
  };
  return {
    key:'v36GuideFanVerified',
    finish(emitted,interfaces,warnings,_mirrors,detectors){
      const guide=interfaces?.[glass.id],sensor=detectors?.[detector.id];
      if(fault)return 'Native finite guide: '+fault+'.';
      if(starts!==1||emitted!==angles.length||warnings.length||active.size!==emitted||
        [...active.values()].some(ray=>ray.stage!=='exited'||ray.detected!==ray.expectedDetector)||
        counts.directFarFace+counts.guidedFarFace+counts.sideLeak!==emitted||
        guide?.interactions!==contacts||guide.transmitted!==emitted*2||
        guide.totalInternalReflections!==reflections||guide.reflected!==reflections||
        sensor?.crossings!==hits||sensor.signedPower!==expectedPower)
        return 'Incomplete native finite guide evidence.';
      return null;
    },
    decorate(interfaces){interfaces[glass.id].guideExits={...counts};}
  };
}
