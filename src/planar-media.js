// Native planar-medium adapter and bounded read-only interaction observation.
// No Snell/Fresnel implementation, ray routing, intensity repair or resampling.
import {PRISM_TYPE,prismFaces,prismEncounter} from './triangular-prism.js';
import {POLYGON_TYPE,polygonFaces,polygonEncounter} from './polygon-dielectric.js';
import {CIRCULAR_TYPE,circularEncounter} from './circular-dielectric.js';
export const PLANAR_TYPE='planar-interface';
export const PLANAR_PARAMETERS=Object.freeze(['x','y','normalDeg','negativeIndex','positiveIndex','partialReflection']);
export function interfaceNormal(p){
  if(p.normalDeg===0)return {x:1,y:0};if(Math.abs(p.normalDeg)===180)return {x:-1,y:0};
  if(Math.abs(p.normalDeg)===90)return {x:0,y:Math.sign(p.normalDeg)};
  const a=p.normalDeg*Math.PI/180;return {x:Math.cos(a),y:Math.sin(a)};
}
export function signedSide(p,point){const n=interfaceNormal(p);return (point.x-p.x)*n.x+(point.y-p.y)*n.y;}
export function compileInterface(component){
  const p=component.parameters,n=interfaceNormal(p);
  // Native PlaneGlass is the positive-normal half-plane. Indices multiply in
  // overlapping native regions; parallel ordered ratios telescope to n/n0.
  return {type:'PlaneGlass',p1:{x:p.x,y:-p.y},p2:{x:p.x-100*n.y,y:-p.y-100*n.x},
    refIndex:p.positiveIndex/p.negativeIndex,partialReflect:p.partialReflection};
}
export function validatePlanarGeometry(components,endpoints,fail){
  const interfaces=components.filter(c=>c.type===PLANAR_TYPE),path='$.physics.components';
  if(interfaces.length<1||interfaces.length>4)fail(path,'planar media require 1–4 interfaces','UNSUPPORTED_SCOPE');
  if(components.some(c=>c.type==='ideal-lens'))fail(path,'ideal lenses in refractive media are not supported in this milestone','UNSUPPORTED_SCOPE');
  if(components.some(c=>c.type==='point-source'&&c.emission.mode!=='single-ray'))
    fail(path,'planar media currently require explicit native single-ray emission','UNSUPPORTED_SCOPE');
  const n=interfaceNormal(interfaces[0].parameters);
  for(const c of interfaces){const delta=Math.abs(c.parameters.normalDeg-interfaces[0].parameters.normalDeg);
    if(delta!==0&&delta!==360)fail(path,'interfaces must have parallel, consistently directed normals','UNSUPPORTED_SCOPE');}
  const ordered=[...interfaces].sort((a,b)=>n.x*(a.parameters.x-b.parameters.x)+n.y*(a.parameters.y-b.parameters.y));
  for(let i=1;i<ordered.length;i++){
    const a=ordered[i-1].parameters,b=ordered[i].parameters;
    if(n.x*(b.x-a.x)+n.y*(b.y-a.y)<.01)fail(path,'interface planes need at least 0.01 mm separation','UNSUPPORTED_SCOPE');
    if(a.positiveIndex!==b.negativeIndex)fail(path,'adjacent interfaces must explicitly agree on the intervening medium index','UNSUPPORTED_SCOPE');
  }
  for(const boundary of interfaces)for(const c of components){
    if(c.type==='point-source'&&Math.abs(signedSide(boundary.parameters,c.parameters))<.01)
      fail(path,'sources must be at least 0.01 mm from every interface plane','UNSUPPORTED_SCOPE');
    if(['plane-mirror','ray-detector'].includes(c.type)){
      const [a,b]=endpoints(c.parameters).map(p=>signedSide(boundary.parameters,p));
      if(Math.abs(a)<.01||Math.abs(b)<.01||Math.sign(a)!==Math.sign(b))
        fail(path,'finite mirrors/detectors must lie wholly within one medium, away from interfaces','UNSUPPORTED_SCOPE');
    }
  }
}
const direction=ray=>{
  const dx=ray.p2.x-ray.p1.x,dy=-(ray.p2.y-ray.p1.y),length=Math.hypot(dx,dy);
  return length>0&&Number.isFinite(length)?{x:dx/length,y:dy/length}:null;
};
const power=ray=>ray.brightness_s+ray.brightness_p;
const angle=(d,n)=>d?Math.atan2(Math.abs(d.x*n.y-d.y*n.x),Math.abs(d.x*n.x+d.y*n.y))*180/Math.PI:null;
export function observeInterfaceSet(doc,scene,idMap){
  const entries=doc.physics.components.filter(c=>c.type===PLANAR_TYPE||c.type===CIRCULAR_TYPE||c.type===PRISM_TYPE||c.type===POLYGON_TYPE).map(component=>{
    const native=scene.objs[idMap.get(component.id)],original=native.onRayIncident;
    const circular=component.type===CIRCULAR_TYPE,prism=component.type===PRISM_TYPE,
      polygon=component.type===POLYGON_TYPE,finite=prism||polygon;
    const meter={interactions:0,transmitted:0,reflected:0,totalInternalReflections:0,first:null,invalidObservations:0,
      ...(finite?{faces:Object.fromEntries((prism?prismFaces:polygonFaces)(component.parameters).map(f=>[f.id,{interactions:0,first:null}]))}:{})};
    native.onRayIncident=function(...args){
      const incoming=direction(args[0]),beforePower=power(args[0]);
      const encounter=prism?prismEncounter(component,args[2],incoming):polygon?polygonEncounter(component,args[2],incoming):circular?circularEncounter(component,args[2],incoming):null;
      const n=encounter?.normal||interfaceNormal(component.parameters);
      const incomingSign=incoming?Math.sign(incoming.x*n.x+incoming.y*n.y):0;
      if((circular||finite)&&(!incoming||![n.x,n.y,encounter.point.x,encounter.point.y].every(Number.isFinite)||
        Math.abs(incoming.x*n.x+incoming.y*n.y)<1e-10))meter.invalidObservations++;
      // Delegate exactly once, with identical arguments and return object.
      const returned=original.apply(this,args);
      const outputs=[...(!returned?.isAbsorbed?[args[0]]:[]),...(returned?.newRays||[])];
      const branches=outputs.map(ray=>{
        const d=direction(ray),brightness=power(ray),projection=d&&(d.x*n.x+d.y*n.y);
        if(!d||!Number.isFinite(brightness)||brightness<0){meter.invalidObservations++;return null;}
        return {kind:Math.abs(projection)<1e-10?'grazing':Math.sign(projection)===incomingSign?'transmitted':'reflected',
          angleDeg:angle(d,n),direction:d,relativePower:brightness};
      }).filter(Boolean);
      const transmitted=branches.find(b=>b.kind==='transmitted'),reflected=branches.find(b=>b.kind==='reflected');
      // In the pinned PlaneGlass/CircleGlass/Glass implementations the TIR path alone returns
      // undefined and leaves the reflected primary ray. Near-critical cases
      // retain the native decision; we do not reclassify using our own optics.
      const tir=returned===undefined&&!!reflected;
      meter.interactions++;meter.transmitted+=Number(!!transmitted);meter.reflected+=Number(!!reflected);
      meter.totalInternalReflections+=Number(tir);
      const event={incidentAngleDeg:angle(incoming,n),
        ...(encounter?{pointMm:encounter.point,outwardNormal:encounter.normal}:{}),
        ...(finite?{faceId:encounter.faceId,incidentDirection:incoming}:{}),
        from:encounter?.from??(incomingSign>0?'negative':'positive'),
        incidentIndex:encounter?.incidentIndex??(incomingSign>0?component.parameters.negativeIndex:component.parameters.positiveIndex),
        destinationIndex:encounter?.destinationIndex??(incomingSign>0?component.parameters.positiveIndex:component.parameters.negativeIndex),
        outcome:tir?'total-internal-reflection':returned?.isUndefinedBehavior?'undefined-native-interaction':
          transmitted?'transmission':branches.some(b=>b.kind==='grazing')?'grazing':'no-transmitted-primary',
        transmittedAngleDeg:transmitted?.angleDeg??null,reflectedAngleDeg:reflected?.angleDeg??null,
        incidentRelativePower:beforePower,branches,partialReflection:component.parameters.partialReflection,
        nativeTruncation:returned?.truncation||0,rayIndex:args[1]};
      if(!meter.first)meter.first=event;
      if(finite&&encounter.faceId){const face=meter.faces[encounter.faceId];face.interactions++;if(!face.first)face.first=event;}
      return returned;
    };
    return [component.id,meter];
  });
  if(!entries.length)return null;
  return {get byId(){return Object.fromEntries(entries.map(([id,m])=>[id,structuredClone(m)]));},
    get errors(){return entries.filter(([,m])=>m.invalidObservations).map(([id])=>id+': native interface emitted nonfinite or indeterminate encounter evidence');}};
}
