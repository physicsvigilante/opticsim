// Temporary checksum-bound transport. No network or branch updates.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>{const b=Buffer.from(x);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');};
const paths=['.github/workflows/planar-refraction.yml','AGENTS.md','README.md','public/index.html','src/adapter.js','src/analysis.js','src/app.js','src/authoring.js','src/contract.js','src/observables.js','src/planar-media.js','src/result-preview.js','docs/TRIANGULAR-PRISM.md','examples/triangular-prism.json','scenes/triangular-prism.json','scripts/triangular-prism-acceptance.mjs','scripts/triangular-prism-browser.mjs','src/triangular-prism.js','test/triangular-prism.test.mjs'];
const encoded=Array.from({length:5},(_,i)=>readFileSync('.prism-stage/part'+(i+1)+'.txt','utf8').trim()).join('')+'\n';
assert.equal(sha(encoded),'4c7494992411caa229bb88fcbec3552dabf4ba3e292a406c83a33b325286ec80','Transport checksum mismatch');
const payload=JSON.parse(gunzipSync(Buffer.from(encoded.trim(),'base64'),{maxOutputLength:1024*1024}).toString('utf8'));
assert.equal(payload.baseCommit,'dbce2631887d623097567574a86551f9f262bdd4');
assert.deepEqual(payload.files.map(f=>f.path),paths);
assert.deepEqual(payload.deletes,['.github/workflows/prism-source-snapshot.yml']);
const planned=payload.files.map(f=>{
 let text;
 if(f.before){
  text=readFileSync(f.path,'utf8');assert.equal(blob(text),f.before,'Base mismatch: '+f.path);
  const edits=[...f.edits].sort((a,b)=>b.start-a.start);let right=text.length;
  for(const e of edits){
   assert.ok(Number.isInteger(e.start)&&Number.isInteger(e.remove)&&e.start>=0&&e.remove>=0&&e.start+e.remove<=right&&typeof e.insert==='string');
   text=text.slice(0,e.start)+e.insert+text.slice(e.start+e.remove);right=e.start;
  }
 }else{assert.equal(existsSync(f.path),false);assert.equal(typeof f.content,'string');text=f.content;}
 assert.equal(blob(text),f.blob,'Final blob mismatch: '+f.path);assert.equal(sha(text),f.sha256);
 return {path:f.path,text,blob:f.blob,sha256:f.sha256};
});
for(const f of planned){mkdirSync(dirname(f.path),{recursive:true});writeFileSync(f.path,f.text);}
for(const path of payload.deletes)unlinkSync(path);
mkdirSync('test-artifacts/prism-stage',{recursive:true});
writeFileSync('test-artifacts/prism-stage/manifest.json',JSON.stringify({baseTree:'75f82d69302310c77a4e3cc44f122dbd979492d6',expectedTree:'8e3f23dfa8dd1866bc49492aec467557d1997f52',files:planned.map(({text,...f})=>f),deletes:payload.deletes},null,2)+'\n',{flag:'wx'});
console.log('Verified and applied '+planned.length+' exact source files.');
