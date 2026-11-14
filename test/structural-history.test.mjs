import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {prepareScene,COMPONENT_REVISION_FORMAT} from '../src/authoring.js';
import {initialQualification,createQualifiedBundle,recordQualifiedEdit} from '../src/qualification.js';
import {prepareQualifiedStructure} from '../src/qualified-structure.js';
const prior=JSON.parse(readFileSync(new URL('../evaluation/teaching-fidelity-v1/plan.json',import.meta.url)));
const detector=(id='detector-2')=>({id,type:'ray-detector',parameters:{x:80,y:0,orientationDeg:90,length:160}});
const add=c=>({op:'add',lengthUnit:'mm',component:c}),remove=id=>({op:'remove',id});
const patch=(b,operations)=>({expectedSha256:b.sceneSha256,format:COMPONENT_REVISION_FORMAT,operations});
async function baseline(){
 const doc=prepareScene(prior.initialRequest).document;
 return createQualifiedBundle(doc,initialQualification(doc,null,{inputSha256:'a'.repeat(64),interpretation:null}),prior.observables);
}
async function child(b,ops){const p=await prepareQualifiedStructure(b,patch(b,ops));return createQualifiedBundle(p.document,p.qualification,p.observables);}
const isRetired=e=>e.issues?.some(x=>x.code==='RETIRED_COMPONENT_ID');
test('qualified structural edits cannot recycle an ID removed in an earlier unequal-length revision',async()=>{
 const b=await baseline(),copy=structuredClone(b),deleted=await child(b,[remove('detector-1')]);
 await assert.rejects(prepareQualifiedStructure(deleted,patch(deleted,[add(detector('detector-1'))])),isRetired);
 const next=await child(deleted,[add(detector('detector-2'))]);
 assert.equal(next.scene.physics.components.at(-1).id,'detector-2');
 assert.deepEqual(next.observables,b.observables);assert.deepEqual(b,copy);
});
test('retired identities are also found after same-length swaps recorded as index-level ID changes',async()=>{
 const b=await baseline(),swapped=await child(b,[remove('detector-1'),add(detector())]);
 assert.ok(swapped.qualification.edits[0].changes.some(c=>c.path.endsWith('.id')));
 const cleared=await child(swapped,[remove('detector-2')]);
 for(const id of ['detector-1','detector-2'])await assert.rejects(prepareQualifiedStructure(cleared,patch(cleared,[add(detector(id))])),isRetired);
});
test('presentation/numerical history cannot hide a retired physical ID; earlier baseline can still branch',async()=>{
 const b=await baseline(),deleted=await child(b,[remove('detector-1')]);
 const doc=structuredClone(deleted.scene);doc.presentation.view.zoom=.5;
 const q=recordQualifiedEdit(deleted.scene,doc,deleted.qualification);
 const viewed=await createQualifiedBundle(doc,q,deleted.observables);
 await assert.rejects(prepareQualifiedStructure(viewed,patch(viewed,[add(detector('detector-1'))])),isRetired);
 const branch=await child(b,[add(detector())]);
 assert.deepEqual(branch.scene.physics.components.slice(0,3),b.scene.physics.components);
});
test('qualified structural preparation snapshots both caller inputs before asynchronous verification',async()=>{
 const b=await baseline(),p=patch(b,[add(detector())]);
 const promise=prepareQualifiedStructure(b,p);
 p.operations[0].component.parameters.x=0;b.scene.physics.components[0].parameters.x=999;
 const next=await promise;
 assert.equal(next.document.physics.components.at(-1).parameters.x,80);
 assert.equal(next.document.physics.components[0].parameters.x,-300);
});
test('stale expected scene and altered history integrity reject without accepting a new object',async()=>{
 const b=await baseline(),p=patch(b,[add(detector())]);
 await assert.rejects(prepareQualifiedStructure(b,{...p,expectedSha256:'b'.repeat(64)}),/expectedSha256/);
 const tampered=structuredClone(b);tampered.qualification.edits.push({kind:'physics',changes:[]});
 await assert.rejects(prepareQualifiedStructure(tampered,p),/integrity/);
});
test('public structure CLI rejects retired IDs before native build and keeps exact inputs',async()=>{
 const b=await baseline(),deleted=await child(b,[remove('detector-1')]);
 const directory=resolve('test-artifacts/llm-authoring/structural-history-'+randomUUID());mkdirSync(directory,{recursive:true});
 const parent=resolve(directory,'parent.json'),change=resolve(directory,'patch.json'),out=resolve(directory,'rejected');
 const input=JSON.stringify(deleted,null,2)+'\n';writeFileSync(parent,input,{flag:'wx'});
 const text=JSON.stringify(patch(deleted,[add(detector('detector-1'))]),null,2)+'\n';writeFileSync(change,text,{flag:'wx'});
 const proc=spawnSync(process.execPath,['scripts/qualified-scene.mjs','structure',parent,change,'--out',out],{encoding:'utf8',timeout:15000});
 assert.equal(proc.status,1,proc.stderr);const result=JSON.parse(proc.stdout);
 assert.equal(result.native.status,'not-run');assert.ok(result.issues.some(x=>x.code==='RETIRED_COMPONENT_ID'));
 assert.equal(existsSync(resolve(out,'qualified-scene.json')),false);
 assert.equal(readFileSync(parent,'utf8'),input);assert.equal(readFileSync(change,'utf8'),text);
 assert.ok(existsSync(resolve(out,'report.json')));
});
