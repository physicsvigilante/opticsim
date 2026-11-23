// Direct unit tests for shared witness-common helpers and v37/v38/v39 runner-gate parity.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  computeWitnessRayMetrics as commonMetrics,
  resolveWitnessStackInput,
  validateWitnessDetector
} from '../src/witness-common.js';
import {
  computeWitnessRayMetrics as v37Metrics,
  runCoaxialStackNativeWitness
} from '../src/coaxial-stack-native-witness.js';
import {runRefractiveStackNativeWitness} from '../src/refractive-native-witness.js';
import {sceneHash} from '../src/qualified-utils.js';

const root=fileURLToPath(new URL('../',import.meta.url));

test('computeWitnessRayMetrics is shared identically between witness-common and v37 export',()=>{
  assert.equal(v37Metrics,commonMetrics);
  const m=commonMetrics({x:0,y:10},{x:1,y:0},{x:100,y:10});
  assert.equal(m.perpendicularMissMm,0);
  assert.equal(m.deltaYAtTargetXMm,0);
  assert.equal(m.deltaXAtTargetYMm,null);
});

test('validateWitnessDetector rejects duplicate or malformed IDs and resolveWitnessStackInput rejects unknown formats',async()=>{
  const used=new Set(['L1']);
  assert.throws(()=>validateWitnessDetector({id:'L1',x:100,y:0,orientationDeg:90,length:80},used),/unique valid stable ID/);
  const ok=validateWitnessDetector({x:100,y:0,orientationDeg:90,length:80},used);
  assert.equal(ok.detectorId,'D_witness');
  assert.ok(used.has('D_witness'));
  await assert.rejects(resolveWitnessStackInput({format:'unknown-format'}),/Unsupported stack input format/);
});

test('v37 and v38 witness runners enforce full isAcceptedExecutionSummary gate (rejecting nonzero truncation or bad measurementState)',async()=>{
  const v37Fixture=JSON.parse(readFileSync(resolve(root,'examples/coaxial-stack-native-witness.json'),'utf8'));
  const v37BadTruncation=await runCoaxialStackNativeWitness(v37Fixture.stackFacts,v37Fixture.witnessSpec,{
    execute:async(doc)=>({
      summary:{
        canonicalSha256:await sceneHash(doc),
        executionPassed:true,
        native:{status:'completed',truncation:0.01,undefinedBehavior:0,errors:[],warnings:[]},
        observations:{v37EndpointsVerified:true},
        measurementState:'complete'
      }
    })
  });
  assert.equal(v37BadTruncation.comparison.status,'native-run-not-qualified');

  const v38Fixture=JSON.parse(readFileSync(resolve(root,'examples/refractive-native-witness.json'),'utf8'));
  const v38BadState=await runRefractiveStackNativeWitness(v38Fixture.stack,v38Fixture.spec,{
    execute:async(doc)=>({
      summary:{
        canonicalSha256:await sceneHash(doc),
        executionPassed:true,
        native:{status:'completed',truncation:0,undefinedBehavior:0,errors:[],warnings:[]},
        observations:{v38EndpointsVerified:true},
        measurementState:'unavailable'
      }
    })
  });
  assert.equal(v38BadState.comparison.status,'native-run-not-qualified');
});
