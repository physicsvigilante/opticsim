// Temporary branch-only selected image transfer. Delete workflow before PR.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const stage=process.argv[2];assert.ok(['problems','solutions'].includes(stage));
const selectionBytes=readFileSync('evaluation/reduced-inverse-original-v1/selection.json');
const sel=JSON.parse(selectionBytes);
const digest=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
assert.equal(sel.format,'opticsim-reduced-inverse-original-selection-v1');
const inventoryBytes=readFileSync('evaluation/optical-systems-atlas-v1/inventory.json');
assert.equal(gitBlob(inventoryBytes),sel.inventoryGitBlob);
const inventory=JSON.parse(inventoryBytes).inventory;
const previous=JSON.parse(readFileSync(sel.excludedEarlierSelection));
const prior=new Set(previous.cases.map(x=>x.problemPath));
const chapters=['01_Reflection_at_Plane_Surfaces','02_Reflection_at_Curved_Surfaces','07_Lens_Formula'];
const selected=chapters.flatMap(ch=>{
 const records=inventory.filter(x=>x.chapter===ch&&x.reviewStatus==='not-reviewed'&&!prior.has(x.path)).sort((a,b)=>a.path.localeCompare(b.path));
 return [records[0].path,records[Math.floor((records.length-1)/2)].path];
});
assert.deepEqual(sel.cases.map(c=>c.problemPath),selected);
assert.equal(new Set(selected).size,6);
let firstSha=null;
if(stage==='solutions'){
 firstSha=process.env.FIRST_ATTEMPT_FREEZE;
 assert.match(firstSha||'',/^[a-f0-9]{40}$/);
 execFileSync('git',['merge-base','--is-ancestor',firstSha,'HEAD']);
 const original=execFileSync('git',['show',firstSha+':evaluation/reduced-inverse-original-v1/first-attempts.json']);
 assert.deepEqual(readFileSync('evaluation/reduced-inverse-original-v1/first-attempts.json'),original);
 const attempt=JSON.parse(original);
 assert.equal(attempt.solutionsReadBeforeFirstAttempt,false);
 assert.equal(attempt.selectionSha256,digest(selectionBytes));
 assert.deepEqual(attempt.cases.map(x=>x.id),sel.cases.map(x=>x.id));
}
const source=resolve('test-artifacts/source-08.zip');
const archive=readFileSync(source);
assert.equal(digest(archive),sel.archiveSha256);
const members=execFileSync('unzip',['-Z1',source],{encoding:'utf8',maxBuffer:1024*1024}).trimEnd().split('\n');
const out=resolve('test-artifacts/reduced-inverse-original-'+stage);
mkdirSync(out,{recursive:true});
const rows=[];
for(const c of sel.cases){
 assert.match(c.id,/^V0[1-6]$/);
 const member=stage==='problems'?c.problemPath:c.problemPath.replace('/Problems/','/Solutions/');
 assert.ok(!member.includes('..')&&!member.includes('\\'));
 if(members.filter(x=>x===member).length!==1){rows.push({id:c.id,member,status:'missing'});continue;}
 const bytes=execFileSync('unzip',['-p',source,member],{maxBuffer:4*1024*1024});
 assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
 writeFileSync(resolve(out,c.id+'.png'),bytes,{flag:'wx'});
 rows.push({id:c.id,member,status:'extracted',sha256:digest(bytes),bytes:bytes.length});
}
writeFileSync(resolve(out,'manifest.json'),JSON.stringify({format:'opticsim-reduced-inverse-original-transfer-v1',stage,
 selectionSha256:digest(selectionBytes),archiveSha256:digest(archive),firstAttemptFreeze:firstSha,
 sourceCommit:sel.sourceCommit,transferCommit:process.env.GITHUB_SHA,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stage,extracted:rows.filter(x=>x.status==='extracted').length,missing:rows.filter(x=>x.status!=='extracted').map(x=>x.id)}));
