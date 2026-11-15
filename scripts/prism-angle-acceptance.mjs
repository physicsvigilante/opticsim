// Reduced-facts public workflow acceptance. Never builds or invokes PhyDemo.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runProblemEvidence} from './run-problem.mjs';
const root=resolve('test-artifacts/llm-authoring/prism-angular-v1');mkdirSync(root,{recursive:true});
const original=JSON.parse(readFileSync('examples/prism-angular-facts.json'));
const inv=JSON.parse(readFileSync('examples/prism-index-facts.json'));
const cases=[];
function add(id,change,status,exit=2,base=original){const input=structuredClone(base);change(input);cases.push({id,input,status,exit});}
add('forward',()=>{},'conditional',0);
add('incidence-hypothesis',p=>{p.physical.incidenceAngleDeg=50;},'conditional',0);
add('lower-index-immersed',p=>{Object.assign(p.physical,{prismAngleDeg:45,incidenceAngleDeg:25,insideIndex:1.25,outsideIndex:1.5});},'conditional',0);
add('matched-indices',p=>{p.physical.insideIndex=p.physical.outsideIndex=1.33;},'conditional',0);
add('normal-entry',p=>{p.physical.prismAngleDeg=30;p.physical.incidenceAngleDeg=0;},'conditional',0);
add('index-known-incidence',()=>{},'conditional',0,inv);
add('inverse-signed-negative',p=>{Object.assign(p.physical,{prismAngleDeg:45,incidenceAngleDeg:25,deviationDeg:-5,outsideIndex:1.5});},'conditional',0,inv);
add('entry-tir',p=>{Object.assign(p.physical,{incidenceAngleDeg:60,outsideIndex:1.5,insideIndex:1});},'unavailable');
add('exit-tir',p=>{p.physical.incidenceAngleDeg=0;},'unavailable');
add('critical-entry',p=>{Object.assign(p.physical,{incidenceAngleDeg:Math.asin(1/1.5)*180/Math.PI,outsideIndex:1.5,insideIndex:1});},'numerically-indeterminate');
add('critical-exit',p=>{Object.assign(p.physical,{prismAngleDeg:Math.asin(1/1.5)*180/Math.PI,incidenceAngleDeg:0});},'numerically-indeterminate');
add('degenerate-angle',p=>{p.physical.prismAngleDeg=1e-12;},'numerically-indeterminate');
add('missing-incidence',p=>{delete p.physical.incidenceAngleDeg;},'needs-information');
add('missing-exterior',p=>{delete p.physical.outsideIndex;},'needs-information');
add('missing-branch',p=>{delete p.physical.branch;},'needs-information');
add('reflected-branch',p=>{p.physical.branch='one-internal-reflection';},'unavailable');
add('inverse-target-already-known',p=>{p.physical.insideIndex=1.5;},'invalid-input',1,inv);
add('impossible-emergence',p=>{p.physical.deviationDeg=120;},'unavailable',2,inv);
add('grazing-emergence',p=>{p.physical.deviationDeg=60;},'numerically-indeterminate',2,inv);
add('malformed-angle',p=>{p.physical.incidenceAngleDeg='45';},'invalid-input',1);
add('unsigned-deviation-not-guessed',p=>{p.physical.angleConvention='unsigned-deviation';},'unavailable',2,inv);
add('native-still-required',p=>{p.verifyNative=true;},'conditional',2);
add('old-unregistered-kind',p=>{p.requests[0].kind='prism-emergence-angle';},'unavailable');
const rows=[];let nativeCalls=0;
for(const c of cases){
 const bytes=Buffer.from(JSON.stringify(c.input,null,2)+'\n');
 const out=await runProblemEvidence({inputBytes:bytes,outputPath:resolve(root,c.id),execute:()=>{nativeCalls++;throw Error('Angular facts must not create native calls');}});
 assert.equal(out.exitCode,c.exit,c.id);assert.equal(out.report.results[0].status,c.status,c.id);
 assert.equal(out.report.dispatch.nativeCalls,0);assert.equal(out.report.native.status,'not-run');assert.equal(out.report.portable.status,'not-created');
 assert.deepEqual(readFileSync(resolve(root,c.id,'input.json')),bytes);
 rows.push({id:c.id,status:c.status,exitCode:out.exitCode,value:out.report.results[0].value,reasonCode:out.report.results[0].reasonCode,inputSha256:out.report.inputSha256});
}
assert.equal(nativeCalls,0);const restored=structuredClone(cases[1].input);restored.physical.incidenceAngleDeg=45;assert.deepEqual(restored,original);
assert.ok(Math.abs(rows.find(r=>r.id==='index-known-incidence').value.emergenceAngleDeg-60)<1e-8); // Predeclared angular verification tolerance, not output rounding.
const paths=['src/prism-angle-queries.js','src/analytical-angle-math.js','src/planar-angle-queries.js','src/problem-workflow.js','upstream-pin.json'];
const report={format:'opticsim-prism-angular-acceptance-v1',runtime:{node:process.version,checkoutSha:process.env.GITHUB_SHA??null},sourceSha256:Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
 counts:{cases:rows.length,nativeCalls,statuses:Object.fromEntries([...new Set(rows.map(r=>r.status))].map(s=>[s,rows.filter(r=>r.status===s).length]))},
 evidenceClass:'Same-assistant deterministic software/analytical checks, not independent source interpretation or classroom evaluation.',rows};
writeFileSync(resolve(root,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Prism angular acceptance PASS: '+rows.length+' expected outcomes, zero native calls.');
