// Paired TEST-ONLY runs. Candidate overrides PlaneGlass intersections on fresh
// instances; it is not canonical evidence and is never exported as qualified.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {serializeSave,UPSTREAM} from '../src/contract.js';
import {nativeNumericalReplay} from '../src/numerical-reliability.js';
import {evaluateDocument} from './author-scene.mjs';
import {grazingProbeInputs,captureGrazingProbe,assertGrazingProbe} from './grazing-intersection-probe.mjs';
import {exactLineReference} from './exact-line-reference.mjs';
import {experimentalPlaneCore,relativePlaneCandidate,cancellationCounterexample,EXPERIMENT} from './relative-intersection-candidate.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const wrap=a=>((a+180)%360+360)%360-180;
const close=(a,b,t=1e-7)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<t,`${a} != ${b}`);
export function intersectionControlInputs(){
  const result=[];
  for(const rotation of [0,37,90]){
    const a=rotation*Math.PI/180,p=(x,y)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
    const source=(x,angle)=>({id:'S1',type:'point-source',parameters:{...p(x,0),brightness:1},emission:{mode:'single-ray',directionDeg:wrap(angle+rotation)}});
    const boundary=(id,x,n1,n2)=>({id,type:'planar-interface',parameters:{...p(x,0),normalDeg:rotation,negativeIndex:n1,positiveIndex:n2,partialReflection:false}});
    const segment=(id,type,x,y,length)=>({id,type,parameters:{...p(x,y),orientationDeg:wrap(90+rotation),length}});
    for(const gap of [.011,.02])for(const reverse of [false,true]){
      result.push({id:`close-${rotation}-${gap}-${reverse}`,kind:'close-boundaries',request:{lengthUnit:'mm',components:[
        source(reverse?10:-10,reverse?180:0),boundary('I1',0,1,1.5),boundary('I2',gap,1.5,1),
        segment('D1','ray-detector',reverse?-10:10,0,4)]}});
    }
    result.push({id:`return-${rotation}`,kind:'mirror-return',request:{lengthUnit:'mm',components:[
      source(-20,30),boundary('I1',0,1,1.5),segment('D1','ray-detector',10,15,80),
      segment('M1','plane-mirror',20,10,80)]}});
  }
  return result;
}
function compareRecordedLines(record){
  const c=record.intersectionCheck,p=relativePlaneCandidate(c.ray,c.boundary);
  const d2=p?(p.x-c.ray.p1.x)**2+(p.y-c.ray.p1.y)**2:null;
  return {candidatePoint:p,candidateDistanceSquared:d2,candidateBeyondCutoff:p!==null&&d2>c.cutoffSquared,
    exact:exactLineReference(c.ray,c.boundary,c.cutoffSquared)};
}
export function collectRelativeExperiment(core){
  const experimental=experimentalPlaneCore(core),grazing=[],controls=[],weakBranch=[];
  for(const input of grazingProbeInputs())for(const mode of ['default','linear']){
    const doc=prepareScene(input.request).document,original=serializeSave(doc);
    const baseline=captureGrazingProbe(doc,core,mode),candidate=captureGrazingProbe(doc,experimental,mode);
    assert.equal(serializeSave(doc),original);
    grazing.push({...input,mode,baseline,candidate,recordedLineComparison:compareRecordedLines(baseline)});
  }
  for(const input of intersectionControlInputs()){
    const doc=prepareScene(input.request).document,original=serializeSave(doc);
    const baseline=evaluateDocument(doc,core).summary,candidate=evaluateDocument(doc,experimental).summary;
    assert.equal(serializeSave(doc),original);
    controls.push({...input,baseline,candidate});
  }
  const originalBytes=readFileSync(resolve(root,'evaluation/original-refraction-pair-v1/first-attempt.json'));
  const originalBlob=createHash('sha1').update('blob '+originalBytes.length+'\0').update(originalBytes).digest('hex');
  assert.equal(originalBlob,'6507989a0074b68ac0e465c0982335e88fe4767f');
  const b06=JSON.parse(originalBytes).cases.find(c=>c.id==='B06');
  for(const mode of ['default','linear']){
    const doc=prepareScene(b06.request).document;
    weakBranch.push({mode,baseline:nativeNumericalReplay(doc,core,mode),candidate:nativeNumericalReplay(doc,experimental,mode)});
  }
  // A new ordinary load must still have the unmodified native method. Compare
  // a subsequent full run with the baseline rather than assuming isolation.
  const doc=prepareScene(grazingProbeInputs().find(x=>x.id==='base-critical').request).document;
  const fresh=captureGrazingProbe(doc,core,'default');
  const reference=grazing.find(x=>x.id==='base-critical'&&x.mode==='default').baseline;
  assert.deepEqual(fresh,reference,'Experimental instance changes leaked into a fresh canonical load');
  const counter=cancellationCounterexample(),knownLimitation={...counter,
    candidatePoint:relativePlaneCandidate(counter.ray,counter.boundary),
    exact:exactLineReference(counter.ray,counter.boundary,core.Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED)};
  return {format:EXPERIMENT,upstreamCommit:UPSTREAM,grazing,controls,weakBranch,knownLimitation,
    originalInputBlob:originalBlob,isolationCheck:'fresh native replay byte-equivalent',
    counts:{grazingPairs:grazing.length,controlPairs:controls.length,weakBranchPairs:weakBranch.length,
      totalTraceExecutions:2*(grazing.length+controls.length+weakBranch.length)+1},
    scope:'Experimental per-instance PlaneGlass intersection replacement only. NOT canonical execution, qualified results or a production fix.',
    productionRecommendation:'Do not promote: determinant-cancellation counterexample remains. No browser, finite-glass or global geometry replacement has been qualified.'};
}
export function assertRelativeExperiment(report){
  assert.equal(report.grazing.length,48);assert.equal(report.controls.length,15);assert.equal(report.weakBranch.length,2);
  for(const row of report.grazing){
    assertGrazingProbe({...row,...row.baseline});
    assert.equal(row.candidate.canonicalSha256,row.baseline.canonicalSha256);
    if(row.angleCase!=='critical')assertGrazingProbe({...row,...row.candidate});
    // Compare on IDENTICAL recorded baseline inputs, not two differently
    // rounded traces. Critical transformed outcomes are retained, not forced.
    assert.equal(row.recordedLineComparison.candidateBeyondCutoff,row.recordedLineComparison.exact.beyondCutoff);
    if(row.id==='base-critical'){
      assert.equal(row.candidate.complete,true);assert.equal(row.candidate.diagnostic.truncation,0);
      assert.equal(row.candidate.intersectionCheck.sameInterfaceRehitObserved,false);
    }
  }
  for(const row of report.controls){
    for(const run of [row.baseline,row.candidate]){
      assert.equal(run.executionPassed,true,row.id);assert.equal(run.native.truncation,0);
      assert.deepEqual(run.native.errors,[]);assert.equal(run.native.undefinedBehavior,0);
      const o=run.observations;
      assert.equal(o.emissionsById.S1.emitted,1);
      assert.equal(o.detectorsById.D1.crossings,row.kind==='mirror-return'?2:1);
      assert.equal(o.interfacesById.I1.interactions,row.kind==='mirror-return'?2:1);
      if(row.kind==='close-boundaries')assert.equal(o.interfacesById.I2.interactions,1);
      else{
        assert.equal(o.reflectionsById.M1,1);
        close(o.interfacesById.I1.first.transmittedAngleDeg,Math.asin(Math.sin(Math.PI/6)/1.5)*180/Math.PI);
      }
    }
    assert.equal(row.candidate.native.processed,row.baseline.native.processed);
    close(row.candidate.observations.detectorsById.D1.signedPower,row.baseline.observations.detectorsById.D1.signedPower);
  }
  for(const pair of report.weakBranch)for(const run of [pair.baseline,pair.candidate]){
    assert.equal(run.status,'incomplete');assert.equal(run.complete,false);assert.equal(run.observations,null);
  }
  const limitation=report.knownLimitation;
  assert.equal(limitation.exact.kind,'unique');assert.equal(limitation.exact.beyondCutoff,true);
  assert.equal(limitation.candidatePoint,null,'Keep the known algebraic limitation visible, never call it fixed');
}
async function main(){
  if(process.argv.length>3)throw Error('Usage: node scripts/relative-intersection-experiment.mjs [fresh-output-directory]');
  const output=reserveAuthoringOutput(process.argv[2]||'test-artifacts/llm-authoring/relative-intersection',root);
  const inputBytes=JSON.stringify({grazing:grazingProbeInputs(),controls:intersectionControlInputs()},null,2)+'\n';
  writeEvidence(output.input,inputBytes);
  const vendor=resolve(root,'vendor/ray-optics'),git=args=>execFileSync('git',['-C',vendor,...args],{encoding:'utf8'}).trim();
  assert.equal(git(['rev-parse','HEAD']),UPSTREAM);assert.equal(git(['status','--porcelain','--untracked-files=no']),'');
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const report=collectRelativeExperiment(core);report.inputSha256=hash(inputBytes);
  report.candidateSourceSha256=hash(readFileSync(resolve(root,'scripts/relative-intersection-candidate.mjs')));
  assert.equal(git(['status','--porcelain','--untracked-files=no']),'');
  writeEvidence(output.report,JSON.stringify(report,null,2)+'\n'); // Retain failures before acceptance.
  assertRelativeExperiment(report);
  console.log(JSON.stringify({status:'experiment-acceptance-pass',...report.counts,
    baselineCompleted:report.grazing.filter(r=>r.baseline.complete).length,
    candidateCompleted:report.grazing.filter(r=>r.candidate.complete).length,
    productionReady:false,knownLimitation:report.knownLimitation.id,report:output.report},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
