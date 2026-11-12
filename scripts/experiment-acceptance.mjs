// End-to-end native sweep evidence; synthetic regression examples, not LLM scoring.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {prepareScene} from '../src/authoring.js';
import {initialQualification,createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
import {plotSamples} from '../src/parameter-sweep.js';
const root=resolve('test-artifacts/llm-authoring/experiment-acceptance');
mkdirSync(resolve(root,'..'),{recursive:true});mkdirSync(root);
const cases=JSON.parse(readFileSync('evaluation/supported-demos-v1/first-attempt.json')).cases;
const hash=x=>createHash('sha256').update(x).digest('hex');
const save=(name,obj)=>{const path=resolve(root,name);writeFileSync(path,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});return path;};
const baseline=async c=>{
  const input=JSON.stringify(c.request),doc=prepareScene(c.request).document;
  return createQualifiedBundle(doc,initialQualification(doc,null,{inputSha256:hash(input),interpretation:c.interpretation}),c.observables);
};
const lens=await baseline(cases[0]),mirror=await baseline(cases[2]);
const lensPath=save('lens-baseline.qualified.json',lens),mirrorPath=save('mirror-baseline.qualified.json',mirror);
const spec=(b,p,values,plot)=>({format:'opticsim-parameter-sweep-v1',expectedSceneSha256:b.sceneSha256,parameter:p,values,plot});
const lensParameter={id:'L1',section:'parameters',key:'focalLength',unit:'cm'};
function run(name,path,specification,status=0){
  const specPath=save(name+'.sweep.json',specification),out=resolve(root,name);
  const result=spawnSync(process.execPath,['scripts/run-parameter-sweep.mjs',path,specPath,'--out',out],{encoding:'utf8',timeout:60000});
  assert.equal(result.status,status,result.stdout+result.stderr);save(name+'.process.json',{status:result.status,stdout:result.stdout,stderr:result.stderr});
  return status===1?null:JSON.parse(readFileSync(resolve(out,'report.json')));
}
const ordinary=run('focal-8-to-20',lensPath,spec(lens,lensParameter,Array.from({length:13},(_,i)=>i+8),{observableId:'image',field:'x'}));
assert.equal(ordinary.completedSamples,13);
for(const row of ordinary.samples){
  const v=row.value*10*300/(300-row.value*10),r=row.requestedResults.results.find(r=>r.id==='image');
  assert.ok(Math.abs(r.value.x-v)<1e-6);assert.ok(Math.abs(r.value.magnification+v/300)<1e-8);
  const b=await parseQualifiedBundle(readFileSync(resolve(root,'focal-8-to-20','sample-'+String(row.index+1).padStart(3,'0'),'qualified-scene.json'),'utf8'));
  assert.deepEqual(b.qualification.origin,lens.qualification.origin);assert.deepEqual(b.scene.simulation,lens.scene.simulation);
}
const edge=run('singularity-and-invalid',lensPath,spec(lens,lensParameter,[29,30,31,0],{observableId:'image',field:'x'}),2);
assert.deepEqual(edge.samples.map(s=>s.status),['completed','completed','completed','invalid-input']);
assert.equal(edge.samples[1].requestedResults.results[0].value.kind,'at-infinity');
assert.deepEqual(plotSamples(edge).map(p=>p.y===null),[false,true,false,true]);
assert.equal(existsSync(resolve(root,'singularity-and-invalid/sample-004/qualified-scene.json')),false);
const detector=run('detector-positions',mirrorPath,spec(mirror,{id:'D1',section:'parameters',key:'x',unit:'cm'},[0,5,10,15,20],{observableId:'crossings',field:'value'}));
assert.equal(detector.completedSamples,5);assert.equal(plotSamples(detector).at(-1).y,0);
const unknown={...spec(lens,lensParameter,[12],{observableId:'index',field:'value'}),observables:[{id:'index',kind:'refractive-index',componentId:'L1'}]};
const unavailable=run('unavailable-quantity',lensPath,unknown);assert.equal(unavailable.samples[0].requestedResults.results[0].status,'unavailable');
const incompleteDoc=structuredClone(lens.scene);incompleteDoc.simulation.maxRayDepth=0;
const incomplete=await createQualifiedBundle(incompleteDoc,lens.qualification,lens.observables);
const stopped=run('incomplete-native',save('incomplete-baseline.json',incomplete),spec(incomplete,lensParameter,[12],{observableId:'image',field:'x'}),2);
assert.equal(stopped.samples[0].status,'incomplete');assert.equal(stopped.samples[0].requestedResults.results[0].status,'suppressed');
run('stale',lensPath,{...unknown,expectedSceneSha256:'0'.repeat(64)},1);
run('over-budget',lensPath,{...unknown,values:Array.from({length:26},(_,i)=>i)},1);
const reportFile=resolve(root,'focal-8-to-20/report.json'),before=hash(readFileSync(reportFile));
const reuse=spawnSync(process.execPath,['scripts/run-parameter-sweep.mjs',lensPath,resolve(root,'focal-8-to-20.sweep.json'),'--out',resolve(root,'focal-8-to-20')],{encoding:'utf8'});
assert.equal(reuse.status,1);assert.equal(hash(readFileSync(reportFile)),before);
save('acceptance.json',{status:'pass',checks:8,ordinarySamples:13,edgeSamples:4,detectorSamples:5,
  controls:['unavailable result','incomplete native run','stale baseline','over-budget request','existing output refusal'],
  independentModelEvaluation:false});
console.log('Experiment acceptance PASS: 8 checks; 13 focal samples, 4 singular/invalid samples, 5 detector samples and qualified failure controls.');
