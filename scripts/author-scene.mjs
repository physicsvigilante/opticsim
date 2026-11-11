// Opticsim LLM authoring CLI. The LLM chooses physics; this routine prepares
// strict v4 scene data and delegates actual execution to the existing checker.
// No remote API, no extra ray tracer, no unapproved publication.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capabilities,prepareScene,reviseScene,AuthoringError} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {checkCandidate} from '../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=text=>createHash('sha256').update(text).digest('hex');
const maxInputBytes=1024*1024;
const safeRead=path=>{
  const bytes=readFileSync(resolve(path));
  if(bytes.length>maxInputBytes)throw new AuthoringError([{
    path:'$',code:'INPUT_TOO_LARGE',message:'Input JSON exceeds the 1 MB document limit'
  }]);
  try{return JSON.parse(bytes.toString('utf8'));}
  catch(error){throw new AuthoringError([{path:'$',code:'INVALID_JSON',message:error.message}]);}
};
function outputPaths(prefix){
  if(!prefix)return null;
  const target=resolve(prefix),allowed=resolve(root,'test-artifacts/llm-authoring')+sep;
  if(!target.startsWith(allowed)||target.endsWith(sep))
    throw new AuthoringError([{path:'--out',code:'INVALID_OUTPUT',
      message:'Output must be a directory beneath this repo test-artifacts/llm-authoring/'}]);
  return {directory:target,scene:resolve(target,'scene.ray-optics-2d.json'),
    report:resolve(target,'report.json')};
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
    observations:completed?{
      emissionsById:diag.emissionsById,
      reflectionsById:diag.reflectionsById,
      detectorsById:diag.detectorsById
    }:null,
    measurementState,analysis:{status:run.analysis.status,reason:run.analysis.reason},
    executionPassed:run.executionPassed,
    interpretation:'not-assessed-by-engine'
  };
  return {summary,report:run,sceneText};
}
function usage() {
  return 'Usage:\n'+
    '  node scripts/author-scene.mjs capabilities\n'+
    '  node scripts/author-scene.mjs evaluate <request.json> [--out test-artifacts/llm-authoring/<name>]\n'+
    '  node scripts/author-scene.mjs revise <scene.json> <changes.json> [--out test-artifacts/llm-authoring/<name>]\n'+
    'The evaluate/revise commands build the pinned native test core and return structured diagnostics.\n';
}
function main(){
  const [command,...args]=process.argv.slice(2);
  if(command==='capabilities'&&args.length===0){
    process.stdout.write(JSON.stringify(capabilities(),null,2)+'\n');return;
  }
  if(!['evaluate','revise'].includes(command))throw new Error(usage());
  const count=command==='evaluate'?1:2;
  if(args.length!==count&&!(args.length===count+2&&args[count]==='--out'))
    throw new Error(usage());
  const output=outputPaths(args.length===count+2?args[count+1]:null);
  let prepared;
  if(command==='evaluate')prepared=prepareScene(safeRead(args[0]));
  else {
    const base=safeRead(args[0]),edit=safeRead(args[1]);
    if(!edit||typeof edit!=='object'||Array.isArray(edit)||
       !Object.hasOwn(edit,'expectedSha256'))
      throw new AuthoringError([{path:'$.expectedSha256',code:'MISSING_REVISION',
        message:'A revision hash is required for optimistic concurrency'}]);
    const actual=hash(serializeSave(base));
    if(edit.expectedSha256!==actual)
      throw new AuthoringError([{path:'$.expectedSha256',code:'STALE_REVISION',
        message:'The authored scene has changed; reload before applying this edit'}]);
    const {expectedSha256, ...changeSet}=edit;
    prepared=reviseScene(base,changeSet);
  }
  // Prepare and validate before building; missing/unsupported physics must
  // not cause an expensive native run or produce a fabricated "fixed" scene.
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
    {cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const result=evaluateDocument(prepared.document,core);
  const summary={...result.summary,
    ...(command==='evaluate'?{preparation:prepared.preparation}:
      {revision:{changesApplied:prepared.changesApplied}})};
  if(output){
    mkdirSync(output.directory,{recursive:true});
    writeFileSync(output.scene,result.sceneText);
    writeFileSync(output.report,JSON.stringify({summary,details:result.report},null,2)+'\n');
    summary.outputs={scene:output.scene,report:output.report};
  }else{
    summary.document=prepared.document;
  }
  process.stdout.write(JSON.stringify(summary,null,2)+'\n');
  if(!summary.executionPassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){
    const issues=error instanceof AuthoringError?error.issues:
      [{path:error.path||'$',code:error.code||'EXECUTION_ERROR',message:error.message}];
    process.stdout.write(JSON.stringify({accepted:false,issues,
      native:{status:'not-run'},interpretation:'not-assessed-by-engine'},null,2)+'\n');
    process.exitCode=1;
  }
}
