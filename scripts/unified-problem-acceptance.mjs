// Native integration controls are separate from the original-image trial.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {parseQualifiedBundle} from '../src/qualification.js';
const out=resolve('test-artifacts/llm-authoring/unified-acceptance');mkdirSync(out,{recursive:true});
const all=JSON.parse(readFileSync('evaluation/planar-angular-v1/reduced-facts.json'));
const old=JSON.parse(readFileSync('evaluation/original-refraction-pair-v1/first-attempt.json'));
const angular=i=>{const c=all.cases[i],{format,...q}=c.query;
 return {format:'opticsim-problem-v1',physical:c.input,requests:[{id:'angle',...q}]};};
const lens={format:'opticsim-problem-v1',physical:{lengthUnit:'cm',components:[
 {id:'S',type:'point-source',parameters:{x:-30,y:2,brightness:.08},emission:{mode:'full-circle'}},
 {id:'L',type:'ideal-lens',parameters:{x:0,focalLength:10,apertureHeight:10}}]},
 requests:[{id:'image',kind:'ideal-image',componentId:'S'},{id:'emissions',kind:'source-emissions',componentId:'S'}]};
const mixed=angular(1);mixed.physical=old.cases.find(c=>c.id==='B06').request;
mixed.requests.push({id:'air',kind:'interface-transmission-angle',componentId:'I1A'});
const missing=structuredClone(lens);delete missing.physical.components[1].parameters.focalLength;
const unsupported={format:'opticsim-problem-v1',physical:null,requests:[{id:'x',kind:'unknown-quantity'}]};
const cases=[['angular-only',angular(0),0,0],['native-lens',lens,0,1],['mixed-incomplete',mixed,2,1],['missing-facts',missing,2,0],['unsupported',unsupported,2,0]];
const records=[];
for(const [name,input,code,calls] of cases){
 const path=resolve(out,name+'.json');writeFileSync(path,JSON.stringify(input,null,2)+'\n',{flag:'wx'});
 const folder=resolve(out,name);
 const p=spawnSync(process.execPath,['scripts/run-problem.mjs',path,'--out',folder],{encoding:'utf8',timeout:90000});
 assert.equal(p.status,code,p.stdout+p.stderr);
 const report=JSON.parse(readFileSync(resolve(folder,'report.json')));
 assert.equal(report.dispatch.nativeCalls,calls);assert.equal(report.dispatch.externalModelCalls,0);
 if(report.portable.status==='created')await parseQualifiedBundle(readFileSync(resolve(folder,'qualified-scene.json'),'utf8'));
 records.push({name,status:report.status,coverage:report.coverage,native:report.native,dispatch:report.dispatch});
}
assert.equal(records[0].native.status,'not-run');assert.equal(records[1].native.status,'completed');
assert.equal(records[2].native.status,'incomplete');
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify({status:'pass',cases:records,context:'Synthetic/existing development controls, not original-question accuracy.'},null,2)+'\n',{flag:'wx'});
console.log('Unified workflow CLI acceptance PASS: five controls; offline math, native, mixed incomplete, missing and unsupported.');
