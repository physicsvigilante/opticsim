// Real CLI acceptance and portable browser input; no model/provider invocation.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const parent=resolve(root,'test-artifacts/llm-authoring');mkdirSync(parent,{recursive:true});
const dir=mkdtempSync(resolve(parent,'qualified-acceptance-'));
const write=(name,value)=>{const path=resolve(dir,name);writeFileSync(path,JSON.stringify(value,null,2)+'\n');return path;};
const cli=args=>JSON.parse(execFileSync(process.execPath,['scripts/qualified-scene.mjs',...args],{cwd:root,encoding:'utf8',maxBuffer:2*1024*1024}));
const reject=args=>{const r=spawnSync(process.execPath,['scripts/qualified-scene.mjs',...args],{cwd:root,encoding:'utf8'});assert.equal(r.status,1,r.stderr);return JSON.parse(r.stdout);};
const input=write('request.json',{lengthUnit:'cm',title:'Qualified authoring acceptance',components:[
  {id:'S1',type:'point-source',parameters:{x:-30,y:1}},
  {id:'L1',type:'ideal-lens',parameters:{x:0,focalLength:10}}]});
const queries=write('queries.json',[{id:'image',kind:'ideal-image',componentId:'S1'},
  {id:'emitted',kind:'source-emissions',componentId:'S1'},
  {id:'index',kind:'material-index'}]);
const notes=write('notes.json',{requestedResult:'Conditional image of one illustrative point',assumptions:['Representative luminous point; not a measured extended object.']});
const first=cli(['create',input,'--illustrate','--observables',queries,'--interpretation',notes,'--out',resolve(dir,'first')]);
assert.equal(first.executionPassed,true);assert.equal(first.problem.status,'illustrative');
assert.equal(first.requestedResults.results[0].status,'conditional');assert.equal(first.requestedResults.results[0].value.x,150);
assert.equal(first.requestedResults.results[1].status,'available');assert.equal(first.requestedResults.results[2].status,'unavailable');
const packageText=readFileSync(first.outputs.bundle,'utf8'),bundle=await parseQualifiedBundle(packageText);
assert.equal(bundle.qualification.assumptions.length,3);
assert.deepEqual(readFileSync(first.outputs.input),readFileSync(input));
const patch=write('patch.json',{expectedSha256:bundle.sceneSha256,changes:[{id:'L1',section:'parameters',key:'focalLength',value:12,unit:'cm'}]});
const revised=cli(['revise',first.outputs.bundle,patch,'--out',resolve(dir,'revised')]);
assert.equal(revised.executionPassed,true);assert.equal(revised.qualification.edits[0].kind,'physics');
assert.deepEqual(revised.qualification.assumptions,bundle.qualification.assumptions);
assert.equal(revised.qualification.origin.preparationStatus,'illustrative');
assert.ok(Math.abs(revised.requestedResults.results[0].value.x-200)<1e-8);
const stale=reject(['revise',revised.outputs.bundle,patch]);assert.match(stale.issues[0].message,/STALE_REVISION/);
const reused=reject(['create',input,'--illustrate','--out',resolve(dir,'first')]);
assert.ok(reused.issues.some(x=>x.code==='OUTPUT_EXISTS'));
assert.equal(readFileSync(first.outputs.bundle,'utf8'),packageText);
const blocked=reject(['create','test/fixtures/problem-authoring/missing-focal.request.json','--illustrate','--out',resolve(dir,'blocked')]);
assert.equal(blocked.problem.status,'needs-information');assert.equal(blocked.native.status,'not-run');
assert.equal(existsSync(resolve(dir,'blocked/qualified-scene.json')),false);
const tampered=JSON.parse(packageText);tampered.qualification.assumptions[0].value=.2;
const bad=write('tampered.json',tampered);
assert.match(reject(['revise',bad,patch]).issues[0].message,/integrity mismatch/);
const out=resolve(root,'test-artifacts/qualified-workflow');mkdirSync(out,{recursive:true});
writeFileSync(resolve(out,'acceptance.json'),JSON.stringify({status:'pass',cases:6,
  browserBundle:first.outputs.bundle,browserTampered:bad,first,revised,blocked},null,2)+'\n');
console.log('Qualified workflow acceptance PASS: 6 cases; real create/revise, stale rejection, evidence reuse, missing facts, tampered qualification.');
