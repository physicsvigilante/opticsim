// Synthetic native PhyDemo aperture with a transparent gap and two opaque arms.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runProblemEvidence} from './run-problem.mjs';
import {evaluateDocument} from './author-scene.mjs';
import {parseQualifiedBundle} from '../src/qualification.js';
import {runParameterSweep} from '../src/parameter-sweep.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const folder=resolve(root,'test-artifacts/llm-authoring/finite-aperture');
mkdirSync(folder,{recursive:true});
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=JSON.parse(readFileSync(resolve(root,'examples/finite-aperture-detector.json')));
const gap=i=>i.physical.components.find(c=>c.type==='finite-aperture').parameters;
const report={format:'opticsim-finite-aperture-acceptance-v1',cases:[],
 browserBundles:{},sourceProblemsRead:0,externalModelCalls:0,repairs:0};
async function execute(name,edit,status,exitCode){
 const input=structuredClone(fixture);input.physical.title='Synthetic finite aperture: '+name;edit(input);
 let calls=0;const result=await runProblemEvidence({
  inputBytes:Buffer.from(JSON.stringify(input,null,2)+'\n'),
  outputPath:resolve(folder,name),execute:scene=>{calls++;return evaluateDocument(scene,core);}});
 assert.equal(result.report.native.status,status,name+': '+JSON.stringify(result.report.native));
 assert.equal(result.exitCode,exitCode,name+': '+JSON.stringify(result.report.results));
 assert.equal(calls,result.report.dispatch.nativeCalls);
 assert.equal(result.report.dispatch.repairs,0);assert.equal(result.report.dispatch.externalModelCalls,0);
 if(result.report.portable.status==='created'){
  const file=resolve(folder,name,'qualified-scene.json');
  const bundle=await parseQualifiedBundle(readFileSync(file,'utf8'));
  assert.equal(bundle.scene.schemaVersion,4);
  assert.deepEqual(bundle.qualification.interpretation,input.interpretation);
  report.browserBundles[name]=file;
 }
 report.cases.push({name,native:result.report.native,results:result.report.results,
  inputSha256:result.report.inputSha256,coverage:result.report.coverage,exitCode});
 return result;
}
const baseline=await execute('baseline',()=>{},'completed',0);
assert.equal(baseline.report.results[1].value,6);
assert.ok(baseline.report.results[0].value>0&&baseline.report.results[0].value<6);
assert.ok(baseline.report.results[2].value>0);
const narrow=await execute('narrow',i=>gap(i).openingLength=1,'completed',0);
const wide=await execute('wide',i=>gap(i).openingLength=78,'completed',0);
assert.ok(narrow.report.results[0].value>=baseline.report.results[0].value);
assert.equal(wide.report.results[0].value,0);
const moved=await execute('moved',i=>gap(i).y=100,'completed',0);
assert.equal(moved.report.results[0].value,0);
assert.equal(moved.report.results[2].value,4);
await execute('dense',i=>i.physical.runPolicy='dense-v1','completed',0);
await execute('lens-in-gap',i=>i.physical.components.push({id:'L1',type:'ideal-lens',
  parameters:{x:0,focalLength:100,apertureHeight:20}}),'completed',0);
const intersect=await execute('detector-on-arm',i=>{const d=i.physical.components.find(c=>c.id==='D1').parameters;
 d.x=0;d.length=40;},'not-run',2);
assert.equal(intersect.report.dispatch.nativeCalls,0);
await execute('missing-gap',i=>delete gap(i).openingLength,'not-run',2);
await execute('invalid-gap',i=>gap(i).openingLength=0,'not-run',1);
const bundle=await parseQualifiedBundle(readFileSync(report.browserBundles.baseline,'utf8'));
const sweep=await runParameterSweep(bundle,{
 format:'opticsim-parameter-sweep-v1',expectedSceneSha256:bundle.sceneSha256,
 parameter:{id:'B1',section:'parameters',key:'openingLength',unit:'mm'},values:[30,1,78,80],
 observables:[{id:'abs',kind:'blocker-absorptions',componentId:'B1'},
  {id:'cross',kind:'detector-crossings',componentId:'D1'}]},
 {execute:scene=>evaluateDocument(scene,core)});
assert.equal(sweep.samples.length,4);assert.equal(sweep.samples[3].status,'invalid-input');
assert.ok(sweep.samples[0].requestedResults.results[0].value>0);
writeFileSync(resolve(folder,'sweep.json'),JSON.stringify(sweep,null,2)+'\n');
report.sweep={samples:4,invalidRetained:1};report.status='passed';
writeFileSync(resolve(folder,'acceptance.json'),JSON.stringify(report,null,2)+'\n');
console.log('Finite aperture native acceptance PASS: '+report.cases.length+' cases, 4 immutable gap samples.');
