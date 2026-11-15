// Opt-in native object parentage for the REVIEWED v5 SingleRay/one-plane scope.
// No rays are created, routed, intersected, reordered or modified here.
// State is confined to one simulator run; only fully qualified projections escape.
export const NATIVE_PARENTAGE_LIMIT=64;
export const NATIVE_PARENTAGE_DETECTOR_LIMIT=32;
export const NATIVE_PARENTAGE_KIND='detector-ray-provenance';
const sourceType='point-source',faceType='planar-interface',detectorType='ray-detector';
const isObject=x=>x!==null&&typeof x==='object';
export function supportsNativeRayParentage(doc){
  const components=doc?.physics?.components;
  if(doc?.schemaVersion!==5||doc?.physics?.model!=='planar-media-tracing'||!Array.isArray(components))return false;
  const count=t=>components.filter(c=>c.type===t).length;
  return count(faceType)===1&&[1,2].includes(count(sourceType))&&[1,2].includes(count(detectorType))&&
    components.length===count(faceType)+count(sourceType)+count(detectorType)&&
    components.filter(c=>c.type===sourceType).every(c=>c.emission?.mode==='single-ray');
}
// Run-local identity registry is private. This object never leaves the native executor.
export function createNativeRayParentage(doc,scene,idMap,requestedIds){
  if(!supportsNativeRayParentage(doc)||!requestedIds?.length)return null;
  const ids=[...new Set(requestedIds)],components=doc.physics.components;
  if(ids.some(id=>!components.some(c=>c.id===id&&c.type===detectorType)))return null;
  const epoch=Symbol('native-ray-parentage-run');
  const tracked=new WeakMap(),nodes=new Map(),registered=new Map(),starts=new Map();
  const detectorHits=new Map(components.filter(c=>c.type===detectorType).map(c=>[c.id,{count:0,tokens:[],overflow:false}]));
  const expected=components.map(c=>[c.id,c.type,scene.objs[idMap.get(c.id)]]);
  const expectedById=new Map(expected.map(([id,type,native])=>[id,{type,native}]));
  let next=0,invalid=false,globalOverflow=false,finished=false;
  const fail=()=>{invalid=true;};
  const lookup=ray=>isObject(ray)?tracked.get(ray):null;
  const record=(ray,node)=>{
    if(!isObject(ray)||tracked.has(ray)){fail();return null;}
    if(++next>NATIVE_PARENTAGE_LIMIT){globalOverflow=true;return null;}
    const token='r'+next,entry={token,...node};
    tracked.set(ray,entry);nodes.set(token,entry);return entry;
  };
  return {
    epoch,
    // Existing native observation owners install exactly ONE wrapper per method.
    register(id,type,native,wrapper,method){
      const required=expectedById.get(id);
      if(!required||required.type!==type||required.native!==native||registered.has(id)||
        typeof wrapper!=='function'||native[method]!==wrapper){fail();return;}
      registered.set(id,{native,wrapper,method});
    },
    sourceStarted(id,result){
      starts.set(id,(starts.get(id)||0)+1);
      const rays=result?.newRays;
      if(!Array.isArray(rays)||rays.length!==1||starts.get(id)!==1){fail();return;}
      record(rays[0],{origin:'native-emission',sourceId:id,parentToken:null,spawnComponentId:null});
    },
    incident(id,ray,result){
      const parent=lookup(ray);
      if(!parent)fail();
      if(result?.newRays!==undefined&&!Array.isArray(result.newRays)){fail();return;}
      for(const child of result?.newRays||[]){
        if(child===ray||!parent){fail();continue;}
        record(child,{origin:'native-spawn',sourceId:parent.sourceId,
          parentToken:parent.token,spawnComponentId:id});
      }
    },
    detector(id,ray){
      const entry=detectorHits.get(id);
      if(!entry){fail();return;}
      entry.count++;
      const parent=lookup(ray);
      if(!parent)fail();
      if(entry.tokens.length<NATIVE_PARENTAGE_DETECTOR_LIMIT)entry.tokens.push(parent?.token??null);
      else entry.overflow=true;
    },
    finish({event,simulator,errors,warnings,sources,detectors}){
      if(finished)return null;finished=true;
      // Never publish raw identifiers on stopped/incomplete/failed runs.
      if(event!=='simulationComplete'||errors.length||simulator.totalTruncation!==0||
        simulator.totalUndefinedBehavior!==0)return null;
      let reason=null;
      if(warnings.length)reason='NATIVE_PROVENANCE_UNQUALIFIED';
      for(const [id,type,native] of expected){
        const r=registered.get(id);
        if(!r||r.native!==native||native[r.method]!==r.wrapper)fail();
        if(type===sourceType&&starts.get(id)!==1)fail();
      }
      if(registered.size!==expected.length||invalid)reason??='PROVENANCE_UNKNOWN_OR_INCONSISTENT';
      const emitted=sources?.byId;
      if(!emitted||Object.keys(emitted).length!==starts.size||
        expected.some(([id,type])=>type===sourceType&&emitted[id]?.emitted!==1))
        reason??='PROVENANCE_UNKNOWN_OR_INCONSISTENT';
      const readings=detectors?.byId;
      if(!readings||expected.some(([id,type])=>type===detectorType&&
        (!Number.isInteger(readings[id]?.crossings)||!Number.isFinite(readings[id]?.signedPower)||
        readings[id].crossings!==detectorHits.get(id)?.count)))
        reason??='PROVENANCE_UNKNOWN_OR_INCONSISTENT';
      if(globalOverflow)reason??='PROVENANCE_LIMIT_EXCEEDED';
      const output={};
      for(const id of ids){
        const hits=detectorHits.get(id);
        const localReason=reason||(hits.overflow?'PROVENANCE_LIMIT_EXCEEDED':null);
        if(localReason){output[id]={status:'unavailable',reasonCode:localReason,value:null};continue;}
        const needed=new Map();let bad=false;
        for(const token of hits.tokens){
          let cursor=nodes.get(token);
          if(!cursor){bad=true;break;}
          const seen=new Set();
          while(cursor){
            if(seen.has(cursor.token)){bad=true;break;}
            seen.add(cursor.token);needed.set(cursor.token,cursor);
            cursor=cursor.parentToken===null?null:nodes.get(cursor.parentToken);
            if(cursor===undefined){bad=true;break;}
          }
          if(bad)break;
        }
        if(bad||needed.size>NATIVE_PARENTAGE_LIMIT){
          output[id]={status:'unavailable',reasonCode:'PROVENANCE_UNKNOWN_OR_INCONSISTENT',value:null};
          continue;
        }
        // Callbacks encode observed parenthood only, NOT every in-place optical event.
        output[id]={status:'complete',reasonCode:null,value:{
          nodes:[...needed.values()].sort((a,b)=>Number(a.token.slice(1))-Number(b.token.slice(1))),
          crossings:hits.tokens.map(rayToken=>({rayToken}))
        }};
      }
      return output;
    }
  };
}
