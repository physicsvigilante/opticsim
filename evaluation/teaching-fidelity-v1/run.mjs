// Evaluation only: no new physics, schema, renderer or authoring interface.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveProblemRequest} from '../../src/problem-authoring.js';
import {reviseScene} from '../../src/authoring.js';
import {validate,serializeSave} from '../../src/contract.js';
import {evaluateDocument} from '../../scripts/author-scene.mjs';
import {evaluateObservables} from '../../src/observables.js';
import {initialQualification,recordQualifiedEdit,createQualifiedBundle,parseQualifiedBundle} from '../../src/qualification.js';
import {reserveAuthoringOutput} from '../../scripts/authoring-evidence.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const core=createRequire(import.meta.url)('../../dist/test-core.cjs');
const planBytes=readFileSync(resolve(root,'evaluation/teaching-fidelity-v1/plan.json'));
const plan=JSON.parse(planBytes);
const sourceBytes=readFileSync(resolve(root,plan.source.path)),source=JSON.parse(sourceBytes);
assert.equal(blob(sourceBytes),plan.source.gitBlob,'Source fixture changed; do not repair the frozen baseline');
assert.equal(plan.baselineCommit,'740b847d977e557c31e43139987a589341424d18');
const out=reserveAuthoringOutput(resolve(root,'test-artifacts/llm-authoring/teaching-fidelity-v1'),root).directory;
const save=(name,x)=>writeFileSync(resolve(out,name),typeof x==='string'||Buffer.isBuffer(x)?x:json(x),{flag:'wx'});
save('plan.json',planBytes);save('source-scene.json',sourceBytes);
const report={format:'opticsim-teaching-fidelity-evidence-v1',status:'running',
 source:{...plan.source,sha256:sha(sourceBytes)},planSha256:sha(planBytes),planFreezeCommit:'92ca2132148bc965622f36f3dda22fbeea548e6c',
 executionCommit:process.env.GITHUB_SHA||'local',runId:process.env.GITHUB_RUN_ID||null,node:process.version,
 independentModel:false,independentHumanReview:false,teacherParticipants:0,studentParticipants:0,
 externalModelCalls:0,automaticRepairs:0,nativeExecutions:{canonical:0,readOnlyDiagnostic:0},checks:[],cases:[],
 dimensions:{interpretationFidelity:{status:'pending',scope:'Explicit fixture-to-authored-input field comparison, not unfamiliar text/image interpretation'},
 physicalCorrectness:{status:'pending',scope:'This ideal-thin-lens fixture, actual sampled rays and separate scalar residual checks'},
 simulationCoverage:{status:'pending'},educationalUsefulness:{status:'not-assessed-by-teachers',automatedBrowserTasks:'pending',sameAssistantVisualReview:'pending'},
 textbookAnswerCompleteness:{status:'not-requested',reason:'The source is a laboratory-style development fixture, not an examination question'}},
 limitations:['Completed native execution alone does not verify source interpretation.',
 'The source is already exposed and fully numerical; this is not an unseen natural-language authoring evaluation.',
 'Conditional image coordinates are analytical predictions, never native image detection.',
 'Detector values are finite sampled counts and signed relative power, not watts or continuous irradiance.',
 'Diagnostic ray positions are test-only read-only evidence, not new public observables.',
 'No teacher/student learning outcome can be inferred from automated tests or screenshots.']};
function check(name,condition,details=null){report.checks.push({name,passed:!!condition,details});}
const request=structuredClone(plan.initialRequest),requestBytes=Buffer.from(json(request));
save('authored-request.json',requestBytes);
const prepared=resolveProblemRequest(request,{illustration:false});
assert.ok(prepared.prepared,'The frozen complete request must prepare without invented facts');
const baseline=prepared.prepared.document;
assert.deepEqual(baseline.physics.components,source.physics.components);
assert.deepEqual(baseline.simulation,source.simulation);
check('All component IDs, types, numerical parameters and active source settings match the pinned source',true);
check('Source numerical settings match selected existing run policy',true);
const interpretation={source:{caseId:'teaching-fidelity-v1',path:plan.source.path,sha256:sha(sourceBytes)},
 requestedResult:'Inspect and explore a specified ideal thin lens and passive detector; textbook-answer completeness is optional.',
 stated:['All three components and their physical fields originate in the pinned repository fixture; it is a synthetic development source.',
 'Lengths are mm in x-right/y-up coordinates. The emitter is full-circle with relative brightness 0.5.',
 'The detector is a passive sampling segment, not a physical screen or an image measurement.'],
 derived:[],assumptions:['Ideal thin-lens geometric optics as explicitly specified by the source.',
 'A focal-length edit is a new classroom intervention; a sampling edit is numerical. Neither is an original source given.'],
 unknowns:['The ideal lens does not specify a material refractive index, thickness, dispersion or absorption.',
 'Continuous irradiance and classroom learning effectiveness are not established.']};
const qualification=initialQualification(baseline,prepared,{inputSha256:sha(requestBytes),interpretation});
const records=new Map();
async function execute(id,doc,requests,q,provenance){
 const dir=resolve(out,id);mkdirSync(dir);
 const write=(name,value)=>writeFileSync(resolve(dir,name),typeof value==='string'?value:json(value),{flag:'wx'});
 write('provenance.json',provenance);write('observable-requests.json',requests);
 const rawBefore=serializeSave(doc);
 report.nativeExecutions.canonical++;
 const run=evaluateDocument(doc,core);
 const results=await evaluateObservables(doc,requests,run.summary);
 const bundle=await createQualifiedBundle(doc,q,requests);
 await parseQualifiedBundle(json(bundle));
 write('scene.json',rawBefore);write('execution.json',run);write('results.json',results);write('qualified-scene.json',bundle);
 check(id+': execution leaves authored scene unchanged',serializeSave(doc)===rawBefore);
 check(id+': native computation completed without truncation/errors',run.summary.executionPassed&&run.summary.native.status==='completed'&&
  run.summary.native.truncation===0&&run.summary.native.undefinedBehavior===0&&run.summary.native.errors.length===0,run.summary.native);
 const row={id,provenance,native:run.summary.native,executionPassed:run.summary.executionPassed,
  canonicalSha256:run.summary.canonicalSha256,results:results.results,package:id+'/qualified-scene.json',
  origin:bundle.qualification.origin,appliedAssumptions:bundle.qualification.assumptions,
  edits:bundle.qualification.edits};
 report.cases.push(row);records.set(id,{doc,run,results,bundle,row});return row;
}
await execute('scene-only',baseline,[],qualification,{type:'original source-backed baseline',note:'No requested quantities and no dummy query'});
await execute('baseline',baseline,plan.observables,qualification,{type:'passive readout selection',physicalChanges:0});
const changed=reviseScene(baseline,{changes:plan.experiments.find(x=>x.id==='focal-150').changes}).document;
await execute('focal-150',changed,plan.observables,recordQualifiedEdit(baseline,changed,qualification),{
 type:'explicit classroom physical intervention',sourceGiven:false,changes:plan.experiments.find(x=>x.id==='focal-150').changes});
const coarse=structuredClone(baseline);coarse.simulation.rayDensity=plan.experiments.find(x=>x.id==='coarse-sampling').rayDensity;validate(coarse);
await execute('coarse-sampling',coarse,plan.observables,recordQualifiedEdit(baseline,coarse,qualification),{
 type:'numerical-only intervention',physicalChanges:0,rayDensity:coarse.simulation.rayDensity});
const extra=[...plan.observables,plan.experiments.find(x=>x.id==='optional-unavailable').additionalObservable];
await execute('optional-unavailable',baseline,extra,qualification,{type:'additional unsupported material request',physicalChanges:0});
const missing=structuredClone(request);delete missing.components.find(c=>c.id==='lens-1').parameters.focalLength;
const missingBytes=Buffer.from(json(missing));save('missing-focal-length.request.json',missingBytes);
const withheld=resolveProblemRequest(missing,{illustration:false});
const {prepared:unused,...missingReport}=withheld;
save('missing-focal-length.report.json',{...missingReport,inputSha256:sha(missingBytes),nativeExecutions:0});
check('Missing essential focal length is diagnosed without a fabricated scene',!withheld.prepared&&withheld.status==='needs-information',missingReport);
check('Incomplete request stays unmodified',!Object.hasOwn(missing.components[1].parameters,'focalLength'));
report.cases.push({id:'missing-focal-length',status:withheld.status,issues:withheld.issues,native:{status:'not-run'},package:null});
const row=id=>records.get(id).row;
const value=(id,key)=>row(id).results.find(x=>x.id===key)?.value;
check('No-answer baseline requires zero requested observables',row('scene-only').results.length===0&&row('scene-only').executionPassed);
check('Adding readouts leaves physical scene identity unchanged',row('scene-only').canonicalSha256===row('baseline').canonicalSha256);
check('Adding readouts leaves actual native observations unchanged',equal(records.get('scene-only').run.summary.observations,records.get('baseline').run.summary.observations));
check('Numerical edit preserves physical apparatus',equal(coarse.physics,baseline.physics));
check('Numerical edit is labeled numerics, not physics',row('coarse-sampling').edits.length===1&&row('coarse-sampling').edits[0].kind==='numerics');
check('Focal edit is labeled physics',row('focal-150').edits.length===1&&row('focal-150').edits[0].kind==='physics');
check('Coarser sampling changes actual emitted sample count',value('coarse-sampling','emissions')<value('baseline','emissions'));
check('Sampling leaves the conditional image unchanged',equal(value('coarse-sampling','predicted-image'),value('baseline','predicted-image')));
check('Focal intervention changes conditional image position',Math.abs(value('focal-150','predicted-image')?.x-value('baseline','predicted-image')?.x)>1);
check('Unsupported material request remains unavailable and null',row('optional-unavailable').results.at(-1).status==='unavailable'&&row('optional-unavailable').results.at(-1).value===null);
check('Unsupported optional answer does not remove valid simulation/readouts',row('optional-unavailable').executionPassed&&equal(row('optional-unavailable').results.slice(0,4),row('baseline').results));
// Separate mathematical checks: do not call predict() or a production inverse.
for(const id of ['baseline','focal-150','coarse-sampling']){
 const {doc}=records.get(id),sourceP=doc.physics.components.find(c=>c.type==='point-source').parameters,
 lens=doc.physics.components.find(c=>c.type==='ideal-lens').parameters,image=value(id,'predicted-image');
 const u=lens.x-sourceP.x,v=image.x-lens.x;
 const conjugateResidual=Math.abs(1/u+1/v-1/lens.focalLength),heightResidual=Math.abs(image.y+v*sourceP.y/u);
 check(id+': independently evaluated conjugate and height relations',conjugateResidual<1e-12&&heightResidual<1e-7,{conjugateResidual,heightResidual});
 check(id+': image explicitly remains conditional, not detected',row(id).results[0].status==='conditional'&&row(id).results[0].nativeImageDetected===false);
}
// Read-only actual native incident observations; no source substitution and no
// analytic ray construction. Return values and ray decisions stay native.
function diagnostic(doc){
 const {scene,idMap}=core.loadDocument(doc),lensC=doc.physics.components.find(c=>c.type==='ideal-lens'),
 detectorC=doc.physics.components.find(c=>c.type==='ray-detector');
 const lens=scene.objs[idMap.get(lensC.id)],detector=scene.objs[idMap.get(detectorC.id)];
 const oldLens=lens.onRayIncident,oldDetector=detector.onRayIncident;
 const slopes=ray=>-(ray.p2.y-ray.p1.y)/(ray.p2.x-ray.p1.x);
 const linked=new WeakMap(),lensEvents=[],detectorEvents=[];
 lens.onRayIncident=function(ray,index,p,...rest){
  const incoming=slopes(ray),h=-p.y;
  const result=oldLens.call(this,ray,index,p,...rest);
  const outgoing=slopes(ray),expected=incoming-h/lensC.parameters.focalLength;
  const event={pointMm:{x:p.x,y:h},incomingSlope:incoming,outgoingSlope:outgoing,
   slopeResidual:Math.abs(outgoing-expected)};
  lensEvents.push(event);linked.set(ray,event);return result;
 };
 detector.onRayIncident=function(ray,index,p,...rest){
  const previous=linked.get(ray);
  const expected=previous?previous.pointMm.y+previous.outgoingSlope*(p.x-previous.pointMm.x):null;
  detectorEvents.push({pointMm:{x:p.x,y:-p.y},passedThroughLens:!!previous,
   interceptResidual:expected===null?null:Math.abs(-p.y-expected)});
  return oldDetector.call(this,ray,index,p,...rest);
 };
 const sim=new core.Simulator(scene,null,null,null,null,null,false,doc.simulation.processedRayLimit);
 let event;
 for(const name of ['simulationComplete','simulationStop'])sim.on(name,()=>{event=name;});
 report.nativeExecutions.readOnlyDiagnostic++;sim.updateSimulation();
 return {type:'test-only-read-only-native-incidents',event,diagnostics:core.diagnostics(scene,sim),
  lensEvents,detectorEvents,detectorYExtentMm:detectorEvents.length?
   {min:Math.min(...detectorEvents.map(x=>x.pointMm.y)),max:Math.max(...detectorEvents.map(x=>x.pointMm.y))}:null};
}
const audits={};
for(const id of ['baseline','focal-150','coarse-sampling']){
 const audit=diagnostic(records.get(id).doc);audits[id]=audit;save(id+'/ray-checks.json',audit);
 check(id+': diagnostic native run complete',audit.event==='simulationComplete'&&audit.diagnostics.truncation===0&&audit.diagnostics.errors.length===0);
 check(id+': actual lens rays satisfy the separate thin-lens slope relation',audit.lensEvents.length>0&&audit.lensEvents.every(x=>Number.isFinite(x.slopeResidual)&&x.slopeResidual<1e-9));
 check(id+': actual lens-to-detector intersections agree with straight propagation',audit.detectorEvents.some(x=>x.passedThroughLens)&&audit.detectorEvents.filter(x=>x.passedThroughLens).every(x=>Number.isFinite(x.interceptResidual)&&x.interceptResidual<1e-7));
 check(id+': read-only diagnostic detector event count agrees with canonical observation',audit.detectorEvents.length===value(id,'crossings'));
 records.get(id).row.diagnostic={lensIncidentCount:audit.lensEvents.length,detectorIncidentCount:audit.detectorEvents.length,detectorYExtentMm:audit.detectorYExtentMm};
}
check('Physical focal edit changes sampled detector hit geometry',Math.abs(audits.baseline.detectorYExtentMm.min-audits['focal-150'].detectorYExtentMm.min)>1);
report.nativeExecutions.total=report.nativeExecutions.canonical+report.nativeExecutions.readOnlyDiagnostic;
report.dimensions.interpretationFidelity.status='source-field-match-in-exposed-numeric-fixture';
report.dimensions.physicalCorrectness.status=report.checks.every(c=>c.passed)?'verified-for-tested-samples-and-ideal-model':'check-failure';
report.dimensions.simulationCoverage={status:'all-three-specified-components-executed',missingFactControl:withheld.status,
 optionalMaterialRequest:'unavailable',notCovered:['real lens material/dispersion','finite-light-speed dynamics','continuous irradiance','teacher effectiveness']};
report.status=report.checks.every(c=>c.passed)?'checks-passed':'checks-failed';
const proofFiles=['src/contract.js','src/adapter.js','src/authoring.js','src/problem-authoring.js','src/observables.js','src/qualification.js','scripts/author-scene.mjs','upstream-pin.json'];
report.productionSourceSha256=Object.fromEntries(proofFiles.map(p=>[p,sha(readFileSync(resolve(root,p)))]));
save('report.json',report);
save('summary.md','# Teaching-fidelity pilot — development evidence\n\n'+
 'Baseline source: `'+plan.source.path+'` (already exposed, fully specified).\n\n'+
 '| Case | Native | Emissions | Detector crossings | Conditional image x (mm) |\n|---|---|---:|---:|---:|\n'+
 report.cases.map(c=>'| '+c.id+' | '+c.native.status+' | '+(c.results?.find(x=>x.id==='emissions')?.value??'not requested')+' | '+(c.results?.find(x=>x.id==='crossings')?.value??'not requested')+' | '+(c.results?.find(x=>x.id==='predicted-image')?.value?.x??'not requested')+' |').join('\n')+
 '\n\nTeacher and student educational effectiveness: **not assessed**. Browser evidence is separate. No examination answer was requested.\n');
console.log('Teaching-fidelity pilot: '+JSON.stringify({status:report.status,checks:report.checks.length,passed:report.checks.filter(x=>x.passed).length,nativeExecutions:report.nativeExecutions,teacherParticipants:0}));
if(report.status!=='checks-passed')process.exitCode=1;
