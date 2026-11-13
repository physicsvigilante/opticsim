// The same bounded motion CLI and pinned native engine exercised against
// a different stationary optical element. Synthetic control, not original
// textbook-answer accuracy, and not native image detection.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {makeLensMotion} from '../src/motion-example.js';
import {prepareMotionExperiment} from '../src/source-motion.js';
import {runMotionEvidence} from './run-motion.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const root=resolve('test-artifacts/llm-authoring/source-motion/lens-acceptance');
mkdirSync(root,{recursive:true});
const save=(name,value)=>writeFileSync(resolve(root,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const example=JSON.parse(readFileSync('examples/thin-lens-motion.json'));
const input=await makeLensMotion(example),original=JSON.stringify(input);
save('lens.experiment.json',input);
const report=await runMotionEvidence({inputBytes:Buffer.from(original),outputPath:resolve(root,'lens-native'),core});
assert.equal(report.nativeRuns,61);assert.equal(report.completeFrames,61);
assert.equal(report.automaticRepairs,0);assert.equal(report.externalModelCalls,0);
assert.ok(report.frames.every(f=>f.native.status==='completed'));
assert.ok(report.frames.every(f=>f.native.truncation===0));
assert.ok(report.frames.every(f=>f.observations.emissionsById.S1.emitted>0));
const at0=report.frames[0],atFocus=report.frames[50],atEnd=report.frames[60];
assert.equal(at0.analysis.image.value.imageKind,'finite-real');
assert.equal(at0.analysis.image.value.magnification,-1);
assert.equal(atFocus.analysis.image.value.imageKind,'at-infinity');
assert.equal(atFocus.analysis.globalImageMm,null);
assert.equal(atFocus.analysis.globalImageVelocityMmPerSecond,null);
assert.equal(atEnd.analysis.image.value.imageKind,'finite-virtual');
assert.equal(atEnd.analysis.image.value.magnification,5);
assert.equal(atEnd.analysis.nativeImageDetection,false);
const m=await prepareMotionExperiment(input);
const review={
 format:'opticsim-thin-lens-motion-acceptance-v1',status:'pass',
 nature:'SYNTHETIC CONTROL, NOT AN UNSEEN ORIGINAL PROBLEM',
 model:'ideal-thin-lens-geometric',schemaVersion:4,motionFormat:input.motion.format,
 experimentFormat:input.format,inputSha256:createHash('sha256').update(original).digest('hex'),
 experimentSha256:report.experimentSha256,frames:61,nativeComplete:61,
 first:{time:at0.timeSeconds,image:at0.analysis.image.value,velocity:at0.analysis.globalImageVelocityMmPerSecond},
 focus:{time:atFocus.timeSeconds,image:atFocus.analysis.image.value,native:atFocus.native.status},
 last:{time:atEnd.timeSeconds,image:atEnd.analysis.image.value,velocity:atEnd.analysis.globalImageVelocityMmPerSecond},
 nativeLensInteraction:'Verified independently in test/motion-thin-lens.test.mjs using actual PhyDemo onRayIncident events',
 sourceAndMotionNotInferred:true,externalModelCalls:0,automaticRepairs:0,verifiedQualifiedSnapshotTimes:[0,30,60],
 nativeImageDetection:false,physicsNotModified:true
};
save('acceptance.json',review);
console.log('Thin-lens motion acceptance PASS: 61/61 native snapshots, real/infinity/virtual conditional images, same motion CLI.');
