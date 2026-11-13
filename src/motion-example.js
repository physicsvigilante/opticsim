import {prepareScene} from './authoring.js';
import {initialQualification,createQualifiedBundle} from './qualification.js';
import {sha256Text,canonicalJSON} from './qualified-utils.js';
import {createMotionExperiment} from './source-motion.js';
// Explicitly authored example, not an automatic scene reconstruction/default.
export async function makeU2Motion(example,{circular=false}={}){
 const input=structuredClone(example),request=input.request;
 if(circular){
  request.title='U2 continuation — explicit circular/paraxial illustration';
  const m=request.components[1];m.type='circular-arc-mirror';m.parameters.radius=40;delete m.parameters.focalLength;
 }
 const doc=prepareScene(request).document;
 doc.presentation.view={x:-170,y:0,zoom:2}; // Native apparatus-only camera in mm.
 const hash=await sha256Text(canonicalJSON(input));
 const q=initialQualification(doc,{status:'illustrative',appliedChoices:[],policyVersion:null},
  {inputSha256:hash,interpretation:input.interpretation});
 const baseline=await createQualifiedBundle(doc,q,[]);
 return createMotionExperiment(baseline,input.motion);
}
