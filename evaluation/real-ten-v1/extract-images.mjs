// Source transfer only, never optical execution or answer generation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const phase=process.argv[2];
assert.ok(['problems','solutions'].includes(phase),'Choose an explicit transfer phase');
const selectionPath='evaluation/real-ten-v1/selection.json';
const selectionBytes=readFileSync(selectionPath),selection=JSON.parse(selectionBytes);
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const inventoryBytes=readFileSync('evaluation/optical-systems-atlas-v1/inventory.json');
assert.equal(blob(inventoryBytes),selection.inventoryGitBlob);
const inventory=JSON.parse(inventoryBytes).inventory;
const chapters=[...new Set(inventory.map(x=>x.chapter))].sort();
const chosen=chapters.flatMap(ch=>inventory.filter(x=>x.chapter===ch&&x.reviewStatus==='not-reviewed')
 .sort((a,b)=>a.path.localeCompare(b.path)).slice(0,ch.startsWith('01_')||ch.startsWith('07_')?2:1)).map(x=>x.path).sort();
assert.deepEqual(selection.cases.map(x=>x.problemPath),chosen);
assert.equal(chosen.length,10);
let firstAttemptFreeze=null;
if(phase==='solutions'){
 firstAttemptFreeze=process.env.FIRST_ATTEMPT_FREEZE;
 assert.match(firstAttemptFreeze||'',/^[a-f0-9]{40}$/,'Solutions need an already committed first attempt');
 execFileSync('git',['merge-base','--is-ancestor',firstAttemptFreeze,'HEAD']);
 const firstBytes=execFileSync('git',['show',firstAttemptFreeze+':evaluation/real-ten-v1/first-attempts.json']);
 assert.deepEqual(firstBytes,readFileSync('evaluation/real-ten-v1/first-attempts.json'));
 const first=JSON.parse(firstBytes);
 assert.equal(first.solutionsOpened,false);assert.equal(first.selectionSha256,sha(selectionBytes));
 assert.deepEqual(first.cases.map(x=>x.id),selection.cases.map(x=>x.id));
}
const archivePath=resolve('test-artifacts/source-08.zip'),archive=readFileSync(archivePath);
assert.equal(sha(archive),selection.archiveSha256);
const members=execFileSync('unzip',['-Z1',archivePath],{encoding:'utf8',maxBuffer:1024*1024}).split('\n');
const out=resolve('test-artifacts/real-ten-'+phase);mkdirSync(out,{recursive:false});
const rows=[];
for(const c of selection.cases){
 assert.match(c.id,/^R\d\d$/);
 const member=phase==='problems'?c.problemPath:c.problemPath.replace('/Problems/','/Solutions/');
 assert.ok(!member.includes('..')&&!member.includes('\\'));
 if(members.filter(x=>x===member).length!==1){rows.push({...c,member,status:'missing-source'});continue;}
 const bytes=execFileSync('unzip',['-p',archivePath,member],{maxBuffer:4*1024*1024});
 assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 writeFileSync(resolve(out,c.id+'.png'),bytes,{flag:'wx'});
 rows.push({...c,member,status:'extracted',sha256:sha(bytes),bytes:bytes.length});
}
writeFileSync(resolve(out,'manifest.json'),JSON.stringify({format:'opticsim-real-ten-image-evidence-v1',phase,
 selectionSha256:sha(selectionBytes),archiveSha256:sha(archive),sourceCommit:selection.sourceCommit,
 extractionCommit:process.env.GITHUB_SHA,firstAttemptFreeze,solutionsExtracted:phase==='solutions',rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({phase,extracted:rows.filter(x=>x.status==='extracted').length,missing:rows.filter(x=>x.status!=='extracted').map(x=>x.id)}));
