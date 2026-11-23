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
import {runHybridStackNativeWitness} from '../src/hybrid-native-witness.js';
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

test('v37, v38, and v39 witness runners withhold BOTH comparison AND native.observables on truncation, undefinedBehavior, native errors, and disallowed measurementState',async()=>{
  const v37Fixture=JSON.parse(readFileSync(resolve(root,'examples/coaxial-stack-native-witness.json'),'utf8'));
  const v38Fixture=JSON.parse(readFileSync(resolve(root,'examples/refractive-native-witness.json'),'utf8'));
  const v39Fixture=JSON.parse(readFileSync(resolve(root,'examples/hybrid-native-witness.json'),'utf8'));

  const runners=[
    {
      name:'v37',
      run:exec=>runCoaxialStackNativeWitness(v37Fixture.stackFacts,v37Fixture.witnessSpec,{execute:exec}),
      endpointKey:'v37EndpointsVerified',
      emissions:{S_witness:{emitted:1}}
    },
    {
      name:'v38',
      run:exec=>runRefractiveStackNativeWitness(v38Fixture.stack,v38Fixture.spec,{execute:exec}),
      endpointKey:'v38EndpointsVerified',
      emissions:{R_paraxial:{emitted:1},R_marginal:{emitted:1}}
    },
    {
      name:'v39',
      run:exec=>runHybridStackNativeWitness(v39Fixture.stack,v39Fixture.witnessSpec,{execute:exec}),
      endpointKey:'v39EndpointsVerified',
      emissions:{R_paraxial:{emitted:1},R_marginal:{emitted:1}}
    }
  ];

  const badCases=[
    {label:'nonzero truncation',native:{truncation:1,undefinedBehavior:0,errors:[]},measurementState:'complete'},
    {label:'nonzero undefinedBehavior',native:{truncation:0,undefinedBehavior:1,errors:[]},measurementState:'complete'},
    {label:'non-empty native.errors',native:{truncation:0,undefinedBehavior:0,errors:['injected native fault']},measurementState:'complete'},
    {label:'disallowed measurementState',native:{truncation:0,undefinedBehavior:0,errors:[]},measurementState:'unavailable'}
  ];

  for(const runner of runners){
    for(const bc of badCases){
      const report=await runner.run(async doc=>({
        summary:{
          canonicalSha256:await sceneHash(doc),
          executionPassed:true,
          native:{status:'completed',...bc.native,warnings:[]},
          observations:{[runner.endpointKey]:true,emissionsById:runner.emissions},
          measurementState:bc.measurementState
        }
      }));
      assert.equal(report.comparison.status,'native-run-not-qualified',`${runner.name} (${bc.label}): comparison must be withheld`);
      assert.ok(report.native.observables.length>0,`${runner.name} (${bc.label}): expected observable entries`);
      for(const obs of report.native.observables){
        assert.equal(obs.status,'suppressed',`${runner.name} (${bc.label}): observable ${obs.id} must be suppressed, got ${obs.status}`);
        assert.equal(obs.value,null,`${runner.name} (${bc.label}): observable ${obs.id} must not expose numeric value`);
      }
    }
  }
});
