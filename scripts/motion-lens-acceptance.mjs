// The same native time-snapshot executor as U2; the lens file is explicitly
// synthetic and not an answer to any unseen or original question.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {makeLensMotion} from '../src/motion-example.js';
import {prepareMotionExperiment} from '../src/source-motion.js';
import {runMotionEvidence} from './run-motion.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync('examples/moving-lens.json','utf8'));
const root=resolve('test-artifacts/llm-authoring/lens-motion');
mkdirSync(root,{recursive:true});
const packageData=await makeLensMotion(example);
writeFileSync(resolve(root,'synthetic-lens.experiment.json'),
 JSON.stringify(packageData,null,2)+'\n',{flag:'wx'});
const report=await runMotionEvidence({inputBytes:Buffer.from(JSON.stringify(packageData)),
 outputPath:resolve(root,'synthetic-lens'),core});
assert.equal(report.nativeRuns,61);
assert.equal(report.completeFrames,61);
const model=await prepareMotionExperiment(packageData);
const real=model.frame(0),focus=model.frame(40),virtual=model.frame(60);
assert.equal(real.analysis.image.value.imageKind,'finite-real');
assert.equal(focus.analysis.image.value.imageKind,'at-infinity');
assert.equal(virtual.analysis.image.value.imageKind,'finite-virtual');
assert.equal(focus.analysis.globalImageMm,null);
assert.equal(focus.analysis.globalImageVelocityMmPerSecond,null);
assert.ok(report.frames.every(f=>f.observations?.emitted>0||f.observations?.emissionsById?.S1?.emitted>0));
assert.equal(model.baseline.qualification.origin.preparationStatus,'illustrative');
writeFileSync(resolve(root,'acceptance.json'),JSON.stringify({
 status:'pass',nature:'synthetic control; no original textbook question was answered',
 nativeFramesCompleted:61,conditionalImageResults:[
  {time:0,kind:real.analysis.image.value.imageKind,image:real.analysis.globalImageMm,
   velocity:real.analysis.globalImageVelocityMmPerSecond},
  {time:2,kind:focus.analysis.image.value.imageKind,image:null,velocity:null},
  {time:3,kind:virtual.analysis.image.value.imageKind,image:virtual.analysis.globalImageMm,
   velocity:virtual.analysis.globalImageVelocityMmPerSecond}
 ],nativeImageDetection:false,lightTravelTimeSimulated:false,externalModelCalls:0
},null,2)+'\n',{flag:'wx'});
console.log('Lens-motion acceptance PASS: 61 native static samples; real, infinity and virtual conditional image states.');
