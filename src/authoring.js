// Small LLM authoring view over the EXISTING strict opticsim scene contract.
// Interpret/choose physics outside this module. No new ray tracing, geometry DSL,
// physical parameter guessing, implicit native JSON or network service.
import {validate,UPSTREAM,SAMPLING_PRESETS,COMPONENT_TYPES,componentParameterNames,
  GENERAL_SCOPE,COMPONENT_BOUNDS,LENGTH_PARAMETERS,mirrorEndpoints} from './contract.js';

const lengthScales=Object.freeze({mm:1,cm:10,m:1000});
const policies=Object.freeze({
  'preview-v1':Object.freeze({rayDensity:SAMPLING_PRESETS.medium,maxRayDepth:8,processedRayLimit:10000}),
  'dense-v1':Object.freeze({rayDensity:SAMPLING_PRESETS.dense,maxRayDepth:8,processedRayLimit:10000})
});
const prefixes=Object.freeze({
  'point-source':'source','ideal-lens':'lens','plane-mirror':'mirror','ray-detector':'detector'
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
  if(!own(lengthScales,value))
    fail([issue(path,'UNSUPPORTED_UNIT','Use mm, cm or m; no unit will be inferred')]);
  return lengthScales[value];
}
function physicalNumber(value,path) {
  if(typeof value!=='number'||!Number.isFinite(value))
    fail([issue(path,'INVALID_VALUE','Expected a finite numeric value, not text or an unlabelled expression')]);
  return value;
}
function canonicalValue(key,value,scale,path) {
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
    interfaceVersion:1,canonicalFormat:'ray-optics-2d',schemaVersion:4,
    model:'general-component-tracing',nativeUpstreamCommit:UPSTREAM,
    lengthUnits:Object.keys(lengthScales),coordinates:'x-right-y-up',
    lengthParameters:[...lengthKeys],
    componentTypes:Object.fromEntries(COMPONENT_TYPES.map(type=>[type,{
      parameters:componentParameterNames(type),
      counts:{...GENERAL_SCOPE[type]},
      ...(type==='point-source'?{emission:{mode:['full-circle','directional'],
        directionalFields:['directionDeg','angleDeg']}}:{})
    }])),
    bounds:COMPONENT_BOUNDS,
    runPolicies:Object.fromEntries(Object.entries(policies).map(([id,value])=>[id,{...value}])),
    requiredInput:['lengthUnit','components'],optionalInput:['title','runPolicy'],
    physicalPolicy:'All physical parameter values are required. Full-circle inactive angles are explicitly filled, not measured. No optical component or missing physical information is invented.',
    opticalGeometry:'Thin ideal lenses are vertical and centred at y=0. Mirror and detector orientationDeg is the tangent in y-up coordinates. Native surfaces must not intersect or overlap.',
    observations:['emissionsById','reflectionsById','detectorsById'],
    limitations:['native finite-ray sampling','signed relative detector power is not watts',
      'no image prediction for unconstrained general tracing','no source-specific detector provenance']
  };
}
// Bounded camera preparation is presentation-only. It never modifies components.
function camera(components) {
  const vertices=[];
  for(const c of components) {
    const p=c.parameters;
    if(c.type==='point-source')vertices.push({x:p.x,y:p.y});
    else if(c.type==='ideal-lens')vertices.push({x:p.x,y:-p.apertureHeight/2},
      {x:p.x,y:p.apertureHeight/2});
    else vertices.push(...mirrorEndpoints(p));
  }
  const xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const width=Math.max(320,maxX-minX+120),height=Math.max(240,maxY-minY+120);
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,
    zoom:Math.max(.03,Math.min(2,.85*1200/width,.85*700/height))};
}
export function prepareScene(request) {
  checkObject(request,'$',['lengthUnit','components','title','runPolicy'],
    ['lengthUnit','components']);
  const scale=units(request.lengthUnit,'$.lengthUnit');
  if(!Array.isArray(request.components)||request.components.length<1||request.components.length>14)
    fail([issue('$.components','INVALID_COMPONENTS','Expected 1–14 bounded component objects')]);
  const policyName=own(request,'runPolicy')?request.runPolicy:'preview-v1';
  if(!own(policies,policyName))
    fail([issue('$.runPolicy','UNSUPPORTED_POLICY','Use a run policy exposed by capabilities()')]);
  const title=own(request,'title')?request.title:'LLM-authored optical scene';
  if(typeof title!=='string'||title.length>120)
    fail([issue('$.title','INVALID_TITLE','Expected a title of at most 120 characters')]);
  const knownIds=new Set(),assignedIds=[];
  for(const [i,component] of request.components.entries()){
    const path='$.components['+i+']';
    if(!isObject(component))fail([issue(path,'EXPECTED_OBJECT','Expected a component object')]);
    if(own(component,'id')){
      if(typeof component.id!=='string'||!idPattern.test(component.id))
        fail([issue(path+'.id','INVALID_ID','ID must begin with a letter and use letters, digits, _ or -')]);
      if(knownIds.has(component.id))
        fail([issue(path+'.id','DUPLICATE_ID','Component IDs must be unique')]);
      knownIds.add(component.id);
    }
  }
  const missing=[];
  const components=request.components.map((component,i)=>{
    const path='$.components['+i+']';
    checkObject(component,path,['id','type','parameters','emission'],['type','parameters']);
    if(!COMPONENT_TYPES.includes(component.type))
      fail([issue(path+'.type','UNSUPPORTED_COMPONENT','Not a supported PhyDemo-backed component')]);
    if(component.type!=='point-source'&&own(component,'emission'))
      fail([issue(path+'.emission','UNSUPPORTED_FIELD','Only sources have emission')]);
    const required=componentParameterNames(component.type);
    checkObject(component.parameters,path+'.parameters',required,required);
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
      checkObject(component.emission,path+'.emission',['mode','directionDeg','angleDeg'],['mode']);
      const mode=component.emission.mode;
      if(!['full-circle','directional'].includes(mode))
        fail([issue(path+'.emission.mode','UNSUPPORTED_MODE','Expected full-circle or directional')]);
      if(mode==='directional'){
        for(const key of ['directionDeg','angleDeg'])
          if(!own(component.emission,key))
            missing.push(issue(path+'.emission.'+key,'MISSING_VALUE',
              'Directional emission requires the explicit physical angle'));
        if(missing.length)return result; // finish collecting missing angles below.
      }
      result.emission={mode,directionDeg:own(component.emission,'directionDeg')?
        physicalNumber(component.emission.directionDeg,path+'.emission.directionDeg'):0,
        angleDeg:own(component.emission,'angleDeg')?
        physicalNumber(component.emission.angleDeg,path+'.emission.angleDeg'):30};
    }
    return result;
  });
  if(missing.length)fail(missing);
  let doc={
    format:'ray-optics-2d',schemaVersion:4,adapterVersion:4,upstreamCommit:UPSTREAM,
    physics:{lengthUnit:'mm',coordinates:'x-right-y-up',
      model:'general-component-tracing',components},
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
      if(own(change,'unit')||!['full-circle','directional'].includes(change.value))
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
  if(issues.length)fail(issues);
  try{validate(next);}catch(error){fail([issue(error.path||'$',
    error.code||'INVALID_SCENE',error.message)]);}
  return {document:next,changesApplied:patch.changes.length};
}
