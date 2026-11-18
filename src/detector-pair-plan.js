// B1a: exact two-native-run *planning* only. No ray solver, geometric image,
// line intersection, eye/pupil or implicit physical parameter choices.
import {prepareScene,inspectAuthoringRequest} from './authoring.js';
import {validate,mirrorEndpoints,UPSTREAM,serializeSave} from './contract.js';
import {interfaceNormal,signedSide} from './planar-media.js';
import {canonicalJSON,sha256Text,sceneHash,isRecord} from './qualified-utils.js';
import {PairInputError} from './detector-pair-json.js';

export const PAIR_FORMAT='opticsim-detector-selected-pair-request-v1';
export const PAIR_REPORT_FORMAT='opticsim-detector-selected-pair-report-v1';
export const PAIR_MANIFEST_FORMAT='opticsim-detector-selected-pair-manifest-v1';
export const PAIR_RESULT_KIND='native-finite-window-hits-only';
export const PAIR_GEOMETRY=Object.freeze({
  status:'withheld',value:null,reasonCode:'B1B_NUMERICAL_GATE_NOT_RELEASED'
});
const ID=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SCALES=Object.freeze({mm:1,cm:10,m:1000});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const err=(status,code,message)=>{throw new PairInputError(status,code,message);};
const limits=Object.freeze({
  detectorLengthMm:[2,10],minimumPlaneSeparationMm:1,
  headingIdentityToleranceDeg:1e-9,tangentParallelToleranceDeg:1e-9
});
export function pairCapabilities(){
  return structuredClone({
    format:PAIR_FORMAT,requestedResult:PAIR_RESULT_KIND,
    version:1,model:'one native v5 source, one native planar interface, one actual finite detector, two separately emitted rays',
    required:['format','apparatus','sourceId','interfaceId','detectorId','secondDirectionDeg','requestedResult'],
    apparatus:{required:['lengthUnit','runPolicy','components'],
      componentTypes:['point-source','planar-interface','ray-detector'],
      oneEach:true,sourceMode:'single-ray',runPolicies:['preview-v1','dense-v1'],
      lengthUnits:['mm','cm','m'],limits},
    outputs:'two independent native readout records; ALL public backintersection/image coordinates withheld',
    limitations:['No pupil, eye, visual image or continuous irradiance.',
      'Two separate native runs do not assert simultaneous rays.',
      'Native hit event order is not source lineage; no B1b numerical position is computed.']
  });
}
function inspectFacts(raw){
  const invalid=[],missing=[],unsupported=[];
  function obj(value,path,allowed,required=[]){
    if(value===undefined){missing.push(path+' missing object');return null;}
    if(!isRecord(value)){invalid.push(path+' must be an object');return null;}
    for(const k of Object.keys(value))
      if(!allowed.includes(k))invalid.push(path+'.'+k+' unsupported field');
    for(const k of required)
      if(!own(value,k))missing.push(path+'.'+k+' missing field');
    return value;
  }
  function primitive(o,k,path,kind,{min=-Infinity,max=Infinity,pattern=null}={}){
    if(!o||!own(o,k))return undefined;
    const v=o[k],expected=kind==='number'?typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max:
      kind==='boolean'?typeof v==='boolean':
      typeof v==='string'&&v.trim()!==''&&v.length<=1200&&(!pattern||pattern.test(v));
    if(!expected)invalid.push(path+'.'+k+' invalid '+kind+' or range');
    return expected?v:undefined;
  }
  const p=obj(raw,'$',['format','apparatus','sourceId','interfaceId','detectorId','secondDirectionDeg','requestedResult'],
    ['format','apparatus','sourceId','interfaceId','detectorId','secondDirectionDeg','requestedResult']);
  if(p){
    const format=primitive(p,'format','$','string');
    if(format&&format!==PAIR_FORMAT)invalid.push('$.format unknown request format');
    const requested=primitive(p,'requestedResult','$','string');
    if(requested&&requested!==PAIR_RESULT_KIND)invalid.push('$.requestedResult unsupported result');
    for(const k of ['sourceId','interfaceId','detectorId'])
      primitive(p,k,'$','string',{pattern:ID});
    primitive(p,'secondDirectionDeg','$','number',{min:-180,max:180});
    const apparatus=obj(p.apparatus,'$.apparatus',
      ['lengthUnit','title','runPolicy','components'],['lengthUnit','runPolicy','components']);
    if(apparatus){
      const unit=primitive(apparatus,'lengthUnit','$.apparatus','string');
      if(unit&&!own(SCALES,unit))invalid.push('$.apparatus.lengthUnit must be mm, cm, or m');
      const policy=primitive(apparatus,'runPolicy','$.apparatus','string');
      if(policy&&!['preview-v1','dense-v1'].includes(policy))
        invalid.push('$.apparatus.runPolicy unsupported');
      if(own(apparatus,'title'))primitive(apparatus,'title','$.apparatus','string');
      const cs=apparatus.components;
      if(cs!==undefined){
        if(!Array.isArray(cs)){invalid.push('$.apparatus.components must be array');}
        else{
          if(cs.length!==3)unsupported.push('Exactly one source, one plane and one detector are supported');
          const ids=new Set();
          for(const [i,c] of cs.entries()){
            const where='$.apparatus.components['+i+']';
            const base=obj(c,where,['id','type','parameters','emission'],['id','type','parameters']);
            if(!base)continue;
            const id=primitive(base,'id',where,'string',{pattern:ID});
            if(id){if(ids.has(id))invalid.push(where+'.id duplicated ID');ids.add(id);}
            const type=primitive(base,'type',where,'string');
            if(type&&!['point-source','planar-interface','ray-detector'].includes(type))
              unsupported.push(where+'.type unsupported optical component');
            if(type==='point-source'&&!own(base,'emission'))missing.push(where+'.emission missing');
            if(type&&type!=='point-source'&&own(base,'emission'))
              invalid.push(where+'.emission forbidden for non-source');
            const parameterNames=type==='point-source'?['x','y','brightness']:
              type==='planar-interface'?['x','y','normalDeg','negativeIndex','positiveIndex','partialReflection']:
              type==='ray-detector'?['x','y','orientationDeg','length']:[];
            const pa=obj(base.parameters,where+'.parameters',parameterNames,parameterNames);
            if(pa){
              for(const k of parameterNames){
                if(k==='partialReflection')primitive(pa,k,where+'.parameters','boolean');
                else primitive(pa,k,where+'.parameters','number',{
                  min:['negativeIndex','positiveIndex'].includes(k)?1:k==='brightness'?.01:
                    ['normalDeg','orientationDeg'].includes(k)?-180:k==='length'?1:-10000,
                  max:['negativeIndex','positiveIndex'].includes(k)?4:k==='brightness'?1:
                    ['normalDeg','orientationDeg'].includes(k)?180:10000
                });
              }
            }
            if(type==='point-source'){
              const em=obj(base.emission,where+'.emission',
                ['mode','directionDeg'],['mode','directionDeg']);
              if(em){
                const mode=primitive(em,'mode',where+'.emission','string');
                if(mode&&mode!=='single-ray')unsupported.push(where+'.emission.mode requires single-ray');
                primitive(em,'directionDeg',where+'.emission','number',{min:-180,max:180});
              }
            }
          }
          if(cs.length===3){
            for(const type of ['point-source','planar-interface','ray-detector'])
              if(cs.filter(c=>c?.type===type).length!==1)
                unsupported.push('Exactly one '+type+' required');
          }
        }
      }
    }
  }
  // Global precedence: invalid supplied fields/types before missing facts,
  // before correctly typed but unsupported physical scopes.
  if(invalid.length)err('invalid-input','INVALID_ENVELOPE',invalid.slice(0,8).join('; '));
  if(missing.length)err('needs-information','MISSING_REQUIRED_FACT',missing.slice(0,8).join('; '));
  if(unsupported.length)err('unavailable','UNSUPPORTED_B1A_SCOPE',unsupported.slice(0,8).join('; '));
}
function headingDifference(a,b){
  const delta=((a-b)%360+360)%360;
  return Math.min(delta,360-delta);
}
function unorientedAngleDifference(a,b){
  const delta=((a-b)%180+180)%180;
  return Math.min(delta,180-delta);
}
function checkB1aGeometry(doc,sourceId,interfaceId,detectorId){
  if(doc.schemaVersion!==5||doc.adapterVersion!==5||doc.upstreamCommit!==UPSTREAM||
    doc.physics.model!=='planar-media-tracing'||doc.physics.components.length!==3)
    err('unavailable','UNSUPPORTED_B1A_SCOPE','Only existing v5 planar-media-tracing is supported.');
  const components=doc.physics.components;
  const source=components.find(c=>c.id===sourceId&&c.type==='point-source');
  const plane=components.find(c=>c.id===interfaceId&&c.type==='planar-interface');
  const detector=components.find(c=>c.id===detectorId&&c.type==='ray-detector');
  if(!source||!plane||!detector)
    err('invalid-input','INVALID_ENVELOPE','Target IDs must name the one correctly typed authored source, plane and detector.');
  const p=plane.parameters,d=detector.parameters;
  if(d.length<limits.detectorLengthMm[0]||d.length>limits.detectorLengthMm[1])
    err('unavailable','UNSUPPORTED_B1A_SCOPE','Finite detector length must be between 2 and 10 mm.');
  if(unorientedAngleDifference(d.orientationDeg,p.normalDeg+90)>limits.tangentParallelToleranceDeg)
    err('unavailable','UNSUPPORTED_B1A_SCOPE','Detector tangent must be parallel to the physical plane.');
  const side=signedSide(p,source.parameters),other=signedSide(p,d);
  const endpoints=mirrorEndpoints(d),endSides=endpoints.map(e=>signedSide(p,e));
  if(Math.abs(side)<limits.minimumPlaneSeparationMm||Math.abs(other)<limits.minimumPlaneSeparationMm||
    endSides.some(s=>Math.abs(s)<limits.minimumPlaneSeparationMm||s*side>=0)||other*side>=0)
    err('unavailable','UNSUPPORTED_B1A_SCOPE','Source and entire finite detector must lie at least 1 mm on opposite plane sides.');
  for(const e of endpoints)
    if(Math.abs(e.x)>10000||Math.abs(e.y)>10000)
      err('unavailable','UNSUPPORTED_B1A_SCOPE','Detector endpoints exceed the scene coordinates.');
  return {source,plane,detector,objectSide:Math.sign(side),
    objectIndex:side<0?p.negativeIndex:p.positiveIndex,
    receivingIndex:side<0?p.positiveIndex:p.negativeIndex,
    normal:interfaceNormal(p)};
}
function familyCanonical(doc,sourceId){
  const clone=structuredClone(doc);
  clone.physics.components.sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const source=clone.physics.components.find(c=>c.id===sourceId);
  if(!source||source.type!=='point-source')throw Error('No unique source for native family comparison');
  delete source.emission.directionDeg;
  return canonicalJSON(clone);
}
export async function planDetectorSelectedPair(input){
  inspectFacts(input);
  const {apparatus,sourceId,interfaceId,detectorId,secondDirectionDeg}=input;
  const source=apparatus.components.find(c=>c.type==='point-source');
  if(headingDifference(source.emission.directionDeg,secondDirectionDeg)<=
    limits.headingIdentityToleranceDeg)
    err('invalid-input','IDENTICAL_SOURCE_HEADINGS','The second emission is not a distinguishable authored heading modulo 360 degrees.');
  // Reuse and respect the engine's existing authoring rules, not a second
  // native scene contract. No physical input is supplied by this code.
  const issues=inspectAuthoringRequest(apparatus);
  if(issues.length){
    const missing=issues.every(x=>x.code==='MISSING_VALUE');
    err(missing?'needs-information':'unavailable',
      missing?'MISSING_REQUIRED_FACT':'UNSUPPORTED_B1A_SCOPE',
      issues.map(x=>x.message).slice(0,5).join('; '));
  }
  let A;
  try{A=prepareScene(structuredClone(apparatus)).document;validate(A);}
  catch(e){err('unavailable','UNSUPPORTED_B1A_SCOPE','Existing v5 authoring rejected this apparatus: '+e.message);}
  checkB1aGeometry(A,sourceId,interfaceId,detectorId);
  const B=structuredClone(A);
  B.physics.components.find(c=>c.id===sourceId).emission.directionDeg=secondDirectionDeg;
  try{validate(B);}catch(e){err('unavailable','UNSUPPORTED_B1A_SCOPE','Second authored direction violates existing native scene rules: '+e.message);}
  checkB1aGeometry(B,sourceId,interfaceId,detectorId);
  const [shaA,shaB]=await Promise.all([sceneHash(A),sceneHash(B)]);
  if(shaA===shaB)err('invalid-input','IDENTICAL_SOURCE_HEADINGS','Both candidate native scenes have identical hashes.');
  const canonicalA=familyCanonical(A,sourceId),canonicalB=familyCanonical(B,sourceId);
  const [familyA,familyB]=await Promise.all([sha256Text(canonicalA),sha256Text(canonicalB)]);
  if(canonicalA!==canonicalB||familyA!==familyB)
    err('infrastructure-error','SCENE_FAMILY_MISMATCH','Native scenes differ in more than the one explicitly authored source direction.');
  // Full canonical bytes and hashes stay immutable throughout executor calls.
  return {format:'opticsim-detector-selected-pair-plan-v1',sourceId,interfaceId,detectorId,
    runPolicy:apparatus.runPolicy,
    firstDirectionDeg:source.emission.directionDeg,secondDirectionDeg,
    familySha256:familyA,
    scenes:[{role:'run-A',scene:A,sceneSha256:shaA,serialized:serializeSave(A)},
      {role:'run-B',scene:B,sceneSha256:shaB,serialized:serializeSave(B)}]};
}
