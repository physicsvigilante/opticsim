// Test-only adversarial v18 secondary-ray/aperture-corner probe.
// A first genuine pinned native detector sample determines where an already
// refracted ray crosses the prospective aperture plane; only then are
// independent v18 scenes authored. This is NOT a production ray solver or a
// claim that a native "completed" callback certifies near-corner accuracy.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepareScene} from '../src/authoring.js';
import {evaluateDocument} from '../scripts/author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const fixture=file=>JSON.parse(readFileSync(new URL('../examples/'+file,import.meta.url),'utf8'));
const by=(p,id)=>p.components.find(c=>c.id===id).parameters;
const requests=[{id:'positions',kind:'detector-hit-events',componentId:'D1'}];
// Produce deterministic, immutable per-attempt input/report objects. CI supplies
// the authoritative native execution; these are NOT a second independent run.
const evidenceDir=resolve('test-artifacts/research-v18-secondary-corner');
const attempt=()=>{mkdirSync(evidenceDir,{recursive:true});return mkdtempSync(resolve(evidenceDir,'attempt-'));};
const sha=x=>createHash('sha256').update(x).digest('hex');
test('native-refracted v18 rays near an aperture gap joint: research observations only',async()=>{
 const scope17=structuredClone(fixture('native-two-thick-lens-mirror-v17.json').physical);
 by(scope17,'S1').y=10;
 by(scope17,'D1').x=50;by(scope17,'D1').y=0;by(scope17,'D1').length=240;
 const baseline=prepareScene(scope17).document;
 const run17=evaluateDocument(baseline,core,requests);
 assert.equal(run17.summary.native.status,'completed');
 const measured=(await evaluateObservables(baseline,requests,run17.summary)).results[0];
 assert.ok(['available','qualified'].includes(measured.status));
 const crossing=measured.value.find(h=>h.incomingUnit.x>0);
 assert.ok(crossing,'a real native right-going refracted crossing is needed');
 const nativeY=crossing.pointMm.y;
 assert.ok(Number.isFinite(nativeY));
 assert.ok(Math.abs(nativeY-10)>.2,'refracted crossing must differ from the original straight source line');
 const evidence=attempt();
 const baselineInput=JSON.stringify(baseline,null,2)+'\n';
 const baselineReport=JSON.stringify(run17.summary,null,2)+'\n';
 writeFileSync(resolve(evidence,'baseline-v17-input.json'),baselineInput,{flag:'wx'});
 writeFileSync(resolve(evidence,'baseline-v17-native-report.json'),baselineReport,{flag:'wx'});
 const controls=[];
 for(const delta of [-.03,-.005,0,.005,.03]){
  const scope18=structuredClone(fixture('native-thick-lens-aperture-v18.json').physical);
  by(scope18,'S1').y=10;
  by(scope18,'A1').x=50;
  // Place the TOP edge of the 20 mm clear opening around an ACTUAL
  // independently observed native refracted crossing at the same x-plane.
  by(scope18,'A1').y=nativeY-10+delta;
  const doc=prepareScene(scope18).document;
  const actual=evaluateDocument(doc,core,fixture('native-thick-lens-aperture-v18.json').requests);
  assert.ok(['completed','completed-with-warnings','incomplete','stopped','failed'].includes(actual.summary.native.status));
  const row={deltaMm:delta,nativeStatus:actual.summary.native.status,
   processedRayCount:actual.summary.native.processed,
   nativeL1FaceIncidents:actual.summary.observations.interfacesById?.L1?.interactions??null,
   nativeL2FaceIncidents:actual.summary.observations.interfacesById?.L2?.interactions??null,
   nativeMirrorReflections:actual.summary.observations.reflectionsById?.M1??null,
   nativeDetectorCrossings:actual.summary.observations.detectorsById?.D1?.crossings??null,
   errors:actual.summary.native.errors?.length??null,
   truncation:actual.summary.native.truncation,
   undefinedBehavior:actual.summary.native.undefinedBehavior,
   countedStopAbsorptions:actual.summary.observations.blockersById?.A1?.absorptions??null,
   apertureX:50,observedNativeReferenceY:nativeY,
   nativeRefractedSampleSource:'v17 actual D1 native hit event',rayPathSynthesized:false};
  const input=JSON.stringify(doc,null,2)+'\n';
  const summary=JSON.stringify(actual.summary,null,2)+'\n';
  const name='delta-'+(delta<0?'minus':delta>0?'plus':'zero')+'-'+Math.round(Math.abs(delta)*1000)+'um';
  writeFileSync(resolve(evidence,name+'-input.json'),input,{flag:'wx'});
  writeFileSync(resolve(evidence,name+'-native-report.json'),summary,{flag:'wx'});
  controls.push({...row,inputFile:name+'-input.json',nativeReportFile:name+'-native-report.json',
    inputSha256:sha(input),nativeReportSha256:sha(summary)});
 }
 const record={format:'opticsim-native-v18-corner-test-only-v2',
  status:'observed-not-certified',nativeReferenceY:nativeY,
  baselineV17NativeStatus:run17.summary.native.status,
  baselineInputSha256:sha(baselineInput),
  baselineNativeReportSha256:sha(baselineReport),
  referenceHit:{pointMm:crossing.pointMm,incomingUnit:crossing.incomingUnit},
  controls,limits:[
   'Real v17 sampled detector hit used to choose independent fully authored v18 aperture scene geometry; never a synthetic ray route.',
   'Raw native completed status and an absorption count do not certify the correct near-corner arm/gap classification.',
   'The beam can hit the aperture on the reflected RETURN even when it entered through the gap, so count alone does not identify first encounter order.'
  ],rayPathSynthesized:false};
  writeFileSync(resolve(evidence,'manifest.json'),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  console.log('NATIVE_V18_SECONDARY_CORNER_PROBE '+JSON.stringify(record));
 assert.equal(controls.length,5);
});
