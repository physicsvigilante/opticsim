// Bounded native time snapshots. No retries and no physics changes between
// samples other than the explicitly authored source position law.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {prepareMotionExperiment,motionCapabilities} from '../src/source-motion.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function runMotionEvidence({inputBytes,outputPath,core}){
 if(inputBytes.length>1500000)throw Error('Motion input exceeds 1.5 MB');
 const original=Buffer.from(inputBytes),out=reserveAuthoringOutput(outputPath,root);
 writeEvidence(out.input,original);
 const model=await prepareMotionExperiment(original.toString('utf8'));
 writeEvidence(resolve(out.directory,'plan.json'),JSON.stringify({experimentSha256:model.integritySha256,
  timesSeconds:model.times,motion:model.spec,maximumNativeRuns:model.times.length,automaticRepairs:0},null,2)+'\n');
 const frames=[];
 for(let i=0;i<model.times.length;i++){
  const f=model.frame(i),record={frameIndex:i,timeSeconds:f.timeSeconds,experimentSha256:model.integritySha256,
   object:f.object??null,analysis:f.analysis,issues:f.issues,native:{status:'not-run'},questionSupport:'not-assessed-by-engine'};
  // Analytical outcome survives native failure. A file write failure aborts
  // execution rather than being relabelled as invalid optical physics.
  writeEvidence(resolve(out.directory,`frame-${i}-analysis.json`),JSON.stringify(record,null,2)+'\n');
  if(f.scene){
   try{const r=evaluateDocument(f.scene,core);record.sceneSha256=r.summary.canonicalSha256;
    record.native=r.summary.native;record.observations=r.summary.observations;
   }catch(error){record.native={status:'failed',error:String(error.message)};record.observations=null;}
  }else record.native={status:'not-run',reason:'invalid time-sampled scene'};
  writeEvidence(resolve(out.directory,`frame-${i}.json`),JSON.stringify(record,null,2)+'\n');frames.push(record);
 }
 for(const i of new Set([0,Math.floor((model.times.length-1)/2),model.times.length-1])){
  if(model.frame(i).scene)writeEvidence(resolve(out.directory,`snapshot-${i}.qualified.json`),JSON.stringify(await model.qualifiedFrame(i),null,2)+'\n');
 }
 const result={format:'opticsim-motion-evidence-v1',inputSha256:createHash('sha256').update(original).digest('hex'),
  experimentSha256:model.integritySha256,method:'quasi-static-native-snapshots',
  nativeRuns:frames.filter(f=>f.native.status!=='not-run').length,
  completeFrames:frames.filter(f=>['completed','completed-with-warnings'].includes(f.native.status)).length,
  frames,questionSupport:'not-assessed-by-engine',automaticRepairs:0,externalModelCalls:0};
 writeEvidence(out.report,JSON.stringify(result,null,2)+'\n');return result;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){console.log(JSON.stringify(motionCapabilities(),null,2));return;}
 if(args.length!==3||args[1]!=='--out')throw Error('Usage: node scripts/run-motion.mjs <experiment.json> --out test-artifacts/llm-authoring/<fresh>');
 const bytes=readFileSync(resolve(args[0]));
 // Check integrity/scope before building native dependencies.
 await prepareMotionExperiment(bytes.toString('utf8'));
 execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
 const result=await runMotionEvidence({inputBytes:bytes,outputPath:args[2],core});
 console.log(JSON.stringify({nativeRuns:result.nativeRuns,completeFrames:result.completeFrames},null,2));
 if(result.completeFrames!==result.frames.length)process.exitCode=2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
