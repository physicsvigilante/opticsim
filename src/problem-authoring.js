// Minimal problem-to-scene preparation over the SAME strict component contract.
// These opt-in choices change simulated physics; they are not cosmetic defaults.
// Input completeness never certifies interpretation or the question's answer.
import {capabilities, prepareScene, AuthoringError} from './authoring.js';
import {COMPONENT_TYPES} from './contract.js';

const scales=Object.freeze({mm:1,cm:10,m:1000});
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const policy=Object.freeze({
  version:'illustration-v1',sourceBrightness:0.08,lensApertureMm:100,
  unspecifiedSourceEmission:'full-circle'
});
const unsupportedCodes=new Set(['UNSUPPORTED_COMPONENT','UNSUPPORTED_SCOPE',
  'UNSUPPORTED_MODE','UNSUPPORTED_UNIT','UNSUPPORTED_POLICY']);
export function problemCapabilities(){
  return {
    ...capabilities(),
    problemAuthoring:{
      interfaceVersion:2,policyVersion:policy.version,
      command:'problem',optInFlag:'--illustrate',
      choices:{
        'point-source.parameters.brightness':{
          value:policy.sourceBrightness,unit:'relative native brightness'
        },
        'ideal-lens.parameters.apertureHeight':{
          value:policy.lensApertureMm,unit:'mm'
        },
        'point-source.emission.mode':{
          value:policy.unspecifiedSourceEmission,
          condition:'only when emission is entirely omitted or empty'
        }
      },
      statuses:['fully-specified','illustrative','needs-information','unsupported','invalid-input'],
      policy:'Only explicit illustration opt-in may fill these three physical fields. Choices can alter ray paths, clipping and detector readings. They are not evidence about the question. Other physical information is never inferred.',
      statusMeaning:'Preparation status only. Fully specified means the request is complete, not that it faithfully represents or answers the original problem.',
      provenance:'proposedChoices lists options; appliedChoices lists only values incorporated in an accepted scene. Save the input, scene and report together.',
      interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'
    }
  };
}

function choicesFor(input,illustration){
  const choices=[];
  if(!isObject(input)||!Array.isArray(input.components))return choices;
  for(const [i,component] of input.components.entries()){
    if(!isObject(component)||!COMPONENT_TYPES.includes(component.type))continue;
    const p=component.parameters;
    if(!isObject(p))continue;
    const prefix='$.components['+i+']';
    const choice=details=>choices.push({componentIndex:i,
      componentId:typeof component.id==='string'?component.id:null,
      physicalAssumption:true,...details});
    if(component.type==='point-source'){
      if(!has(p,'brightness')){
        const value=policy.sourceBrightness;
        choice({path:prefix+'.parameters.brightness',value,
          unit:'relative native brightness',
          purpose:'illustrative source strength, not measured radiant power'});
        if(illustration)p.brightness=value;
      }
      if(!has(component,'emission')||
        (isObject(component.emission)&&Object.keys(component.emission).length===0)){
        choice({path:prefix+'.emission.mode',value:policy.unspecifiedSourceEmission,
          unit:'mode',purpose:'illustrative emitter; actual emission pattern was not specified'});
        if(illustration)component.emission={mode:policy.unspecifiedSourceEmission};
      }
    }
    if(component.type==='ideal-lens'&&!has(p,'apertureHeight')){
      const scale=typeof input.lengthUnit==='string'&&has(scales,input.lengthUnit)?scales[input.lengthUnit]:null;
      if(scale){
        const value=policy.lensApertureMm/scale;
        choice({path:prefix+'.parameters.apertureHeight',value,
          unit:input.lengthUnit,canonicalValueMm:policy.lensApertureMm,
          purpose:'illustrative finite aperture; rays and detector readings may depend on it'});
        if(illustration)p.apertureHeight=value;
      }
    }
  }
  return choices;
}
function rejectedStatus(issues){
  // Syntax/values are distinct from unavailable physics. Neither is concealed
  // by an earlier missing field in a different component.
  if(issues.some(x=>x.code!=='MISSING_VALUE'&&!unsupportedCodes.has(x.code)))return 'invalid-input';
  return issues.some(x=>unsupportedCodes.has(x.code))?'unsupported':'needs-information';
}
export function resolveProblemRequest(request,{illustration=false}={}){
  if(typeof illustration!=='boolean')throw new AuthoringError([{
    path:'$.illustration',code:'INVALID_POLICY',message:'Illustration opt-in must be boolean'
  }]);
  const common={policyVersion:policy.version,
    interpretation:'not-assessed-by-engine',physicalFidelity:'not-assessed-by-engine',
    questionSupport:'not-assessed-by-engine'};
  let candidate;
  try{candidate=structuredClone(request);}
  catch{return {...common,status:'invalid-input',choices:[],proposedChoices:[],
    appliedChoices:[],prepared:null,issues:[{path:'$',code:'INVALID_INPUT',
      message:'Expected cloneable JSON request data'}]};}
  const proposedChoices=choicesFor(candidate,illustration);
  try{
    const prepared=prepareScene(candidate);
    const appliedChoices=illustration?proposedChoices.map(c=>({...c,
      componentId:prepared.document.physics.components[c.componentIndex].id})):[];
    return {...common,status:appliedChoices.length?'illustrative':'fully-specified',
      // Retained compatibility alias; new consumers must use the explicit names.
      choices:proposedChoices,proposedChoices,appliedChoices,issues:[],prepared};
  }catch(error){
    if(!(error instanceof AuthoringError))throw error;
    return {...common,status:rejectedStatus(error.issues),
      choices:proposedChoices,proposedChoices,appliedChoices:[],
      issues:error.issues,prepared:null};
  }
}
