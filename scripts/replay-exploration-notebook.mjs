// Local first-party notebook replay CLI. Rebuild existing native test-core
// once, then retrace every verified qualified input as a fresh native run.
// The notebook itself never contains any of the newly generated evidence.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseExplorationNotebook,EXPLORATION_NOTEBOOK_MAX_BYTES} from '../src/exploration-notebook.js';
import {replayExplorationNotebook} from '../src/exploration-notebook-replay.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
function options(args){
 if(args.length!==3||args[1]!=='--out')
  throw Error('Usage: node scripts/replay-exploration-notebook.mjs <notebook.json> --out test-artifacts/llm-authoring/<fresh-replay>');
 return {input:resolve(args[0]),output:args[2]};
}
export async function main(args=process.argv.slice(2)){
 const {input,output}=options(args);
 const bytes=readFileSync(input);
 if(bytes.length>EXPLORATION_NOTEBOOK_MAX_BYTES)
  throw Error('Notebook input exceeds 4 MiB; no native simulation started');
 const location=reserveAuthoringOutput(output,root);
 // Capture the EXACT original input bytes, not a rebuilt/edited notebook.
 writeEvidence(location.input,bytes);
 let nativeStarted=false;
 try{
  const notebook=await parseExplorationNotebook(bytes.toString('utf8'));
  // All nested qualified scenes, metadata and whole-file SHA verified before
  // any build or native invocation. Never automatically "fix" invalid scenes.
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
   {cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  nativeStarted=true;
  const report=await replayExplorationNotebook(notebook,{
   run:(doc,requests)=>evaluateDocument(doc,core,requests),
   onTrial:async(row,i)=>writeEvidence(resolve(location.directory,
    'trial-'+String(i+1).padStart(2,'0')+'.json'),json(row)),
   onComparison:async(row,i)=>writeEvidence(resolve(location.directory,
    'comparison-'+String(i+1).padStart(2,'0')+'.json'),json(row))
  });
  report.originalInputSha256=sha(bytes);
  report.originalInputBytes=bytes.length;
  report.node=process.version;
  writeEvidence(location.report,json(report));
  console.log(JSON.stringify({status:report.status,planned:report.plannedEntries,
   attempted:report.attemptedEntries,qualified:report.newNativeQualified,
   nativeIncomplete:report.nativeIncomplete,
   infrastructureErrors:report.infrastructureErrors,comparisons:report.comparisonsMade,
   inputSha256:sha(bytes),out:location.directory}));
  if(report.status!=='all-native-qualified')process.exitCode=1;
  return report;
 }catch(error){
  // Every refusal or infrastructure failure remains an actual failure, not
  // a made-up native completed result. Trial files are never overwritten.
  const report={format:'opticsim-notebook-replay-error-v1',
   status:'not-qualified',originalInputSha256:sha(bytes),nativeStarted,
   reason:String(error?.message||error),note:'Original input bytes retained; no incomplete evidence upgraded to qualified.'};
  writeEvidence(location.report,json(report));
  console.error('Notebook replay unavailable: '+report.reason);
  process.exitCode=1;
  return report;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('Replay refused: '+e.message);process.exitCode=1;});
