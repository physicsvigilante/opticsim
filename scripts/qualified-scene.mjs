// One recorded workflow: minimal request + optional result/interpretation sidecars
// -> strict native scene -> qualified results -> portable scene/assumption bundle.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {problemCapabilities,resolveProblemRequest} from '../src/problem-authoring.js';
import {angularCapabilities} from '../src/planar-angle-queries.js';
import {reviseScene,AuthoringError} from '../src/authoring.js';
import {prepareQualifiedStructure,qualifiedStructureCapabilities} from '../src/qualified-structure.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
import {observableCapabilities,validateObservables,evaluateObservables} from '../src/observables.js';
import {initialQualification,validateInterpretation,recordQualifiedEdit,
  createQualifiedBundle,parseQualifiedBundle} from '../src/qualification.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function read(path){
 const bytes=readFileSync(resolve(path));
 if(bytes.length>1024*1024)throw Error('Input exceeds 1 MB');
 return bytes;
}
function usage(){return 'Usage: node scripts/qualified-scene.mjs capabilities | create <request.json> [--illustrate] [--observables <array.json>] [--interpretation <notes.json>] [--out test-artifacts/llm-authoring/<fresh>] | revise <qualified-scene.json> <changes.json> [--out <fresh>] | structure <qualified-scene.json> <changes.json> [--out <fresh>]';}
function report(summary,context,details=null){
 summary.inputSha256=context.inputSha256;
 if(context.output){
  summary.outputs={...context.paths,input:context.output.input,report:context.output.report};
  writeEvidence(context.output.report,JSON.stringify({format:'opticsim-qualified-evidence-v1',summary,details},null,2)+'\n');
 }
 console.log(JSON.stringify(summary,null,2));
}
async function main(context){
 const [command,...args]=process.argv.slice(2);
 if(command==='capabilities'&&!args.length){
  console.log(JSON.stringify({authoring:problemCapabilities(),qualifiedStructure:qualifiedStructureCapabilities(),results:observableCapabilities(),conditionalAngularQueries:angularCapabilities()},null,2));return;
 }
 if(!['create','revise','structure'].includes(command))throw Error(usage());
 const count=command==='create'?1:2;
 if(args.length<count)throw Error(usage());
 const options={},seen=new Set();
 for(let i=count;i<args.length;i++){
  const flag=args[i];if(seen.has(flag))throw Error('Duplicate option '+flag);seen.add(flag);
  if(flag==='--illustrate'&&command==='create')options.illustration=true;
  else if(['--out',...(command==='create'?['--observables','--interpretation']:[])].includes(flag)&&i+1<args.length)options[flag.slice(2)]=args[++i];
  else throw Error(usage());
 }
 const bytes=read(args[0]);context.inputSha256=hash(bytes);
 context.output=reserveAuthoringOutput(options.out,root);context.paths={};
 if(context.output)writeEvidence(context.output.input,bytes);
 const sidecar=(name,path)=>{
  const raw=read(path);
  if(context.output){const dest=resolve(context.output.directory,name+'.json');writeEvidence(dest,raw);context.paths[name]=dest;}
  return JSON.parse(raw.toString('utf8'));
 };
 let doc,qualification,requests,problem;
 if(command==='create'){
  requests=options.observables?sidecar('observables',options.observables):[];
  const interpretation=options.interpretation?sidecar('interpretation',options.interpretation):null;
  validateObservables(requests);validateInterpretation(interpretation);
  problem=resolveProblemRequest(JSON.parse(bytes.toString('utf8')),{illustration:!!options.illustration});
  const {prepared,...preparation}=problem;context.problem=preparation;
  if(!prepared){report({accepted:false,problem:preparation,native:{status:'not-run'},executionPassed:false,questionSupport:'not-assessed-by-engine'},context);process.exitCode=1;return;}
  doc=prepared.document;
  qualification=initialQualification(doc,problem,{inputSha256:context.inputSha256,interpretation});
 }else{
  const prior=await parseQualifiedBundle(bytes.toString('utf8'));
  const patch=sidecar('changes',args[1]);
  if(command==='structure'){
   const prepared=await prepareQualifiedStructure(prior,patch);
   doc=prepared.document;qualification=prepared.qualification;requests=prepared.observables;
   context.structuralRevision={addedIds:prepared.addedIds,removedIds:prepared.removedIds,
    ...(prepared.contractUpgrade?{contractUpgrade:prepared.contractUpgrade}:{}),sourceGiven:false,note:'New hypothetical scenario; source interpretation refers to the original model.'};
  }else{
   if(patch.expectedSha256!==prior.sceneSha256)throw Error('STALE_REVISION: expectedSha256 must match the qualified scene');
   const {expectedSha256,...changes}=patch;
   doc=reviseScene(prior.scene,changes).document;
   qualification=recordQualifiedEdit(prior.scene,doc,prior.qualification);requests=prior.observables;
  }
  context.parentIntegritySha256=prior.integritySha256;
 }
 // Build only after requests, qualification, revisions and geometry pass.
 execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
 const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
 context.nativeStarted=true;
 const execution=evaluateDocument(doc,core);
 const requestedResults=await evaluateObservables(doc,requests,execution.summary);
 const bundle=await createQualifiedBundle(doc,qualification,requests);
 const summary={...execution.summary,qualification,requestedResults,integritySha256:bundle.integritySha256,
  ...(context.parentIntegritySha256?{parentIntegritySha256:context.parentIntegritySha256}:{}),
  ...(context.structuralRevision?{structuralRevision:context.structuralRevision}:{}),
  ...(context.problem?{problem:context.problem}:{})};
 if(context.output){
  const path=resolve(context.output.directory,'qualified-scene.json');
  writeEvidence(path,JSON.stringify(bundle,null,2)+'\n');writeEvidence(context.output.scene,execution.sceneText);
  context.paths={...context.paths,bundle:path,scene:context.output.scene};
 }else summary.bundle=bundle;
 report(summary,context,execution.report);
 if(!execution.summary.executionPassed)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const context={};
 main(context).catch(error=>{
  const summary={accepted:false,executionPassed:false,native:{status:context.nativeStarted?'failed':'not-run'},
   issues:error instanceof AuthoringError?error.issues:[{code:'QUALIFIED_WORKFLOW_ERROR',message:error.message}],
   questionSupport:'not-assessed-by-engine',...(context.problem?{problem:context.problem}:{})};
  try{report(summary,context);}catch(writeError){console.log(JSON.stringify({...summary,evidenceWriteError:writeError.message}));}
  process.exitCode=1;
 });
}
