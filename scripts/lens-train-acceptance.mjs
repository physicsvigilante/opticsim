// Evidence through the ordinary public problem workflow, with zero native work.
// No problem-specific production formula, source image, provider call or repair.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runProblemEvidence} from './run-problem.mjs';
const root=resolve('test-artifacts/llm-authoring/lens-train-facts-v1');
mkdirSync(root); // Fresh directory only. Never overwrite an earlier attempt.
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const original=read('examples/lens-train-facts.json'),entries=[];
const add=(id,change,status='conditional',exit=0)=>{const p=structuredClone(original);change(p);entries.push({id,input:p,status,exit});};
add('two-lens-source-facts',()=>{});
add('one-focal-hypothesis',p=>{p.physical.lenses[1].focalLength=15;});
add('single-real',p=>{p.physical.lenses.length=1;p.physical.lenses[0].focalLength=10;});
add('single-virtual',p=>{p.physical.lenses.length=1;p.physical.objectX=-5;p.physical.lenses[0].focalLength=10;});
add('single-diverging',p=>{p.physical.lenses.length=1;p.physical.lenses[0].focalLength=-10;});
add('infinite',p=>{p.physical.lenses.length=1;p.physical.objectX=-20;});
add('near-focus',p=>{p.physical.lenses.length=1;p.physical.objectX=-20.0000000001;},'numerically-indeterminate',2);
add('height-specified',p=>{p.physical.objectHeight=.5;p.requests=[{id:'height',kind:'lens-train-image-height'}];});
add('height-missing',p=>{p.requests=[{id:'height',kind:'lens-train-image-height'}];},'needs-information',2);
add('missing-focal',p=>{delete p.physical.lenses[0].focalLength;},'needs-information',2);
add('unsupported-model',p=>{p.physical.model='material-lens';},'unavailable',2);
add('coincident',p=>{p.physical.lenses[1].x=0;},'unavailable',2);
add('extra-mirror',p=>{p.physical.components=[{id:'M',type:'plane-mirror'}];},'invalid-input',1);
add('native-explicitly-requested',p=>{p.verifyNative=true;},'conditional',2);
add('infinite-height',p=>{p.physical.lenses.length=1;p.physical.objectX=-20;p.physical.objectHeight=.5;p.requests=[{id:'height',kind:'lens-train-image-height'}];},'unavailable',2);
add('cancellation-at-zero-D',p=>{
 Object.assign(p.physical,{lengthUnit:'mm',objectX:-9000,lenses:[{id:'A',x:0,focalLength:1},{id:'B',x:150,focalLength:1},{id:'C',x:300,focalLength:148.99324323817004}]});
},'numerically-indeterminate',2);
const rows=[];let nativeCalls=0;
for(const entry of entries){
 const bytes=Buffer.from(JSON.stringify(entry.input,null,2)+'\n');
 const r=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(root,entry.id),execute:()=>{nativeCalls++;throw Error('Reduced facts must not invoke native execution');}});
 assert.equal(r.exitCode,entry.exit,entry.id);assert.equal(r.report.results[0].status,entry.status,entry.id);
 assert.equal(r.report.native.status,'not-run');assert.equal(r.report.portable.status,'not-created');assert.equal(r.report.dispatch.nativeCalls,0);
 assert.deepEqual(readFileSync(resolve(root,entry.id,'input.json')),bytes);
 rows.push({id:entry.id,status:r.report.results[0].status,exitCode:r.exitCode,value:r.report.results[0].value,reasonCode:r.report.results[0].reasonCode,
  inputSha256:r.report.inputSha256,nativeCalls:r.report.dispatch.nativeCalls});
}
assert.equal(nativeCalls,0);
assert.equal(rows[0].value.imageDistance,7.5);assert.equal(rows[1].value.imageDistance,10);
const restore=structuredClone(entries[1].input);restore.physical.lenses[1].focalLength=10;assert.deepEqual(restore,original);
const paths=['src/analysis.js','src/lens-train-matrix.js','src/lens-train-queries.js','src/problem-workflow.js','upstream-pin.json'];
const report={format:'opticsim-lens-train-acceptance-v1',runtime:{node:process.version,checkoutSha:process.env.GITHUB_SHA??null},
 sourceSha256:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
 counts:{cases:rows.length,conditional:rows.filter(r=>r.status==='conditional').length,numericallyIndeterminate:rows.filter(r=>r.status==='numerically-indeterminate').length,
 missing:rows.filter(r=>r.status==='needs-information').length,unavailable:rows.filter(r=>r.status==='unavailable').length,invalid:rows.filter(r=>r.status==='invalid-input').length,nativeCalls},
 evidenceClass:'Deterministic software/analytical acceptance, not an LLM authorability or classroom evaluation.',rows};
writeFileSync(resolve(root,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Reduced lens facts acceptance PASS: '+rows.length+' expected outcomes; zero native calls; original input and hypotheses retained.');
