// Developmental, evidence-only exercise of existing qualified Opticsim scenes.
// No new physical law, scene revision schema, arbitrary equations or model inference.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {prepareScene,reviseScene} from '../../src/authoring.js';
import {validate,serializeSave} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {evaluateObservables} from '../../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../../src/qualification.js';
import {runParameterSweep,plotSamples} from '../../src/parameter-sweep.js';
import {reserveAuthoringOutput} from '../../scripts/authoring-evidence.mjs';
import {canonicalJSON} from '../../src/qualified-utils.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(import.meta.url);
const core=require('../../dist/test-core.cjs');
const digest=x=>createHash('sha256').update(x).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const pretty=x=>JSON.stringify(x,null,2)+'\n';
const planPath=resolve(root,'evaluation/reusable-model-v1/plan.json');
export const PLAN_BLOB='75ec9471d9107d4e6ee3408ac13269299d5e3a2c';
const allowedStatuses=new Set(['available','qualified','conditional']);
const evaluate=doc=>evaluateDocument(doc,core);
const get=(doc,id)=>doc.physics.components.find(c=>c.id===id);

function physicalAnswerCheck(doc,result){
 const image=result.results.find(r=>r.kind==='ideal-image');
 if(image?.status!=='conditional')return {status:'not-applicable',reason:'No supported conditional ideal-image result; native tracing remains separate.'};
 const src=get(doc,'source-1')?.parameters,lens=get(doc,'lens-1')?.parameters,v=image.value?.x-lens?.x,u=lens?.x-src?.x;
 assert.ok(Number.isFinite(u)&&Number.isFinite(v)&&Number.isFinite(image.value.y));
 const conjugateResidual=Math.abs(1/u+1/v-1/lens.focalLength);
 const transverseResidual=Math.abs(image.value.y+v*src.y/u);
 assert.ok(conjugateResidual<1e-11&&transverseResidual<1e-7,'Independent ideal-lens check failed');
 return {status:'checked-conditional-ideal',conjugateResidual,transverseResidual,
  nativeImageDetected:false,limitations:'Ideal Gaussian relation and height, not a detected native ray intersection.'};
}

// Advisory comparison classification, not a new public mathematical solver.
// Only observations with the same exact request ID, type, unit and method can
// be treated as comparable, and native counts need matching sampling policies.
export function compareScenario(baseline,scenario){
 const samePhysics=canonicalJSON(baseline.doc.physics)===canonicalJSON(scenario.doc.physics);
 const sameNumerics=canonicalJSON(baseline.doc.simulation)===canonicalJSON(scenario.doc.simulation);
 const sameModel=baseline.doc.physics.model===scenario.doc.physics.model;
 const sameUnit=baseline.doc.physics.lengthUnit===scenario.doc.physics.lengthUnit;
 const entries=scenario.results.results.map(r=>{
   const orig=baseline.results.results.find(x=>x.id===r.id&&x.kind===r.kind&&x.componentId===r.componentId);
   const conditions={matchingTarget:!!orig,sameMethod:!!orig&&orig.method===r.method,
     sameUnit:!!orig&&orig.unit===r.unit,samePhysicalModel:sameModel,
     sameLengthUnit:sameUnit,sameNumericalPolicy:sameNumerics};
   const bothQualified=!!orig&&allowedStatuses.has(orig.status)&&allowedStatuses.has(r.status);
   let comparison='not-comparable',reason;
   if(!orig)reason='No exact named request and component target in baseline; new observations are not invented for the original state.';
   else if(!bothQualified)reason='At least one result is unavailable, suppressed, pending or otherwise not accepted.';
   else if(!conditions.sameMethod||!conditions.sameUnit||!sameModel||!sameUnit)
     reason='Result method, units or physical model differ.';
   else if(r.method==='native-observation'&&!sameNumerics)
     reason='Native sampled counts/power use different numerical policies; brightness clipping may affect readings. Not a physical change claim.';
   else if(r.status==='conditional'&&orig.status==='conditional')
     comparison='conditional-ideal-comparison';
   else if(r.method==='native-observation'&&sameNumerics)
     comparison='sampled-native-comparison';
   else reason='Result provenance is not an agreed comparison contract.';
   return {id:r.id,kind:r.kind,conditions,comparison,
     ...(reason?{reason}:{}), ...(comparison!=='not-comparable'?{baselineStatus:orig.status,scenarioStatus:r.status}:{}),
     interpretation:'Comparison eligibility only, not proof of a physical causal law.'};
 });
 return {baselineSceneSha256:baseline.bundle.sceneSha256,
   scenarioSceneSha256:scenario.bundle.sceneSha256,samePhysics,sameNumerics,entries};
}

export async function runExploration({outputPath=resolve(root,'test-artifacts/llm-authoring/reusable-model-v1')}={}){
 const planBytes=readFileSync(planPath),plan=JSON.parse(planBytes);
 assert.equal(gitBlob(planBytes),PLAN_BLOB,'Frozen scenario selections changed; do not repair after evidence');
 assert.equal(plan.format,'opticsim-reusable-model-plan-v1');
 const sourceBytes=readFileSync(resolve(root,plan.source.path));
 const oldPlanBytes=readFileSync(resolve(root,plan.source.originalAuthoringPlan));
 assert.equal(gitBlob(sourceBytes),plan.source.gitBlob);
 assert.equal(gitBlob(oldPlanBytes),plan.source.originalAuthoringPlanBlob);
 const oldPlan=JSON.parse(oldPlanBytes),source=JSON.parse(sourceBytes);
 assert.equal(plan.baselineMainCommit,'3320d12723d50ae51155d1a0c2dac4090b489930');
 const requestBytes=Buffer.from(pretty(oldPlan.initialRequest)),prepared=prepareScene(oldPlan.initialRequest);
 const baselineDoc=prepared.document;
 assert.deepEqual(baselineDoc.physics.components,source.physics.components);
 assert.deepEqual(baselineDoc.simulation,source.simulation);
 const qualification=initialQualification(baselineDoc,null,{inputSha256:digest(requestBytes),interpretation:{
   source:{caseId:'reusable-model-v1',path:plan.source.path,sha256:digest(sourceBytes)},
   requestedResult:'Explore a source-backed ideal lens and passive detector through separately qualified classroom hypotheses.',
   stated:['The baseline source specifies the three physical components with their active values and numerical settings.',
     'The source uses an ideal thin lens, not a modeled glass refractive index or finite lens thickness.'],
   derived:[],
   assumptions:['Teacher-proposed revisions are new scenarios, not literal source statements.',
     'Sampled ray crossings and relative signed detector power do not establish continuous irradiance.'],
   unknowns:['Material refractive index, exact physical light flux and learner understanding are not established.']}});
 const observables=structuredClone(oldPlan.observables);
 const baselineBundle=await createQualifiedBundle(baselineDoc,qualification,observables);
 const immutable=canonicalJSON(baselineBundle);
 const out=reserveAuthoringOutput(outputPath,root).directory;
 const save=(file,data)=>{
   const path=resolve(out,file);writeFileSync(path,Buffer.isBuffer(data)?data:typeof data==='string'?data:pretty(data),{flag:'wx'});
 };
 save('frozen-plan.json',planBytes);save('frozen-source.json',sourceBytes);
 save('source-authored-request.json',requestBytes);
 save('baseline-qualified.json',baselineBundle);
 const report={
   format:'opticsim-reusable-model-evidence-v1',status:'running',
   source:{path:plan.source.path,gitBlob:plan.source.gitBlob,sha256:digest(sourceBytes),previousAuthoringPlanBlob:plan.source.originalAuthoringPlanBlob},
   planGitBlob:PLAN_BLOB,planSha256:digest(planBytes),
   baselineSceneSha256:baselineBundle.sceneSha256,baselineIntegritySha256:baselineBundle.integritySha256,
   executionCommit:process.env.GITHUB_SHA||'local-unverified',runId:process.env.GITHUB_RUN_ID||null,
   externalModelCalls:0,repairs:0,teacherParticipants:0,studentParticipants:0,independentInterpretationReview:false,
   sourceInterpretationAccuracy:'not-assessed; already exposed full fixture',
   educationalUsefulness:'not-assessed-by-teachers',textbookAnswerCompleteness:'not-requested',
   nativeCalls:{scenario:0,sweep:0,negative:0},checks:[],scenarios:[],rejections:[],comparisons:[],
   scopeLimitations:['Native sampled observations are not measurements of continuous flux or energy in watts.',
    'Conditional ideal images are analytical coordinates, never native detected images.',
    'Changing density may change brightness clipping, invalidating naive count/power comparisons.',
    'Structural addition uses canonical clone+validate in this evaluation; reviseScene has no public append-component operation.',
    'No LLM or teacher authored new requests in a blind evaluation; workload is counted from explicit planned deltas, not tokens.']
 };
 const check=(label,condition,detail=null)=>{assert.ok(condition,label);report.checks.push({label,passed:true,detail});};
 const instances=new Map();
 async function accepted(p,doc,reqs,q,route){
   validate(doc);const outdir=resolve(out,p.id);mkdirSync(outdir);
   const write=(name,data)=>writeFileSync(resolve(outdir,name),typeof data==='string'?data:pretty(data),{flag:'wx'});
   const originalDoc=serializeSave(doc),originalBaseline=canonicalJSON(baselineBundle);
   report.nativeCalls.scenario++;
   const execution=evaluate(doc);
   const results=await evaluateObservables(doc,reqs,execution.summary);
   const bundle=await createQualifiedBundle(doc,q,reqs);
   const roundtrip=await parseQualifiedBundle(pretty(bundle));
   assert.deepEqual(roundtrip,bundle);
   check(p.id+' native execution complete',execution.summary.executionPassed===true&&execution.summary.native.status==='completed'&&execution.summary.native.truncation===0&&execution.summary.native.undefinedBehavior===0,execution.summary.native);
   check(p.id+' source provenance preserved',canonicalJSON(bundle.qualification.origin)===canonicalJSON(qualification.origin)&&canonicalJSON(bundle.qualification.interpretation)===canonicalJSON(qualification.interpretation));
   check(p.id+' did not mutate request, qualified baseline or authored scene',canonicalJSON(baselineBundle)===originalBaseline&&serializeSave(doc)===originalDoc);
   const independentMath=physicalAnswerCheck(doc,results);
   const row={id:p.id,route,sourceGiven:p.kind==='original-source',teacherHypothetical:!['original-source','passive-observation'].includes(p.kind),
     kind:p.kind,sceneSha256:bundle.sceneSha256,integritySha256:bundle.integritySha256,
     nativeStatus:execution.summary.native.status,executionPassed:execution.summary.executionPassed,
     measurements:execution.summary.observations,sourceBrightnessScale:execution.summary.observations?.emissionsById?.['source-1']?.brightnessScale??null,
     results:results.results,editKinds:bundle.qualification.edits.map(x=>x.kind),
     independentMath,qualifiedPath:p.id+'/qualified-scene.json'};
   report.scenarios.push(row);
   write('scene.json',originalDoc);write('qualified-scene.json',bundle);
   write('results.json',results);write('native.json',execution.summary);
   write('scenario-origin.json',{sourceGiven:row.sourceGiven,teacherHypothetical:row.teacherHypothetical,
     intervention:p,route,baselineSceneSha256:baselineBundle.sceneSha256,
     sourceFactsPreserved:'Original source fixture and SHA remain in the unchanged baseline and qualification origin.'});
   instances.set(p.id,{doc:structuredClone(doc),bundle,results,execution,row});
   return row;
 }
 const baselineSpec=plan.investigations[0];
 const baseline=await accepted(baselineSpec,baselineDoc,observables,qualification,'source-backed-prepared-scene');
 check('Original source component/parameter identity preserved',canonicalJSON(baselineDoc.physics.components)===canonicalJSON(source.physics.components));
 const originalSourceSerialization=serializeSave(baselineDoc);
 for(const p of plan.investigations.slice(1)){
   let doc,reqs=structuredClone(observables),route;
   if(p.kind==='passive-observation'){
     doc=structuredClone(baselineDoc);reqs.push(structuredClone(p.requested));route='existing-passive-observation-interface';
   }else if(p.kind==='physical-parameter'||p.kind==='physical-geometry'){
     doc=reviseScene(baselineDoc,{changes:p.changes}).document;route='targeted-public-reviseScene';
   }else if(p.kind==='numerical-sampling'){
     doc=structuredClone(baselineDoc);doc.simulation.rayDensity=p.rayDensity;
     validate(doc);route='qualified-canonical-numerical-revision';
   }else if(p.kind==='structural-reassembly'){
     doc=structuredClone(baselineDoc);doc.physics.components.push(structuredClone(p.component));
     validate(doc);reqs.push(structuredClone(p.requested));
     route='evaluation-only-canonical-structural-reassembly; NOT supported by targeted public reviseScene';
   }else if(p.kind==='presentation'){
     doc=structuredClone(baselineDoc);doc.presentation.view.zoom=p.zoom;
     validate(doc);route='qualified-presentation-revision';
   }else throw Error('Unexpected frozen investigation kind '+p.kind);
   const q=recordQualifiedEdit(baselineDoc,doc,qualification);
   const done=await accepted(p,doc,reqs,q,route);
   if(p.kind==='physical-parameter'||p.kind==='physical-geometry'||p.kind==='structural-reassembly')
     check(p.id+' has one source-distinct physical edit and original source provenance',done.editKinds.length===1&&done.editKinds[0]==='physics');
   if(p.kind==='numerical-sampling')
     check(p.id+' leaves physics intact and carries a numerical edit',done.editKinds.length===1&&done.editKinds[0]==='numerics'&&canonicalJSON(doc.physics)===canonicalJSON(baselineDoc.physics));
   if(p.kind==='presentation')
     check(p.id+' leaves physics/numerics intact and carries presentation-only provenance',done.editKinds.length===1&&done.editKinds[0]==='presentation'&&
       canonicalJSON(doc.physics)===canonicalJSON(baselineDoc.physics)&&canonicalJSON(doc.simulation)===canonicalJSON(baselineDoc.simulation));
   check(p.id+' always branches from initial baseline, not a prior hypothetical',serializeSave(baselineDoc)===originalSourceSerialization);
 }
 // Validate/refuse independently; invalid scenarios never reach the native core.
 for(const p of plan.negativeControls){
   let failure=null;
   try{
     if(p.kind==='physical-parameter')reviseScene(baselineDoc,{changes:p.changes});
     else if(p.kind==='structural-reassembly'){
       const doc=structuredClone(baselineDoc);doc.physics.components.push(structuredClone(p.component));validate(doc);
     }else throw Error('Unexpected negative control kind');
   }catch(error){failure={name:error.name,message:error.message,code:error.code??null,issues:error.issues??[]};}
   check(p.id+' rejects an invalid scenario before native simulation',!!failure);
   report.rejections.push({id:p.id,kind:p.kind,baselineSceneSha256:baselineBundle.sceneSha256,accepted:false,
     physicalProposedValue:p.changes??p.component,nativeCalls:0,reason:failure,sourceGiven:false});
 }
 // Existing bounded parameter sweep revalidates every sample independently.
 const sweepSpec={format:plan.sweep.format,expectedSceneSha256:baselineBundle.sceneSha256,
   parameter:structuredClone(plan.sweep.parameter),values:[...plan.sweep.values],plot:structuredClone(plan.sweep.plot)};
 const sweepInputs=canonicalJSON(sweepSpec);
 const sweep=await runParameterSweep(baselineBundle,sweepSpec,{
   execute:doc=>{report.nativeCalls.sweep++;return evaluate(doc);},
   onSample:async(sample,{bundle,execution})=>{
     const dir=resolve(out,'sweep-'+String(sample.index+1).padStart(3,'0'));mkdirSync(dir);
     const write=(name,data)=>writeFileSync(resolve(dir,name),pretty(data),{flag:'wx'});
     write('result.json',sample);
     if(bundle){write('qualified-scene.json',bundle);write('native.json',execution.summary);}
   }
 });
 check('Sweep includes three independently executed valid samples and one retained invalid sample',
   sweep.completedSamples===3&&sweep.failedSamples===1&&
   sweep.samples[3].status==='invalid-input'&&sweep.samples[3].native.status==='not-run');
 check('Sweep and caller specifications are immutable',sweepInputs===canonicalJSON(sweepSpec)&&canonicalJSON(baselineBundle)===immutable);
 check('Sweep plot does not fabricate invalid/infinite coordinates',plotSamples(sweep).at(-1).y===null);
 report.sweep={specification:sweepSpec,status:sweep.status,plannedSamples:sweep.plannedSamples,
   completedSamples:sweep.completedSamples,failedSamples:sweep.failedSamples,
   samples:sweep.samples,plot:plotSamples(sweep)};
 save('sweep-report.json',sweep);
 // Deliberately refuse comparisons that would mislabel sampling changes as
 // physical effects. The appended detector has no original counterpart.
 const baselineInstance=instances.get('baseline');
 for(const p of plan.investigations.slice(1)){
   const comp=compareScenario(baselineInstance,instances.get(p.id));
   report.comparisons.push({id:p.id,...comp});
   if(p.id==='density-025'){
     check('Sampling change never certifies native counts or relative power as physical differences',
       comp.entries.filter(e=>e.kind!=='ideal-image').every(e=>e.comparison==='not-comparable')&&
       comp.entries.find(e=>e.kind==='ideal-image')?.comparison==='conditional-ideal-comparison');
   }
   if(p.id==='extra-detector')check('New detector cannot acquire fictitious baseline observation',
     comp.entries.find(e=>e.id==='second-detector-crossings')?.comparison==='not-comparable');
   if(p.id==='focal-150'||p.id==='source-shift')
     check(p.id+' preserves numerical comparability and changes the conditional ideal image',
       comp.sameNumerics&&comp.entries.some(e=>e.kind==='ideal-image'&&e.comparison==='conditional-ideal-comparison')&&
       instances.get(p.id).row.results[0].value.x!==baseline.row.results[0].value.x);
 }
 check('Passive readouts cannot alter the native model or measurement results',
   instances.get('readouts-only').row.sceneSha256===baseline.sceneSha256&&
   canonicalJSON(instances.get('readouts-only').row.measurements)===canonicalJSON(baseline.measurements));
 check('Sampling change is not a source-backed change of illumination',
   canonicalJSON(instances.get('density-025').doc.physics)===canonicalJSON(baselineDoc.physics)&&
   instances.get('density-025').row.sourceBrightnessScale!==baseline.sourceBrightnessScale);
 check('Original baseline is still hash-identical after every branch and sweep',
   canonicalJSON(baselineBundle)===immutable&&serializeSave(baselineDoc)===originalSourceSerialization);
 report.checkCounts={passed:report.checks.length,failed:0};
 report.status='checks-passed';
 save('report.json',report);
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 runExploration().then(r=>console.log('Reusable-model exploration '+JSON.stringify({
  status:r.status,checks:r.checkCounts.passed,scenarios:r.scenarios.length,
  negative:r.rejections.length,nativeCalls:r.nativeCalls,
  sweep:{completed:r.sweep.completedSamples,failed:r.sweep.failedSamples},
  teacherParticipants:r.teacherParticipants}))).catch(e=>{console.error('Reusable-model exploration failed: '+e.stack);process.exitCode=1;});
