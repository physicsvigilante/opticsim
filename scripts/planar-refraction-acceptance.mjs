// Execute declared synthetic refraction experiments through the normal CLI.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=resolve('test-artifacts/llm-authoring/planar-refraction');
mkdirSync(resolve(root,'..'),{recursive:true});mkdirSync(root);
const first=JSON.parse(readFileSync('evaluation/planar-refraction-v1/first-request.json'));
const save=(name,value)=>{const p=resolve(root,name);writeFileSync(p,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});return p;};
const obs=save('observables.json',first.observables),notes=save('interpretation.json',first.interpretation);
const cli=(args,status=0)=>{const p=spawnSync(process.execPath,args,{encoding:'utf8',timeout:90000});assert.equal(p.status,status,p.stdout+p.stderr);return JSON.parse(p.stdout);};
const checks=[];
function create(name,request,observables=obs,status=0){
 const out=resolve(root,name),input=save(name+'.request.json',request);
 const result=cli(['scripts/qualified-scene.mjs','create',input,'--observables',observables,'--interpretation',notes,'--out',out],status);
 checks.push({name,expectedExit:status,execution:result.native,requestedResults:result.requestedResults});return result;
}
const base=create('single-interface',first.request),baseline=await parseQualifiedBundle(readFileSync(base.outputs.bundle,'utf8'));
assert.equal(base.requestedResults.results[1].status,'available');
assert.ok(Math.abs(base.requestedResults.results[1].value-19.47122063449069)<1e-7);
const sweep={format:'opticsim-parameter-sweep-v1',expectedSceneSha256:baseline.sceneSha256,...first.sweep};
const sweepPath=save('incidence.sweep.json',sweep),sweepOut=resolve(root,'incidence-sweep');
cli(['scripts/run-parameter-sweep.mjs',base.outputs.bundle,sweepPath,'--out',sweepOut]);
const sweepReport=JSON.parse(readFileSync(resolve(sweepOut,'report.json')));assert.equal(sweepReport.completedSamples,5);
const reversed=structuredClone(first.request);reversed.title='Planar boundary — reverse incidence';reversed.components[0].parameters.x=10;reversed.components[0].emission.directionDeg=150;
const rev=create('reversed',reversed);assert.ok(Math.abs(rev.requestedResults.results[1].value-48.59037789072914)<1e-7);
const tir=structuredClone(reversed);tir.title='Planar boundary — total internal reflection';tir.components[0].emission.directionDeg=130;
const tr=create('total-internal-reflection',tir);assert.equal(tr.requestedResults.results[1].status,'unavailable');assert.equal(tr.requestedResults.results[3].value.outcome,'total-internal-reflection');
const layers=structuredClone(first.request);layers.title='Two interfaces — explicit transmitted-only approximation';
const b=structuredClone(layers.components[1]);b.id='I2';b.parameters.x=10;b.parameters.negativeIndex=1.5;b.parameters.positiveIndex=1.33;layers.components.push(b);
layers.components.filter(c=>c.type==='planar-interface').forEach(c=>c.parameters.partialReflection=false);
const layerObs=save('layer-observables.json',[...first.observables,{id:'exit-angle',kind:'interface-transmission-angle',componentId:'I2'},{id:'exit-event',kind:'interface-first-event',componentId:'I2'}]);
const lr=create('two-interface-transmission',layers,layerObs);assert.equal(lr.requestedResults.results[4].status,'qualified');assert.ok(Math.abs(lr.requestedResults.results[4].value-22.08241319447225)<1e-7);
const fresnel=structuredClone(layers);fresnel.title='Two interfaces — Fresnel truncation retained';fresnel.components.filter(c=>c.type==='planar-interface').forEach(c=>c.parameters.partialReflection=true);
const fr=create('two-interface-fresnel',fresnel,layerObs,1);assert.equal(fr.native.status,'incomplete');assert.ok(fr.requestedResults.results.every(r=>r.status==='suppressed'));
const missing=structuredClone(first.request);delete missing.components[1].parameters.positiveIndex;
const rejected=create('missing-index',missing,obs,1);assert.equal(rejected.native.status,'not-run');assert.equal(existsSync(resolve(root,'missing-index/qualified-scene.json')),false);
const change=save('revision.json',{expectedSha256:baseline.sceneSha256,changes:[{id:'S1',section:'emission',key:'directionDeg',value:60}]});
const revised=cli(['scripts/qualified-scene.mjs','revise',base.outputs.bundle,change,'--out',resolve(root,'revised-60')]);
assert.equal(revised.executionPassed,true);assert.ok(Math.abs(revised.requestedResults.results[1].value-35.26438968275465)<1e-7);
const parsed=await parseQualifiedBundle(readFileSync(revised.outputs.bundle,'utf8'));assert.deepEqual(parsed.qualification.origin,baseline.qualification.origin);
assert.equal(parsed.qualification.edits.at(-1).kind,'physics');
save('acceptance.json',{status:'pass',checks,angleSweep:sweepReport.samples.map(s=>({direction:s.value,status:s.status,results:s.requestedResults})),revision:revised,
 browserBundles:{initial:base.outputs.bundle,revised:revised.outputs.bundle,tir:tr.outputs.bundle,layers:lr.outputs.bundle,fresnel:fr.outputs.bundle},independentModelEvaluation:false});
console.log('Planar refraction acceptance PASS: 6 create outcomes, 1 qualified revision, 5 native direction samples; no independent accuracy claim.');
