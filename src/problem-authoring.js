// Minimal problem-to-scene preparation over the SAME strict component contract.
// No new apparatus DSL, custom optics, implicit physical inference or API calls.
// An incomplete textbook question is not evidence for physical values omitted
// from the statement. Only explicitly opted-in illustration choices are filled.
import {capabilities, prepareScene, AuthoringError} from './authoring.js';
import {COMPONENT_TYPES} from './contract.js';

const scales=Object.freeze({mm:1,cm:10,m:1000});
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const policy=Object.freeze({
  sourceBrightness:0.08,
  lensApertureMm:100,
  unspecifiedSourceEmission:'full-circle'
});

export function problemCapabilities(){
  return {
    ...capabilities(),
    problemAuthoring:{
      interfaceVersion:1,
      command:'problem',
      optInFlag:'--illustrate',
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
      statuses:['fully-specified','illustrative','needs-information','unsupported'],
      policy:'Only opt-in illustration may fill the three listed fields. Other physical information, including coordinates, focal lengths, mirror/detector geometry and directional emission angles, is never inferred. All choices remain outside canonical scene JSON.',
      interpretation:'not-assessed-by-engine'
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
    if(component.type==='point-source'){
      if(!has(p,'brightness')){
        const value=policy.sourceBrightness;
        choices.push({path:prefix+'.parameters.brightness',value,
          unit:'relative native brightness',purpose:'illustrative source sampling, not measured radiant power'});
        if(illustration)p.brightness=value;
      }
      if(!has(component,'emission')||
        (isObject(component.emission)&&Object.keys(component.emission).length===0)){
        choices.push({path:prefix+'.emission.mode',value:'full-circle',
          unit:'mode',purpose:'illustrative emitter; actual emission pattern was not specified'});
        if(illustration)component.emission={mode:'full-circle'};
      }
    }
    if(component.type==='ideal-lens'&&!has(p,'apertureHeight')){
      // Use an absolute native length, not an arbitrary number of input units.
      // If the length unit is unspecified, do not manufacture a conversion.
      const scale=scales[input.lengthUnit];
      if(scale){
        const value=policy.lensApertureMm/scale;
        choices.push({path:prefix+'.parameters.apertureHeight',value,
          unit:input.lengthUnit,canonicalValueMm:policy.lensApertureMm,
          purpose:'illustrative finite aperture; rays and detector readings may depend on it'});
        if(illustration)p.apertureHeight=value;
      }
    }
  }
  return choices;
}
const unsupported=issues=>issues.some(x=>
  ['UNSUPPORTED_COMPONENT','UNSUPPORTED_FIELD','UNSUPPORTED_SCOPE',
    'UNSUPPORTED_MODE','UNSUPPORTED_UNIT','UNSUPPORTED_POLICY'].includes(x.code));

export function resolveProblemRequest(request,{illustration=false}={}){
  if(typeof illustration!=='boolean')throw new AuthoringError([{
    path:'$.illustration',code:'INVALID_POLICY',message:'Illustration opt-in must be boolean'
  }]);
  // Copy before applying any choices; the original LLM first attempt is immutable.
  const candidate=structuredClone(request);
  const choices=choicesFor(candidate,illustration);
  try{
    const prepared=prepareScene(candidate);
    return {
      status:choices.length?'illustrative':'fully-specified',
      choices,issues:[],prepared,
      interpretation:'not-assessed-by-engine',
      physicalFidelity:'not-assessed-by-engine'
    };
  }catch(error){
    if(!(error instanceof AuthoringError))throw error;
    return {
      status:unsupported(error.issues)?'unsupported':'needs-information',
      choices,issues:error.issues,prepared:null,
      interpretation:'not-assessed-by-engine',
      physicalFidelity:'not-assessed-by-engine'
    };
  }
}
