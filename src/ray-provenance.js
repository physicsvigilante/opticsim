// Opt-in, run-local observation of actual pinned-native ray object parentage.
// This module never traces a ray, computes an intersection or mutates PhyDemo.
export const PROVENANCE_OBJECT_LIMIT=64;
export const PROVENANCE_HIT_LIMIT=32;
export const PROVENANCE_METHOD='native-observed-object-parentage';
export const PROVENANCE_LIMITATION=
  'Direct observed native object parenthood only. Same-object optical interactions are not graph edges. '+
  'Tokens belong to one run; no full path, source-image truth, image detection, continuous illumination or irradiance is inferred.';

export function provenanceScope(doc,componentId=null) {
  const c=doc?.physics?.components;
  if(doc?.schemaVersion!==5||doc?.physics?.model!=='planar-media-tracing'||!Array.isArray(c))
    return false;
  const count=type=>c.filter(v=>v.type===type).length;
  if(count('planar-interface')!==1||count('point-source')<1||count('point-source')>2||
     count('ray-detector')<1||count('ray-detector')>2||
     c.length!==count('planar-interface')+count('point-source')+count('ray-detector')||
     c.some(v=>v.type==='point-source'&&v.emission?.mode!=='single-ray'))return false;
  return componentId===null||c.some(v=>v.id===componentId&&v.type==='ray-detector');
}
const isRay=ray=>ray&&typeof ray==='object'&&ray.p1&&ray.p2&&
  [ray.p1.x,ray.p1.y,ray.p2.x,ray.p2.y].every(Number.isFinite)&&
  Math.hypot(ray.p2.x-ray.p1.x,ray.p2.y-ray.p1.y)>0;

// One instance per execution. No global token counter / cached scene hash.
// The private epoch is a unique reference even across equal-SHA A -> B -> A runs.
export function createRayProvenanceTracker(doc,scene,idMap,requestedDetectorIds=[]) {
  if(!provenanceScope(doc)||!Array.isArray(requestedDetectorIds)||!requestedDetectorIds.length||
     requestedDetectorIds.some(id=>!provenanceScope(doc,id)))return null;
  const epoch={};
  const sources=doc.physics.components.filter(c=>c.type==='point-source');
  const detectors=doc.physics.components.filter(c=>c.type==='ray-detector');
  const expected=new Map(doc.physics.components.map(c=>[c.id,{
    type:c.type,instance:scene.objs[idMap.get(c.id)],
    method:c.type==='point-source'?'onSimulationStart':'onRayIncident'
  }]));
  const installed=new Map(),starts=new Map(sources.map(c=>[c.id,0]));
  const detectorCounts=new Map(detectors.map(c=>[c.id,0]));
  const selected=new Set(requestedDetectorIds),hits=new Map(requestedDetectorIds.map(id=>[id,[]]));
  const hitOverflow=new Set(),seen=new WeakMap(),nodes=new Map();
  let serial=0,fault=null,finished=false;
  const bad=code=>{fault??=code;};
  const identity=ray=>ray&&typeof ray==='object'?seen.get(ray):null;
  const add=(ray,sourceId,parentToken,spawnComponentId)=>{
    if(!isRay(ray)||identity(ray)){bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return null;}
    if(nodes.size>=PROVENANCE_OBJECT_LIMIT){bad('PROVENANCE_LIMIT_EXCEEDED');return null;}
    const token='r'+(++serial);
    const node={token,origin:parentToken===null?'native-emission':'native-spawn',
      sourceId,parentToken,spawnComponentId};
    seen.set(ray,node);nodes.set(token,node);return node;
  };
  function register(id,obj,method,handler) {
    const e=expected.get(id);
    if(!e||installed.has(id)||e.instance!==obj||e.method!==method||
       typeof handler!=='function'||obj?.[method]!==handler) {
      bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return;
    }
    installed.set(id,{obj,method,handler});
  }
  function assertInstalled(){
    if(installed.size!==expected.size||idMap.size!==expected.size) {
      bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return false;
    }
    const indices=new Set();
    for(const [id,e] of expected){
      const item=installed.get(id),index=idMap.get(id);
      if(!item||!Number.isInteger(index)||index<0||indices.has(index)||
         scene.objs[index]!==e.instance||item.obj!==e.instance||
         item.method!==e.method||item.obj[item.method]!==item.handler)
        bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
      indices.add(index);
    }
    return !fault;
  }
  function sourceStart(id,result){
    if(finished){bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return;}
    starts.set(id,(starts.get(id)??0)+1);
    if(!starts.has(id)||starts.get(id)!==1||
       !Array.isArray(result?.newRays)||result.newRays.length!==1){
      bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return;
    }
    add(result.newRays[0],id,null,null);
  }
  function interfaceIncident(id,ray,result){
    if(finished){bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return;}
    const parent=identity(ray);
    if(!parent)bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
    if(result?.newRays!==undefined&&!Array.isArray(result.newRays)){
      bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return;
    }
    for(const child of result?.newRays??[]){
      if(!parent||child===ray||identity(child)){
        bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');continue;
      }
      add(child,parent.sourceId,parent.token,id);
    }
  }
  function detectorIncident(id,ray,geometryValid=true){
    if(finished){bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');return;}
    const count=(detectorCounts.get(id)??0)+1;
    detectorCounts.set(id,count);
    const current=identity(ray);
    if(!current||!geometryValid)bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
    if(selected.has(id)){
      if(count>PROVENANCE_HIT_LIMIT)hitOverflow.add(id);
      else hits.get(id)?.push(current?.token??null);
    }
  }
  function project({event,errors,warnings,truncation,undefinedBehavior,emissionsById,detectorsById}){
    if(finished)return null; // The same run cannot publish twice.
    finished=true;
    // No graph, nodes or tokens may appear publicly unless the whole native run
    // is terminal, complete, current and all checks have passed.
    if(event!=='simulationComplete'||errors?.length||truncation!==0||undefinedBehavior!==0)
      return null;
    assertInstalled();
    for(const source of sources){
      if(starts.get(source.id)!==1||emissionsById?.[source.id]?.emitted!==1)
        bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
    }
    if(Object.keys(emissionsById??{}).length!==sources.length)
      bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
    for(const detector of detectors){
      const count=detectorCounts.get(detector.id);
      if(!Number.isInteger(count)||detectorsById?.[detector.id]?.crossings!==count)
        bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
      // An independent native Detector.power state can expose a missing
      // callback recorder even when *both* software counters silently say 0.
      // Zero signed power alone cannot prove zero crossings (cancellation).
      const nativePower=expected.get(detector.id)?.instance?.power;
      if(count===0&&Number.isFinite(nativePower)&&nativePower!==0)
        bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
    }
    if(Object.keys(detectorsById??{}).length!==detectors.length)
      bad('PROVENANCE_UNKNOWN_OR_INCONSISTENT');
    // Native warnings take precedence over a clean authored approximation.
    const globalReason=warnings?.length?'NATIVE_PROVENANCE_UNQUALIFIED':fault;
    const output={};
    for(const id of selected){
      const reason=globalReason||(hitOverflow.has(id)?'PROVENANCE_LIMIT_EXCEEDED':null);
      if(reason){output[id]={status:'unavailable',reasonCode:reason,value:null};continue;}
      const closure=new Set();
      let consistent=true;
      for(const token of hits.get(id)??[]){
        let current=nodes.get(token),steps=0;
        while(current){
          if(closure.has(current.token))break;
          if(++steps>PROVENANCE_OBJECT_LIMIT){consistent=false;break;}
          closure.add(current.token);
          if(current.parentToken===null){
            if(current.origin!=='native-emission')consistent=false;
            break;
          }
          if(current.origin!=='native-spawn')consistent=false;
          current=nodes.get(current.parentToken);
          if(!current)consistent=false;
        }
        if(!consistent)break;
      }
      if(!consistent||closure.size>PROVENANCE_OBJECT_LIMIT) {
        output[id]={status:'unavailable',reasonCode:'PROVENANCE_UNKNOWN_OR_INCONSISTENT',value:null};
      }else{
        const members=[...nodes.values()].filter(node=>closure.has(node.token));
        output[id]={status:'complete',reasonCode:null,value:{
          nodes:members,crossings:(hits.get(id)??[]).map(rayToken=>({rayToken}))
        }};
      }
    }
    return output;
  }
  return {epoch,register,assertInstalled,sourceStart,interfaceIncident,detectorIncident,project};
}
