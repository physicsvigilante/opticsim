// Fresh immutable public-workflow evidence. No native/model/network calls.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {createHash} from 'node:crypto';import {runProblemEvidence} from './run-problem.mjs';
const out=resolve('test-artifacts/llm-authoring/prism-angle-facts-v1');mkdirSync(out);
const read=p=>JSON.parse(readFileSync(p)),base=read('examples/prism-angle-facts.json'),inverse=read('examples/prism-index-facts.json');
const entries=[],add=(id,template,edit,status='conditional',exitCode=0)=>{const input=structuredClone(template);edit(input);entries.push({id,input,status,exitCode});};
add('forward',base,()=>{});
add('one-index-hypothesis',base,p=>{p.physical.insideIndex=1.6;});
add('immersed',base,p=>{Object.assign(p.physical,{apexAngleDeg:35,incidenceAngleDeg:25,outsideIndex:1.33,insideIndex:1.8});});
add('matched-index',base,p=>{p.physical.outsideIndex=1.5;});
add('normal-entry',base,p=>{Object.assign(p.physical,{apexAngleDeg:30,incidenceAngleDeg:0});});
add('signed-positive',inverse,p=>{p.physical.deviationConvention='signed';});
add('signed-negative',inverse,p=>{Object.assign(p.physical,{deviationConvention:'signed',deviationDeg:-5});});
add('magnitude-ambiguous',inverse,()=>{},'multiple-solutions',2);
add('magnitude-partially-indeterminate',inverse,p=>{Object.assign(p.physical,{apexAngleDeg:100,incidenceAngleDeg:40,deviationDeg:30});},'partially-indeterminate',2);
add('magnitude-partially-unavailable',inverse,p=>{p.physical.outsideIndex=4;},'partially-unavailable',2);
add('entry-tir',base,p=>{Object.assign(p.physical,{incidenceAngleDeg:60,outsideIndex:1.5,insideIndex:1});},'unavailable',2);
add('exit-tir',base,p=>{p.physical.incidenceAngleDeg=0;},'unavailable',2);
add('critical',base,p=>{Object.assign(p.physical,{apexAngleDeg:Math.asin(1/1.5)*180/Math.PI,incidenceAngleDeg:0});},'numerically-indeterminate',2);
add('degenerate',base,p=>{p.physical.apexAngleDeg=1e-12;},'numerically-indeterminate',2);
add('missing-index',base,p=>{delete p.physical.insideIndex;},'needs-information',2);
add('missing-convention',inverse,p=>{delete p.physical.deviationConvention;},'needs-information',2);
add('missing-outside-index',base,p=>{delete p.physical.outsideIndex;},'needs-information',2);
add('other-branch',base,p=>{p.physical.branch='internal-reflection';},'unavailable',2);
add('impossible-index',inverse,p=>{Object.assign(p.physical,{deviationConvention:'signed',deviationDeg:-60});},'unavailable',2);
add('extra-apparatus',base,p=>{p.physical.components=[];},'invalid-input',1);
add('tiny-nonzero-deviation',inverse,p=>{p.physical.deviationDeg=1e-15;},'numerically-indeterminate',2);
add('native-explicitly-requested',base,p=>{p.verifyNative=true;},'conditional',2);
add('unsupported-inverse',base,p=>{p.requests=[{id:'critical',kind:'prism-critical-index'}];},'unavailable',2);
let nativeCalls=0;const rows=[];
for(const e of entries){
 const bytes=Buffer.from(JSON.stringify(e.input,null,2)+'\n');
 const r=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(out,e.id),execute:()=>{nativeCalls++;throw Error('Reduced prism facts cannot invoke native tracing');}});
 assert.equal(r.exitCode,e.exitCode,e.id);assert.equal(r.report.results[0].status,e.status,e.id);
 assert.equal(r.report.dispatch.nativeCalls,0);assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');
 assert.deepEqual(readFileSync(resolve(out,e.id,'input.json')),bytes);
 rows.push({id:e.id,exitCode:r.exitCode,inputSha256:r.report.inputSha256,result:r.report.results[0],native:r.report.native,portable:r.report.portable});
}
assert.equal(nativeCalls,0);const restored=structuredClone(entries[1].input);restored.physical.insideIndex=1.5;assert.deepEqual(restored,base);
const files=['src/angular-math.js','src/planar-angle-queries.js','src/prism-angle-queries.js','src/problem-workflow.js','upstream-pin.json'];
writeFileSync(resolve(out,'report.json'),JSON.stringify({format:'opticsim-prism-angular-acceptance-v1',
 runtime:{node:process.version,checkoutSha:process.env.GITHUB_SHA??null},nativeCalls,
 sourceSha256:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
 cases:rows.length,statusCounts:rows.reduce((a,r)=>(a[r.result.status]=(a[r.result.status]||0)+1,a),{}),rows},null,2)+'\n',{flag:'wx'});
console.log('Prism angular acceptance PASS: '+rows.length+' expected outcomes; zero native calls; ambiguity, refusals and original inputs retained.');
