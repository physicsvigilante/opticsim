// Real CLI replay tests on one unchanged original problem and one separately
// labelled physical approximation. Never count this as model accuracy.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {prepareScene} from '../src/authoring.js';
import {initialQualification,createQualifiedBundle} from '../src/qualification.js';
const root=resolve('test-artifacts/llm-authoring/numerical-replay-acceptance');
mkdirSync(root,{recursive:true});
const first=JSON.parse(readFileSync('evaluation/original-refraction-pair-v1/first-attempt.json'));
const entry=first.cases.find(c=>c.id==='B06');
const sha=s=>createHash('sha256').update(s).digest('hex');
const save=(name,obj)=>{const file=resolve(root,name);writeFileSync(file,JSON.stringify(obj,null,2)+'\n',{flag:'wx'});return file;};
async function bundle(request,notes){
  const doc=prepareScene(request).document;
  const q=initialQualification(doc,null,{inputSha256:sha(JSON.stringify(request)),interpretation:notes});
  return createQualifiedBundle(doc,q,entry.observables);
}
const original=await bundle(entry.request,entry.interpretation);
const explicit=structuredClone(entry.request);
for(const c of explicit.components)if(c.type==='planar-interface'&&c.id!=='I12')c.parameters.partialReflection=false;
const notes=structuredClone(entry.interpretation);
notes.assumptions.push('Separate declared numerical experiment: preserve Fresnel reflection at I12; neglect partial reflections at the other interfaces.');
const alternative=await bundle(explicit,notes);
const originalPath=save('b06-original.qualified.json',original);
const variantPath=save('b06-essential-reflection.qualified.json',alternative);
function execute(name,input,mode,expectedExit){
  const out=resolve(root,name);
  const p=spawnSync(process.execPath,['scripts/native-numerical-replay.mjs',input,'--mode',mode,'--out',out],
    {encoding:'utf8',timeout:120000});
  assert.equal(p.status,expectedExit,p.stdout+p.stderr);
  const report=JSON.parse(readFileSync(resolve(out,'report.json')));
  assert.equal(report.nativeMode,mode);
  assert.equal(report.canonicalInputWasUnchanged,true);
  assert.equal(report.didNotCreateQualifiedVariant,true);
  assert.ok(!readdirSync(out).some(x=>x.includes('qualified-scene')));
  assert.equal(report.exactInputSha256,sha(readFileSync(input)));
  return report;
}
const baseline=execute('original-default',originalPath,'default',2);
const detailed=execute('original-linear',originalPath,'linear',2);
assert.equal(baseline.nativeDiagnostics.interfacesById.I1A.interactions,0);
assert.ok(detailed.nativeDiagnostics.interfacesById.I1A.interactions>0);
const resolved=execute('essential-linear',variantPath,'linear',0);
assert.equal(resolved.nativeStatus,'completed');
const results=resolved.requestedResults.results;
assert.ok(Math.abs(results.find(r=>r.id==='theta4').value-26.6331187492)<1e-6);
assert.ok(Math.abs(results.find(r=>r.id==='theta5').value-40.5416018735)<1e-6);
assert.equal(resolved.nativeDiagnostics.truncation,0);
assert.ok(baseline.requestedResults.results.every(r=>r.status==='suppressed'));
assert.ok(detailed.requestedResults.results.every(r=>r.status==='suppressed'));
save('acceptance.json',{status:'pass',executions:3,firstDefaultIncomplete:true,
  originalLinearStillIncomplete:true,explicitApproximationLinearComplete:true,
  didNotAlterOriginalCase:true,questionSupport:'not-assessed-by-engine'});
console.log('Native numerical replay CLI acceptance PASS: explicit mode, immutable qualified input, expected suppression, and B06 branch comparison.');
