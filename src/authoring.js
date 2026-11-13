// Small LLM authoring view over the EXISTING strict opticsim scene contract.
// Interpret/choose physics outside this module. No new ray tracing, geometry DSL,
// physical parameter guessing, implicit native JSON or network service.
import {NATIVE_OBSERVATION_KEYS} from './native-observations.js';
import {PRISM_TYPE,prismVertices} from './triangular-prism.js';
import {POLYGON_TYPE,polygonVertices} from './polygon-dielectric.js';
import {CIRCULAR_TYPE,circularExtents} from './circular-dielectric.js';
import {isCurved,curvedPoints} from './curved-mirrors.js';
import {validate,UPSTREAM,SAMPLING_PRESETS,COMPONENT_TYPES,componentParameterNames,
  GENERAL_SCOPE,MAX_AUTHORING_COMPONENTS,COMPONENT_BOUNDS,LENGTH_PARAMETERS,mirrorEndpoints} from './contract.js';

const lengthScales=Object.freeze({mm:1,cm:10,m:1000});
const policies=Object.freeze({
  'preview-v1':Object.freeze({rayDensity:SAMPLING_PRESETS.medium,maxRayDepth:8,processedRayLimit:10000}),
  'dense-v1':Object.freeze({rayDensity:SAMPLING_PRESETS.dense,maxRayDepth:8,processedRayLimit:10000})
});
const prefixes=Object.freeze({
  'point-source':'source','ideal-lens':'lens','plane-mirror':'mirror','line-blocker':'blocker','ray-detector':'detector','planar-interface':'interface','ideal-curved-mirror':'ideal-mirror','circular-arc-mirror':'arc-mirror',[CIRCULAR_TYPE]:'dielectric',[PRISM_TYPE]:'prism',[POLYGON_TYPE]:'glass'
});
const lengthKeys=new Set(LENGTH_PARAMETERS);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const idPattern=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const issue=(path,code,message)=>({path,code,message});
const fail=(issues)=>{throw new AuthoringError(issues);};
function checkObject(value,path,allowed,required=[]) {
  if(!isObject(value))fail([issue(path,'EXPECTED_OBJECT','Expected an object')]);
  const issues=[
    ...Object.keys(value).filter(key=>!allowed.includes(key))
      .map(key=>issue(path+'.'+key,'UNSUPPORTED_FIELD','This field is not in the authoring contract')),
    ...required.filter(key=>!own(value,key))
      .map(key=>issue(path+'.'+key,'MISSING_VALUE','Required information was not provided'))
  ];
  if(issues.length)fail(issues);
}
function units(value,path) {
  if(typeof value!=='string'||!own(lengthScales,value))
    fail([issue(path,'UNSUPPORTED_UNIT','Use mm, cm or m; no unit will be inferred')]);
  return lengthScales[value];
}
function physicalNumber(value,path) {
  if(typeof value!=='number'||!Number.isFinite(value))
    fail([issue(path,'INVALID_VALUE','Expected a finite numeric value, not text or an unlabelled expression')]);
  return value;
}
function canonicalValue(key,value,scale,path) {
  if(key==='partialReflection'){if(typeof value!=='boolean')fail([issue(path,'INVALID_VALUE','Expected an explicit boolean')]);return value;}
  return physicalNumber(value,path)*(lengthKeys.has(key)?scale:1);
}
export class AuthoringError extends Error {
  constructor(issues){
    super(issues.map(x=>x.path+': '+x.message).join('; '));
    this.name='AuthoringError';this.code='AUTHORING_REJECTED';this.issues=issues;
  }
}
export function capabilities() {
  return {
    opaqueLineBlockers:{model:'general-component-tracing',nativeType:'Blocker',max:2,scope:'Up to two finite fully opaque line absorbers, with existing general sources/lenses/plane mirrors and external detectors. Native sampled absorption counts; no shadow visibility or image inference.'},
    polygonDielectrics:{schemaVersion:9,model:'polygon-dielectric-tracing',scope:'One strictly convex four-vertex dielectric, 1–4 exact rays and 0–2 external detectors; no other optics or nested media',geometry:'Four explicit vertices; edges and altitudes >=1 mm; all four faces are finite'},
    triangularPrisms:{schemaVersion:8,model:'triangular-prism-tracing',scope:'One stationary triangle; 1–4 explicit single rays; 0–2 external detectors; no other optics',geometry:'Three explicit vertices in either winding; edges and altitudes >=1 mm; initial corner rays excluded; no face route supplied'},
    interfaceVersion:1,canonicalFormat:'ray-optics-2d',schemaVersion:4,maxComponents:MAX_AUTHORING_COMPONENTS,
    circularDielectric:{schemaVersion:7,model:'circular-dielectric-tracing',scope:'Exactly one stationary circular region; 1–4 explicit single rays inside or outside; 0–2 external detectors; no other optics or nested regions',indices:'Required inside/outside absolute indices [1,4]; native ratio inside/outside',radius:'Positive radius >=2 mm; complete circle within coordinate bounds',partialReflection:'Required boolean; false explicitly omits Fresnel partial reflections, not TIR',clearance:'0.01 mm source/boundary and detector/circle separation; initial forward near-tangent rays within 0.01 mm are unsupported'},
    curvedMirrors:{schemaVersion:6,model:'curved-mirror-tracing',scope:'1–2 ideal/circular-arc mirrors; 1–4 sources; 0–2 plane mirrors and detectors; disjoint aperture disks; no lenses or refraction',normal:'Front-facing normal; f>0 or radius>0 means concave toward front; all dimensions explicit'},
    planarMedia:{schemaVersion:5,model:'planar-media-tracing',interfaces:'1–4 parallel consistently oriented planes; matching adjacent indices',sources:'1–4 single-ray emitters',lenses:'unsupported',indices:'absolute positive indices [1,4], normalized as native ratios',partialReflection:'required boolean; false explicitly neglects Fresnel partial reflection, not TIR'},
    model:'general-component-tracing',nativeUpstreamCommit:UPSTREAM,
    lengthUnits:Object.keys(lengthScales),coordinates:'x-right-y-up',
    lengthParameters:[...lengthKeys],
    componentTypes:Object.fromEntries(COMPONENT_TYPES.map(type=>[type,{
      parameters:componentParameterNames(type),
      ...(type==='planar-interface'?{booleanParameters:['partialReflection'],nativeType:'PlaneGlass',normal:'negative to positive side; degrees CCW in y-up'}:{}),
      ...(type===CIRCULAR_TYPE?{booleanParameters:['partialReflection'],nativeType:'CircleGlass',indices:['insideIndex','outsideIndex'],geometry:'Finite 2D circle, not an ideal thin lens or a truncated sphere'}:{}),
      ...(type===PRISM_TYPE?{nativeType:'Glass',booleanParameters:['partialReflection'],faceIds:['face-12','face-23','face-31'],geometry:'Three physical vertices; vertex order defines face labels, not a ray route'}:{}),
      ...(type===POLYGON_TYPE?{nativeType:'Glass',booleanParameters:['partialReflection'],faceIds:['face-12','face-23','face-34','face-41'],geometry:'One strictly convex four-vertex finite region, never a ray route'}:{}),
      ...(type==='line-blocker'?{nativeType:'Blocker',geometry:'Opaque finite line segment; centre, tangent orientation, and length are explicit; absorbs each actual native ray incident'}:{}),
      counts:{...GENERAL_SCOPE[type]},
      ...(isCurved(type)?{nativeType:type==='ideal-curved-mirror'?'IdealMirror':'ArcMirror',model:type==='ideal-curved-mirror'?'ideal Gaussian mapping':'native circular local-normal reflection; analytical image is paraxial'}:{}),
      ...(type==='point-source'?{emission:{mode:['full-circle','directional'],curvedSceneModes:['full-circle','directional','single-ray'],
        directionalFields:['directionDeg','angleDeg'],planarOnlyMode:'single-ray',circularOnlyMode:'single-ray',prismOnlyMode:'single-ray',polygonOnlyMode:'single-ray',singleRayFields:['directionDeg']}}:{})
    }])),
    bounds:COMPONENT_BOUNDS,
    runPolicies:Object.fromEntries(Object.entries(policies).map(([id,value])=>[id,{...value}])),
    requiredInput:['lengthUnit','components'],optionalInput:['title','runPolicy'],
    physicalPolicy:'All physical parameter values are required. Full-circle inactive angles are explicitly filled, not measured. No optical component or missing physical information is invented.',
    opticalGeometry:'Thin ideal lenses are vertical and centred at y=0. Mirror and detector orientationDeg is the tangent in y-up coordinates. Native surfaces must not intersect or overlap.',
    observations:[...NATIVE_OBSERVATION_KEYS],
    limitations:['native finite-ray sampling','signed relative detector power is not watts',
      'no image prediction for unconstrained general tracing','no source-specific detector provenance']
  };
}
// Collect independent field problems in one pass. Names and numerical limits
// come from the same live contract used below. Geometry is still validated only
// by the canonical validator once a complete document can be constructed.
export function inspectAuthoringRequest(request){
  const issues=[];
  const object=(value,path,allowed,required=[])=>{
    try{checkObject(value,path,allowed,required);}
    catch(error){if(!(error instanceof AuthoringError))throw error;issues.push(...error.issues);}
    return isObject(value);
  };
  if(!object(request,'$',['lengthUnit','components','title','runPolicy'],['lengthUnit','components']))return issues;
  let scale=null;
  if(own(request,'lengthUnit')){
    try{scale=units(request.lengthUnit,'$.lengthUnit');}
    catch(error){issues.push(...error.issues);}
  }
  if(own(request,'runPolicy')&&(typeof request.runPolicy!=='string'||!own(policies,request.runPolicy)))
    issues.push(issue('$.runPolicy','UNSUPPORTED_POLICY','Use a run policy exposed by capabilities()'));
  if(own(request,'title')&&(typeof request.title!=='string'||request.title.length>120))
    issues.push(issue('$.title','INVALID_TITLE','Expected a title of at most 120 characters'));
  if(!own(request,'components'))return issues;
  if(!Array.isArray(request.components)||request.components.length<1||request.components.length>MAX_AUTHORING_COMPONENTS){
    issues.push(issue('$.components','INVALID_COMPONENTS','Expected 1–'+MAX_AUTHORING_COMPONENTS+' bounded component objects'));
    return issues;
  }
  const number=(key,value,path,type=null)=>{
    if(key==='partialReflection'){if(typeof value!=='boolean')issues.push(issue(path,'INVALID_VALUE','Expected explicit boolean'));return;}
    if(typeof value!=='number'||!Number.isFinite(value)){
      issues.push(issue(path,'INVALID_VALUE','Expected a finite numeric value, not text or an unlabelled expression'));return;
    }
    if(lengthKeys.has(key)&&scale===null)return;
    const n=value*(lengthKeys.has(key)?scale:1),b=COMPONENT_BOUNDS;
    const bounds=key==='brightness'?b.brightness:
      ['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key)?b.refractiveIndex:
      key==='normalDeg'?b.orientationDeg:key==='orientationDeg'?b.orientationDeg:key==='directionDeg'?b.directionDeg:
      key==='angleDeg'?b.openingAngleDeg:
      ['length','apertureHeight'].includes(key)?b.positiveLengthMm:b.coordinateMm;
    if(!Number.isFinite(n)||n<bounds[0]||n>bounds[1]||
      (key==='focalLength'&&Math.abs(n)<b.minimumAbsFocalLengthMm)||
      (key==='radius'&&(type===CIRCULAR_TYPE?n<2:Math.abs(n)<2)))
      issues.push(issue(path,'INVALID_INPUT','Value is outside the live contract bounds'+
        (lengthKeys.has(key)?' after conversion to mm':'')));
  };
  const ids=new Set();
  for(const [i,c] of request.components.entries()){
    const path='$.components['+i+']';
    if(!object(c,path,['id','type','parameters','emission'],['type','parameters']))continue;
    if(own(c,'id')){
      if(typeof c.id!=='string'||!idPattern.test(c.id))
        issues.push(issue(path+'.id','INVALID_ID','ID must begin with a letter and use letters, digits, _ or -'));
      else if(ids.has(c.id))issues.push(issue(path+'.id','DUPLICATE_ID','Component IDs must be unique'));
      else ids.add(c.id);
    }
    if(!own(c,'type'))continue;
    if(!COMPONENT_TYPES.includes(c.type)){
      issues.push(issue(path+'.type','UNSUPPORTED_COMPONENT','Not a supported PhyDemo-backed component'));continue;
    }
    const required=componentParameterNames(c.type);
    if(own(c,'parameters')&&object(c.parameters,path+'.parameters',required,required))
      for(const key of required)if(own(c.parameters,key))number(key,c.parameters[key],path+'.parameters.'+key,c.type);
    if(c.type!=='point-source'){
      if(own(c,'emission'))issues.push(issue(path+'.emission','UNSUPPORTED_FIELD','Only sources have emission'));
      continue;
    }
    if(!own(c,'emission')){
      issues.push(issue(path+'.emission','MISSING_VALUE','Source emission must be explicitly specified'));continue;
    }
    if(!object(c.emission,path+'.emission',['mode','directionDeg','angleDeg'],['mode']))continue;
    if(own(c.emission,'mode')&&!['full-circle','directional','single-ray'].includes(c.emission.mode))
      issues.push(issue(path+'.emission.mode','UNSUPPORTED_MODE','Expected full-circle, directional, or schema-supported single-ray'));
    for(const key of ['directionDeg','angleDeg']){
      if(own(c.emission,key))number(key,c.emission[key],path+'.emission.'+key);
      else if(c.emission.mode==='directional'||c.emission.mode==='single-ray'&&key==='directionDeg')issues.push(issue(path+'.emission.'+key,
        'MISSING_VALUE','Directional emission requires the explicit physical angle'));
    }
  }
  return issues;
}
// Bounded camera preparation is presentation-only. It never modifies components.
function camera(components) {
  const vertices=[];
  for(const c of components) {
    const p=c.parameters;
    if(c.type==='point-source')vertices.push({x:p.x,y:p.y});
    else if(c.type===CIRCULAR_TYPE)vertices.push(...circularExtents(p));
    else if(c.type===PRISM_TYPE)vertices.push(...prismVertices(p));
    else if(c.type===POLYGON_TYPE)vertices.push(...polygonVertices(p));
    else if(isCurved(c.type))vertices.push(...curvedPoints(c));
    else if(c.type==='ideal-lens')vertices.push({x:p.x,y:-p.apertureHeight/2},
      {x:p.x,y:p.apertureHeight/2});
    else if(c.type==='planar-interface')vertices.push({x:p.x,y:p.y});
    else vertices.push(...mirrorEndpoints(p));
  }
  const xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=Math.max(320,maxX-minX+120),height=Math.max(240,maxY-minY+120);
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,
    zoom:Math.max(.03,Math.min(2,.85*1200/width,.85*700/height))};
}
export function prepareScene(request) {
  const issues=inspectAuthoringRequest(request);
  if(issues.length)fail(issues);
  const scale=units(request.lengthUnit,'$.lengthUnit');
  const policyName=own(request,'runPolicy')?request.runPolicy:'preview-v1';
  const title=own(request,'title')?request.title:'LLM-authored optical scene';
  const knownIds=new Set(request.components.filter(c=>own(c,'id')).map(c=>c.id)),assignedIds=[];
  const components=request.components.map((component,i)=>{
    const path='$.components['+i+']';
    const required=componentParameterNames(component.type);
    let id=component.id;
    if(!id) {
      let index=1,prefix=prefixes[component.type];
      while(knownIds.has(prefix+'-'+index))index++;
      id=prefix+'-'+index;knownIds.add(id);assignedIds.push({index:i,id});
    }
    const parameters=Object.fromEntries(required.map(key=>[key,canonicalValue(
      key,component.parameters[key],scale,path+'.parameters.'+key)]));
    const result={id,type:component.type,parameters};
    if(component.type==='point-source'){
      result.emission={mode:component.emission.mode,
        directionDeg:own(component.emission,'directionDeg')?component.emission.directionDeg:0,
        angleDeg:own(component.emission,'angleDeg')?component.emission.angleDeg:30};
    }
    return result;
  });
  const circular=components.some(c=>c.type===CIRCULAR_TYPE);
  const prism=components.some(c=>c.type===PRISM_TYPE),polygon=components.some(c=>c.type===POLYGON_TYPE);
  const planar=components.some(c=>c.type==='planar-interface'),curved=components.some(c=>isCurved(c.type));
  const doc={
    format:'ray-optics-2d',schemaVersion:polygon?9:prism?8:circular?7:curved?6:planar?5:4,adapterVersion:polygon?9:prism?8:circular?7:curved?6:planar?5:4,upstreamCommit:UPSTREAM,
    physics:{lengthUnit:'mm',coordinates:'x-right-y-up',
      model:polygon?'polygon-dielectric-tracing':prism?'triangular-prism-tracing':circular?'circular-dielectric-tracing':curved?'curved-mirror-tracing':planar?'planar-media-tracing':'general-component-tracing',components},
    presentation:{title,view:camera(components),mode:'rays',grid:false},
    simulation:{...policies[policyName]}
  };
  try{validate(doc);}
  catch(error){
    fail([issue(error.path||'$.physics',error.code||'INVALID_SCENE',error.message)]);
  }
  return {document:doc,preparation:{
    suppliedLengthUnit:request.lengthUnit,canonicalLengthUnit:'mm',
    runPolicy:policyName,assignedIds,
    defaulted: [
      ...(own(request,'title')?[]:['presentation.title']),
      ...(own(request,'runPolicy')?[]:['simulation.runPolicy']),
      'presentation.view','presentation.mode','presentation.grid',
      ...components.filter((c,i)=>c.type==='point-source'&&c.emission.mode==='single-ray'&&!own(request.components[i].emission,'angleDeg')).map(c=>c.id+'.inactiveConeAngle'),
      ...components.filter((c,i)=>c.type==='point-source'&&
        c.emission.mode==='full-circle'&&
        ['directionDeg','angleDeg'].some(key=>!own(request.components[i].emission,key)))
        .map(c=>c.id+'.inactiveEmissionAngles')
    ]
  }};
}
// Atomic targeted revision of an accepted canonical document. No component,
// optical model, ID, simulation setting or unknown field may be rewritten.
export function reviseScene(document,patch){
  try{validate(document);}catch(error){fail([issue(error.path||'$','INVALID_BASE',error.message)]);}
  checkObject(patch,'$',['changes'],['changes']);
  if(!Array.isArray(patch.changes)||!patch.changes.length||patch.changes.length>16)
    fail([issue('$.changes','INVALID_CHANGES','Expected 1–16 targeted changes')]);
  const next=structuredClone(document),seen=new Set(),issues=[];
  for(const [i,change] of patch.changes.entries()){
    const path='$.changes['+i+']';
    checkObject(change,path,['id','section','key','value','unit'],
      ['id','section','key','value']);
    const component=next.physics.components.find(c=>c.id===change.id);
    if(!component){issues.push(issue(path+'.id','UNKNOWN_COMPONENT','No component has that stable ID'));continue;}
    if(!['parameters','emission'].includes(change.section)||
      change.section==='emission'&&component.type!=='point-source'||
      !own(component[change.section],change.key)){
      issues.push(issue(path+'.key','UNKNOWN_PARAMETER','Not a supported parameter or emission field'));continue;
    }
    const identity=change.id+':'+change.section+':'+change.key;
    if(seen.has(identity)){issues.push(issue(path,'DUPLICATE_CHANGE','Update a field only once per revision'));continue;}
    seen.add(identity);
    if(change.section==='emission'&&change.key==='mode'){
      if(own(change,'unit')||!(document.schemaVersion===6?['single-ray','full-circle','directional']:(document.schemaVersion===5||document.schemaVersion===7||document.schemaVersion===8||document.schemaVersion===9)?['single-ray']:['full-circle','directional']).includes(change.value))
        issues.push(issue(path+'.value','INVALID_MODE','Expected full-circle or directional without units'));
      else component.emission.mode=change.value;
      continue;
    }
    if(own(change,'unit')&&!lengthKeys.has(change.key)){
      issues.push(issue(path+'.unit','UNSUPPORTED_UNIT','Units apply only to length parameters'));continue;
    }
    const scale=own(change,'unit')?units(change.unit,path+'.unit'):1;
    component[change.section][change.key]=canonicalValue(change.key,change.value,scale,path+'.value');
  }
  if(issues.length)fail(issues);
  // Inactive full-circle values are never an implicit new directional choice.
  for(const c of next.physics.components.filter(c=>c.type==='point-source')){
    const before=document.physics.components.find(x=>x.id===c.id);
    if(before.emission.mode==='full-circle'&&c.emission.mode==='directional') {
      for(const key of ['directionDeg','angleDeg'])
        if(!seen.has(c.id+':emission:'+key))
          issues.push(issue('$.changes','MISSING_VALUE',
            'Switching '+c.id+' to directional requires an explicit '+key+' in the same revision'));
    }
  }
  for(const c of next.physics.components.filter(c=>c.type==='point-source')){
    const before=document.physics.components.find(x=>x.id===c.id);
    if(before.emission.mode==='full-circle'&&c.emission.mode==='single-ray'&&
       !seen.has(c.id+':emission:directionDeg'))
      issues.push(issue('$.changes','MISSING_VALUE','Switching '+c.id+' to single-ray requires an explicit directionDeg in the same revision'));
  }
  if(issues.length)fail(issues);
  try{validate(next);}catch(error){fail([issue(error.path||'$',
    error.code||'INVALID_SCENE',error.message)]);}
  return {document:next,changesApplied:patch.changes.length};
}
