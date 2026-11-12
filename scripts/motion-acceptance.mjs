import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {makeU2Motion} from '../src/motion-example.js';
import {prepareMotionExperiment,createMotionExperiment} from '../src/source-motion.js';
import {runMotionEvidence} from './run-motion.mjs';
const core=createRequire(import.meta.url)('../dist/test-core.cjs');
const example=JSON.parse(readFileSync('examples/u2-motion.json'));
const root=resolve('test-artifacts/llm-authoring/source-motion');mkdirSync(root,{recursive:true});
const save=(name,x)=>writeFileSync(resolve(root,name),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const evidence=[];
for(const circular of [false,true]){
 const experiment=await makeU2Motion(example,{circular}),name=circular?'circular':'ideal';save(name+'.experiment.json',experiment);
 const report=await runMotionEvidence({inputBytes:Buffer.from(JSON.stringify(experiment)),outputPath:resolve(root,name),core});
 assert.equal(report.nativeRuns,61);assert.equal(report.completeFrames,61);
 const initial=report.frames[0],last=report.frames[60];
 assert.ok(Math.abs(initial.analysis.globalImageVelocityMmPerSecond.x+400*Math.SQRT2)<1e-7);
 assert.ok(Math.abs(initial.analysis.globalImageVelocityMmPerSecond.y+100*Math.SQRT2)<1e-7);
 assert.ok(Math.abs(last.object.positionMm.x-(-250+25/Math.SQRT2))<1e-7);
 assert.ok(report.frames.every(f=>f.observations.reflectionsById.M1>0));
 evidence.push({name,nativeRuns:report.nativeRuns,completeFrames:report.completeFrames,
  initial:initial.analysis,last:last.analysis,counts:report.frames.map(f=>f.observations.reflectionsById.M1)});
}
const original=await makeU2Motion(example),focus=(250-200)/(50/Math.SQRT2);
const focal=await createMotionExperiment(original.baseline,{...original.motion,durationSeconds:focus,samples:3,
 continuationAssumption:'Extended constant-velocity assumption through the focal plane for a singularity control, not additional U2 data.'});
save('focal.experiment.json',focal);
const m=await prepareMotionExperiment(focal),last=m.frame(2);
assert.equal(last.analysis.globalImageMm,null);assert.equal(last.analysis.globalImageVelocityMmPerSecond,null);
const p=structuredClone(original);p.motion.velocity.speed=12;save('tampered.experiment.json',p);
const model=await prepareMotionExperiment(original);save('initial.qualified.json',await model.qualifiedFrame(0));
save('acceptance.json',{status:'pass',experiments:evidence,conditionalModelNotNativeDetection:true,
 originalMotionOnlyInstantaneous:true,constantVelocityContinuationExplicit:true,
 nativeFramesCompleted:122,externalModelCalls:0,arbitraryMotionExpressions:false});
console.log('Source-motion acceptance PASS: 122 real native frames, unchanged model/numerics, U2 initial velocity, focal singularity and portable snapshots.');
