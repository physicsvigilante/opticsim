import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {planProblem} from '../src/problem-workflow.js';
import {sequentialLensReference} from './helpers/lens-sequential-reference.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/lens-train-transfer.json',import.meta.url)));
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(b)));
// Retained exposed regression. It first passed an earlier frozen candidate;
// later unrelated cancellation hardening changed only generic numerical admission.
// This replay is not a new held-out attempt against the final candidate.
test('preselected four-lens converging/diverging transfer retains input and conditional outputs',()=>{
 const {input,evidence}=fixture,raw=JSON.stringify(input,null,2)+'\n';
 assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.firstAttemptSha256);
 const p=planProblem(input),ref=sequentialLensReference(input.physical.objectX,input.physical.lenses,input.physical.objectHeight);
 assert.equal(p.scene,null);assert.equal(p.native.canRun,false);
 for(const r of p.results){assert.equal(r.status,'conditional');assert.equal(r.value.imageKind,'finite-virtual');
  near(r.value.imageX,ref.x);near(r.value.imageDistance,ref.distance);near(r.value.magnification,ref.magnification);}
 assert.equal('imageHeight' in p.results[0].value,false);near(p.results[1].value.imageHeight,ref.y);
 assert.deepEqual(JSON.stringify(input,null,2)+'\n',raw);
});
