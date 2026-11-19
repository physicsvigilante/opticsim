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


test('translated and reversed native v18 aperture-corner samples retain raw orientation and near-world evidence',async()=>{
 // This is a separate stress matrix, NOT a universal precision proof.
 // Every reference ray is observed by the pinned native v17 detector in a
 // completed scene, before the v18 aperture is separately authored.
 const variants=[
  {id:'reverse-minus90',shiftX:0,shiftY:0,orientationDeg:-90},
  {id:'positive-world-9500',shiftX:9500,shiftY:9000,orientationDeg:90},
  {id:'negative-world-9500-minus90',shiftX:-9500,shiftY:-9000,orientationDeg:-90}
 ];
 const folder=attempt(),saved=[];
 const translate=(scope,dx,dy)=>{
  for(const c of scope.components){
   if(Object.hasOwn(c.parameters,'x'))c.parameters.x+=dx;
   if(Object.hasOwn(c.parameters,'y'))c.parameters.y+=dy;
  }
 };
 const persist=(name,doc,summary)=>{
  const input=JSON.stringify(doc,null,2)+'\n',output=JSON.stringify(summary,null,2)+'\n';
  writeFileSync(resolve(folder,name+'-input.json'),input,{flag:'wx'});
  writeFileSync(resolve(folder,name+'-native-report.json'),output,{flag:'wx'});
  return {inputFile:name+'-input.json',nativeReportFile:name+'-native-report.json',
    inputSha256:sha(input),nativeReportSha256:sha(output)};
 };
 for(const v of variants){
  const v17=structuredClone(fixture('native-two-thick-lens-mirror-v17.json').physical);
  translate(v17,v.shiftX,v.shiftY);
  by(v17,'S1').y+=10;
  by(v17,'D1').x=v.shiftX+50;
  by(v17,'D1').y=v.shiftY;
  by(v17,'D1').length=240;
  const ref=prepareScene(v17).document;
  const observed=evaluateDocument(ref,core,requests);
  assert.equal(observed.summary.native.status,'completed',v.id+' needs a real completed native reference');
  const result=(await evaluateObservables(ref,requests,observed.summary)).results[0];
  assert.ok(Array.isArray(result.value),v.id+' missing genuine native hit positions');
  const crossing=result.value.find(h=>h.incomingUnit.x>0);
  assert.ok(crossing,v.id+' missing genuine right-going refracted event');
  assert.ok(Number.isFinite(crossing.pointMm.y));
  assert.ok(Math.abs(crossing.pointMm.y-(v.shiftY+10))>.2,'reference must have actually refracted');
  const sample={variant:v,baseline:{
   nativeStatus:observed.summary.native.status,
   pointMm:crossing.pointMm,incomingUnit:crossing.incomingUnit,
   ...persist(v.id+'-v17',ref,observed.summary)},
   controls:[]};
  for(const delta of [-.005,0,.005]){
   const v18=structuredClone(fixture('native-thick-lens-aperture-v18.json').physical);
   translate(v18,v.shiftX,v.shiftY);
   by(v18,'S1').y+=10;
   by(v18,'A1').x=v.shiftX+50;
   by(v18,'A1').orientationDeg=v.orientationDeg;
   by(v18,'A1').y=crossing.pointMm.y-10+delta;
   const doc=prepareScene(v18).document;
   assert.equal(doc.schemaVersion,18);
   const native=evaluateDocument(doc,core,fixture('native-thick-lens-aperture-v18.json').requests);
   const observations=native.summary.observations;
   const label=v.id+'-v18-'+(delta<0?'minus5':delta>0?'plus5':'zero');
   sample.controls.push({deltaMm:delta,apertureOrientationDeg:v.orientationDeg,
    nativeStatus:native.summary.native.status,
    processed:native.summary.native.processed,
    truncation:native.summary.native.truncation,
    undefinedBehavior:native.summary.native.undefinedBehavior,
    errorCount:native.summary.native.errors?.length??null,
    lens1Incidents:observations.interfacesById?.L1?.interactions??null,
    lens2Incidents:observations.interfacesById?.L2?.interactions??null,
    mirrorReflections:observations.reflectionsById?.M1??null,
    apertureNativeAbsorptions:observations.blockersById?.A1?.absorptions??null,
    ...persist(label,doc,native.summary)});
  }
  saved.push(sample);
 }
 const report={format:'opticsim-v18-orientation-translation-corner-native-v1',
  status:'observed-not-certified',variants:saved,
  limits:['Distinct physically authored native v17 reference scene for every translated setup.',
   'Detector hit position is a real sampled event; no ray-route itinerary or downstream hit fabricated.',
   'Near-endpoint native completion does not independently certify numerical precision or a physical image.'],
  independentNativeReplay:false};
 writeFileSync(resolve(folder,'orientation-translation-manifest.json'),
  JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('NATIVE_V18_ORIENTATION_TRANSLATION_CORNER '+JSON.stringify(report));
 assert.equal(saved.length,3);
 assert.equal(saved.reduce((s,x)=>s+x.controls.length,0),9);
});
