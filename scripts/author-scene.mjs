// Opticsim CLI: interpret physics outside this routine, then execute the pinned
// native checker. Saved attempts use fresh, non-overwriting evidence bundles.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capabilities,prepareScene,reviseScene,AuthoringError} from '../src/authoring.js';
import {problemCapabilities,resolveProblemRequest} from '../src/problem-authoring.js';
import {serializeSave} from '../src/contract.js';
import {snapshotNativeObservations} from '../src/native-observations.js';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=text=>createHash('sha256').update(text).digest('hex');
const maxInputBytes=1024*1024;
function readInput(path){
  const bytes=readFileSync(resolve(path));
  if(bytes.length>maxInputBytes)throw new AuthoringError([{
    path:'$',code:'INPUT_TOO_LARGE',message:'Input JSON exceeds the 1 MB document limit'
  }]);
  return bytes;
}
function parseInput(bytes){
  try{return JSON.parse(bytes.toString('utf8'));}
  catch(error){throw new AuthoringError([{path:'$',code:'INVALID_JSON',message:error.message}]);}
}
export function evaluateDocument(doc,core) {
  const sceneText=serializeSave(doc),run=checkCandidate(sceneText,core);
  const diag=run.native.diagnostics||{};
  const completed=run.native.completed;
  const warnings=diag.warnings||[];
  const measurementState=!completed?'withheld-incomplete':
    warnings.length?'qualified-with-warnings':
    run.native.detectorMeasurements==='complete'?'complete':
    run.native.detectorMeasurements==='not-applicable'?'not-requested':'unavailable';
  const summary={
    accepted:run.validation.valid,
    canonicalSha256:hash(sceneText),
    validation:run.validation,
    native:{
      status:run.native.status,error:run.native.error??null,
      emitted:diag.emitted??null,processed:diag.processed??null,
      truncation:diag.truncation??null,undefinedBehavior:diag.undefinedBehavior??null,
      errors:diag.errors||[],warnings
    },
    observations:completed?snapshotNativeObservations(diag):null,
    measurementState,analysis:{status:run.analysis.status,reason:run.analysis.reason},
    executionPassed:run.executionPassed,
    interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'
  };
  return {summary,report:run,sceneText};
}
function usage() {
  return 'Usage:\n'+
    '  node scripts/author-scene.mjs capabilities|problem-capabilities\n'+
    '  node scripts/author-scene.mjs problem <request.json> [--illustrate] [--out test-artifacts/llm-authoring/<fresh-name>]\n'+
    '  node scripts/author-scene.mjs evaluate <request.json> [--out test-artifacts/llm-authoring/<fresh-name>]\n'+
    '  node scripts/author-scene.mjs revise <scene.json> <changes.json> [--out test-artifacts/llm-authoring/<fresh-name>]\n'+
    'All accepted commands use the same pinned native core. Existing output directories are refused.\n';
}
function record(summary,details,sceneText,context){
  summary.command=context.command;
  if(context.inputSha256)summary.inputSha256=context.inputSha256;
  if(context.changesSha256)summary.changesSha256=context.changesSha256;
  const output=context.output;
  if(output){
    summary.outputs={input:output.input,report:output.report,
      ...(context.changesSha256?{changes:output.changes}:{}),
      ...(sceneText?{scene:output.scene}:{})};
    if(sceneText)writeEvidence(output.scene,sceneText);
    writeEvidence(output.report,JSON.stringify({
      format:'opticsim-authoring-evidence-v1',summary,details:details??null
    },null,2)+'\n');
    context.reportWritten=true;
  }
  process.stdout.write(JSON.stringify(summary,null,2)+'\n');
}
function main(context){
  const [command,...args]=process.argv.slice(2);
  context.command=command;
  if(['capabilities','problem-capabilities'].includes(command)&&args.length===0){
    process.stdout.write(JSON.stringify(command==='capabilities'?capabilities():problemCapabilities(),null,2)+'\n');return;
  }
  if(!['problem','evaluate','revise'].includes(command))throw new Error(usage());
  const count=command==='revise'?2:1;
  if(args.length<count)throw new Error(usage());
  let illustration=false,outPrefix=null;
  for(let i=count;i<args.length;i++){
    if(command==='problem'&&args[i]==='--illustrate'&&!illustration)illustration=true;
    else if(args[i]==='--out'&&outPrefix===null&&i+1<args.length)outPrefix=args[++i];
    else throw new Error(usage());
  }
  const bytes=readInput(args[0]),changes=command==='revise'?readInput(args[1]):null;
  context.inputSha256=hash(bytes);
  if(changes)context.changesSha256=hash(changes);
  // Reserve before any native work. Keep original input bytes even when JSON
  // parsing or preparation fails; do not repair or regenerate those bytes.
  context.output=reserveAuthoringOutput(outPrefix,root);
  if(context.output){
    writeEvidence(context.output.input,bytes);
    if(changes)writeEvidence(context.output.changes,changes);
  }
  const request=parseInput(bytes);
  let prepared;
  if(command==='problem'){
    const problem=resolveProblemRequest(request,{illustration});
    const {prepared:resolved,...qualification}=problem;
    context.problem={...qualification,illustrationOptIn:illustration};
    if(!resolved){
      record({accepted:false,problem:context.problem,issues:problem.issues,
        native:{status:'not-run'},executionPassed:false,
        interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'},null,null,context);
      process.exitCode=1;return;
    }
    prepared=resolved;
  }else if(command==='evaluate')prepared=prepareScene(request);
  else{
    const edit=parseInput(changes);
    if(!edit||typeof edit!=='object'||Array.isArray(edit)||!Object.hasOwn(edit,'expectedSha256'))
      throw new AuthoringError([{path:'$.expectedSha256',code:'MISSING_REVISION',
        message:'A revision hash is required for optimistic concurrency'}]);
    const actual=hash(serializeSave(request));
    if(edit.expectedSha256!==actual)
      throw new AuthoringError([{path:'$.expectedSha256',code:'STALE_REVISION',
        message:'The authored scene has changed; reload before applying this edit'}]);
    const {expectedSha256,...changeSet}=edit;
    prepared=reviseScene(request,changeSet);
  }
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
    {cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  context.nativeStarted=true;
  const result=evaluateDocument(prepared.document,core);
  const summary={...result.summary,
    ...(context.problem?{problem:context.problem}:{}),
    ...(command==='revise'?{revision:{changesApplied:prepared.changesApplied,
      priorAssumptions:'unknown-from-scene-alone; retain the original qualification report'}}:
      {preparation:prepared.preparation})};
  if(!context.output)summary.document=prepared.document;
  record(summary,result.report,result.sceneText,context);
  if(!summary.executionPassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const context={};
  try{main(context);}catch(error){
    const issues=error instanceof AuthoringError?error.issues:
      [{path:error.path||'$',code:error.code||'EXECUTION_ERROR',message:error.message}];
    const summary={accepted:false,issues,executionPassed:false,
      native:{status:context.nativeStarted?'failed':'not-run'},
      interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine',
      ...(context.problem?{problem:context.problem}:{})};
    try{record(summary,null,null,context);}catch(writeError){
      // Never overwrite a partially written report. Surface storage failure
      // rather than implying that complete evidence has been saved.
      summary.evidenceWriteError=String(writeError.message);
      process.stdout.write(JSON.stringify(summary,null,2)+'\n');
    }
    process.exitCode=1;
  }
}
