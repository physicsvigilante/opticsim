import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {saveRawResponse,assessNativeCounts,supportedOutcome} from '../evaluation/self-reviewed-pilot-v1/evidence.mjs';
const request={id:'absorbed',kind:'blocker-absorptions',componentId:'B1'};
const result={...request,status:'available',value:6};
const report={native:{status:'completed',emitted:6},results:[result]};
test('raw first-response bytes and recorded digest agree without added newline',t=>{
 const base=resolve('test-artifacts/llm-authoring');mkdirSync(base,{recursive:true});
 const out=mkdtempSync(resolve(base,'raw-byte-regression-'));t.after(()=>rmSync(out,{recursive:true,force:true}));
 const file=resolve(out,'raw.txt'),raw='{"text":"unchanged λ"}';
 const digest=saveRawResponse(file,raw),bytes=readFileSync(file);
 assert.deepEqual(bytes,Buffer.from(raw));
 assert.equal(digest,createHash('sha256').update(bytes).digest('hex'));
 assert.throws(()=>saveRawResponse(file,'replacement'),{code:'EEXIST'});
 assert.equal(readFileSync(file,'utf8'),raw);
});
test('native-count mismatch cannot earn supported outcome from structural authoring match',()=>{
 const good=assessNativeCounts({emitted:6,absorptions:6},report,[request]);
 assert.equal(good.expectedCountMatch,true);assert.equal(supportedOutcome({exactAuthoring:true},good),true);
 const bad=assessNativeCounts({absorptions:5},report,[request]);
 assert.equal(bad.expectedCountMatch,false);assert.equal(supportedOutcome({exactAuthoring:true},bad),false);
 assert.equal(supportedOutcome({exactAuthoring:false},good),false);
});
test('same-kind readings retain component identity and ambiguous shorthand is refused',()=>{
 const second={...result,id:'other',componentId:'B2',value:2};
 const many={...report,results:[result,second]};
 const data=assessNativeCounts({},many,[request,{...request,id:'other',componentId:'B2'}]);
 assert.deepEqual(data.observations.map(x=>[x.componentId,x.value]),[['B1',6],['B2',2]]);
 assert.equal(data.expectedCountMatch,null);
 assert.throws(()=>assessNativeCounts({absorptions:6},many,[request,{...request,id:'other',componentId:'B2'}]),/Ambiguous/);
 assert.throws(()=>assessNativeCounts({unrecognized:1},report,[request]),/Unknown/);
});
test('suppressed and wrong-target results do not satisfy a numeric reference',()=>{
 for(const r of [{...result,status:'suppressed'},{...result,componentId:'B2'}])
   assert.equal(assessNativeCounts({absorptions:6},{...report,results:[r]},[request]).expectedCountMatch,false);
 assert.equal(assessNativeCounts({emitted:6},{...report,native:{status:'stopped',emitted:6}},[request]).expectedCountMatch,false);
});
