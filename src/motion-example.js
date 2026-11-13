// Explicitly authored examples, not an automatic textbook reconstruction.
// Both models use the same verified motion package and pinned native runner.
import {prepareScene} from './authoring.js';
import {validate} from './contract.js';
import {initialQualification,createQualifiedBundle} from './qualification.js';
import {sha256Text,canonicalJSON} from './qualified-utils.js';
import {createMotionExperiment} from './source-motion.js';
async function packageAuthoredExample(input,doc){
 const hash=await sha256Text(canonicalJSON(input));
 const q=initialQualification(doc,{status:'illustrative',appliedChoices:[],policyVersion:null},
  {inputSha256:hash,interpretation:input.interpretation});
 const baseline=await createQualifiedBundle(doc,q,[]);
 return createMotionExperiment(baseline,input.motion);
}
export async function makeU2Motion(example,{circular=false}={}){
 const input=structuredClone(example),request=input.request;
 if(circular){
  request.title='U2 continuation — explicit circular/paraxial illustration';
  const m=request.components[1];m.type='circular-arc-mirror';m.parameters.radius=40;delete m.parameters.focalLength;
 }
 const doc=prepareScene(request).document;
 doc.presentation.view={x:-170,y:0,zoom:2}; // Original U2 apparatus-only camera in mm.
 validate(doc);
 return packageAuthoredExample(input,doc);
}
export async function makeLensMotion(example){
 const input=structuredClone(example);
 const doc=prepareScene(input.request).document;
 // The general authoring compiler intentionally does not infer a lens-only
 // analytical route. This explicit single-lens example can be narrowed only
 // after validating its *complete* components under the existing v4 model.
 doc.physics.model='ideal-thin-lens-geometric';
 validate(doc);
 return packageAuthoredExample(input,doc);
}
