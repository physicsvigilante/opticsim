// Two previously reviewed original questions, applied to the unchanged merged engine.
// This is a same-assistant development trial, not independent model inference.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readProblemPng,sha256} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';

const root=resolve('.');
const output=reserveAuthoringOutput(process.argv[2]||'test-artifacts/llm-authoring/original-refraction-pair',root);
const out=output.directory;
const firstPath='evaluation/original-refraction-pair-v1/first-attempt.json';
const bytes=readFileSync(firstPath);
const blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
assert.equal(blob,'6507989a0074b68ac0e465c0982335e88fe4767f','The sealed first attempt must not be repaired');
const first=JSON.parse(bytes),archive=readFileSync(first.archiveName);
assert.equal(sha256(archive),first.archiveSha256,'Original archive identity');
writeEvidence(resolve(out,'first-attempt.json'),bytes);
writeEvidence(resolve(out,'interpretation.md'),readFileSync(first.interpretationPath));
const save=(path,value)=>{const p=resolve(out,path);writeEvidence(p,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');return p;};
const records=[];
function invoke(args){
  const p=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:120000});
  if(p.error||p.signal||![0,1,2].includes(p.status))throw Error('CLI infrastructure failure: '+(p.error?.message||p.signal||p.stderr));
  let stdout;try{stdout=JSON.parse(p.stdout);}catch{throw Error('CLI returned no structured report: '+p.stderr+' '+p.stdout);}
  return {exit:p.status,stdout,stderr:p.stderr};
}
async function create(name,request,observables,interpretation,phase){
  const req=save(name+'.request.json',request),obs=save(name+'.observables.json',observables),notes=save(name+'.interpretation.json',interpretation);
  const folder=resolve(out,name);
  const processResult=invoke(['scripts/qualified-scene.mjs','create',req,'--observables',obs,'--interpretation',notes,'--out',folder]);
  save(name+'.process.json',processResult);
  const report=JSON.parse(readFileSync(resolve(folder,'report.json')));
  if(report.summary.outputs?.bundle)await parseQualifiedBundle(readFileSync(report.summary.outputs.bundle,'utf8'));
  const record={name,phase,exit:processResult.exit,report: name+'/report.json',
    problemStatus:report.summary.problem?.status,native:report.summary.native,
    requestedResults:report.summary.requestedResults||null,
    diagnostics:report.details?.native?.diagnostics||null,
    package:existsSync(resolve(folder,'qualified-scene.json'))?name+'/qualified-scene.json':null};
  records.push(record);return {record,report,folder};
}
mkdirSync(resolve(out,'problems'));
for(const c of first.cases){
  const image=readProblemPng(archive,c.problemPath);assert.equal(sha256(image),c.imageSha256,c.id+' original image');
  save('problems/'+c.id+'.png',image);
  await create(c.id+'-first',c.request,c.observables,c.interpretation,'sealed-first-attempt');
}
// Preserve the initial outcomes before calculating any companion angles.
save('first-outcomes.json',{sealedBlob:blob,engineBaseline:first.engineBaseline,records:structuredClone(records),solutionsRead:false});

// These equations are a transparent external analytical review, NOT production
// inverse inference and NOT values supplied in the first requests. Native checks
// below are forward checks of that derivation, not an independent solution.
const deg=x=>x*180/Math.PI;
const theta=deg(Math.asin(1.3/1.6)),critical=deg(Math.asin(1.3/1.8));
const theta4=deg(Math.asin(1.3*.5/1.45)),theta5=deg(Math.asin(1.3*.5));
const analytical={method:'external scalar Snell-law and specular-reflection reasoning; not engine inverse output',
 B05:{equations:['n1 sin(theta) = n2 sin(i23)','n2 sin(ic) = n3','theta = asin(n3/n1)'],thetaDeg:theta,critical23Deg:critical,
  decreasedTheta:'For 0 <= theta < asin(n3/n1), n1 sin(theta) < n3, so a propagating transmitted branch into medium 3 is allowed.'},
 B06:{equations:['n1 sin(theta1) = n4 sin(theta4)','reflection at I12 preserves the normal angle','n1 sin(theta1) = n_air sin(theta5)'],theta4Deg:theta4,theta5Deg:theta5,
  assumptions:['n_air=1','Two branches as drawn, not a sequential forced route.']}};
save('analytical-review.json',analytical);
const b05=first.cases[0],b06=first.cases[1];
const supplied=structuredClone(b05.request);supplied.title='B05 follow-up — externally derived input, full Fresnel';
supplied.components[0].emission.directionDeg=90-theta;
const b05Notes=structuredClone(b05.interpretation);
b05Notes.derived.push('The separately recorded scalar derivation supplies theta=asin(n3/n1). This run verifies a supplied input; it does not solve the inverse problem.');
b05Notes.unknowns=[];
await create('B05-derived-full',supplied,b05.observables,b05Notes,'externally-derived-forward-check');
const angular=structuredClone(supplied);angular.title='B05 angular-only follow-up — partial reflections explicitly omitted';
for(const c of angular.components)if(c.type==='planar-interface')c.parameters.partialReflection=false;
const angularNotes=structuredClone(b05Notes);
angularNotes.assumptions.push('Explicit angular-only approximation: omit partial Fresnel reflections at both interfaces. Native TIR remains active; no power/throughput claim. At the exact critical angle a geometric tangent or zero-power branch is not evidence of finite transmitted power.');
const ac=await create('B05-angular-only',angular,b05.observables,angularNotes,'explicit-approximation');
const baseline=await parseQualifiedBundle(readFileSync(resolve(ac.folder,'qualified-scene.json'),'utf8'));
const direction=90-theta;
const values=[direction-1,direction-0.001,direction,direction+0.001,direction+1];
const sweep={format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,
 parameter:{id:'S1',section:'emission',key:'directionDeg'},values,
 plot:{observableId:'transmission23',field:'value'}};
const sweepPath=save('B05-direction.sweep.json',sweep);
const sr=invoke(['scripts/run-parameter-sweep.mjs',resolve(ac.folder,'qualified-scene.json'),sweepPath,'--out',resolve(out,'B05-critical-bracket')]);
save('B05-critical-bracket.process.json',sr);
const sweepReport=JSON.parse(readFileSync(resolve(out,'B05-critical-bracket/report.json')));

// Do not raise brightness, lower native thresholds, or replace the weak reflected
// branch with a second emitter. This companion only neglects other interfaces'
// partial reflections, while retaining the I12 split required by the question.
const branchRequest=structuredClone(b06.request);branchRequest.title='B06 follow-up — retain I12 split, omit other secondary reflections';
for(const c of branchRequest.components)if(c.type==='planar-interface'&&c.id!=='I12')c.parameters.partialReflection=false;
const branchNotes=structuredClone(b06.interpretation);
branchNotes.assumptions.push('Separate approximate follow-up: Fresnel split at I12 retained; partial reflections at I23, I34 and I1A explicitly omitted. No native cutoff or brightness change, extra source or manual route.');
await create('B06-retain-split',branchRequest,b06.observables,branchNotes,'explicit-approximation');

// A bounded partial illustration of theta4 alone. It is NOT a substitute for
// the original two-result problem: removing I12 reflection removes theta5's ray.
const downward=structuredClone(b06.request);downward.title='B06 downward-only subexperiment — theta5 deliberately not represented';
for(const c of downward.components)if(c.type==='planar-interface')c.parameters.partialReflection=false;
const downNotes=structuredClone(b06.interpretation);
downNotes.requestedResult='Only theta4 on the downward transmitted branch. The original theta5 result is not represented in this subexperiment.';
downNotes.assumptions.push('All partial reflections explicitly omitted. This removes the depicted upward branch and cannot answer the full B06 question.');
await create('B06-downward-only',downward,b06.observables,downNotes,'partial-subexperiment-not-full-question');

const summary={format:'opticsim-original-refraction-pair-report-v1',engineBaseline:first.engineBaseline,
 sealedBlob:blob,solutionsRead:false,independentModelEvaluation:false,originalProblems:2,
 firstOutcomes:records.filter(r=>r.phase==='sealed-first-attempt'),followups:records.filter(r=>r.phase!=='sealed-first-attempt'),
 analyticalReview:analytical,sweep:{file:'B05-critical-bracket/report.json',status:sweepReport.status,
 samples:sweepReport.samples.map(s=>({index:s.index,directionDeg:s.value,thetaDeg:90-s.value,status:s.status,requestedResults:s.requestedResults}))},
 note:'Follow-ups never replace first attempts. Mathematical answers and numerical observations are different evidence. No independent accuracy score.'};
save('report.json',summary);
console.log(JSON.stringify({status:'recorded',firstOutcomes:summary.firstOutcomes.map(r=>({name:r.name,status:r.problemStatus,native:r.native.status})),
 followups:summary.followups.map(r=>({name:r.name,native:r.native.status})),sweep:sweepReport.status,output:out},null,2));
