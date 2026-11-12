// Repeatable pilot scorer for LLM-authored optics scenes. No LLM API,
// source-image reading or inference occurs here. Benchmark inputs and expected
// physical values are separate files; real-problem explanations need human review.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {prepareScene,AuthoringError} from '../../src/authoring.js';
import {serializeSave} from '../../src/contract.js';
import {checkCandidate} from '../../skills/sim-ro-image-to-scene/scripts/check-scene.mjs';

const directory=fileURLToPath(new URL('.',import.meta.url));
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=name=>JSON.parse(readFileSync(resolve(directory,name),'utf8'));
const benchmark=read('prompts.json'),reference=read('authoring-reference.json'),
  corpus=read('corpus-prompts.json'),corpusReference=read('corpus-reference.json');
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const quantize=x=>Math.round((Object.is(x,-0)?0:x)*1e6)/1e6;
function signature(component){
  const physical=Object.fromEntries(Object.entries(component.parameters)
    .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,quantize(v)]));
  const emission=component.type==='point-source'?
    component.emission.mode==='full-circle'?{mode:'full-circle'}:
    {mode:'directional',directionDeg:quantize(component.emission.directionDeg),
      angleDeg:quantize(component.emission.angleDeg)}:null;
  return JSON.stringify({type:component.type,physical,emission});
}
function sceneSignature(doc){
  return doc.physics.components.map(signature).sort();
}
function idsSignature(doc){
  return doc.physics.components.map(c=>[c.id,signature(c)]).sort((a,b)=>a[0].localeCompare(b[0]));
}
function submissionRows(rows,validIds,label){
  if(!Array.isArray(rows))throw Error(label+' must be an array');
  const found=new Map();
  for(const [i,row] of rows.entries()){
    if(!isObject(row)||typeof row.id!=='string'||!validIds.has(row.id))
      throw Error(label+'['+i+']: unknown or malformed case ID');
    if(found.has(row.id))throw Error(label+': duplicate case '+row.id);
    found.set(row.id,row);
  }
  return found;
}
function issue(error){
  if(error instanceof AuthoringError)return error.issues.map(e=>({
    code:e.code,path:e.path,message:e.message
  }));
  return [{code:'EVALUATION_ERROR',path:'$',message:String(error.message||error)}];
}
export function scoreSubmission(submission,core){
  if(!isObject(submission)||submission.format!=='opticsim-pilot-submission-v1')
    throw Error('Expected opticsim-pilot-submission-v1 JSON object');
  const expectedIds=new Set(benchmark.cases.map(c=>c.id));
  const realIds=new Set(corpus.cases.map(c=>c.id));
  const authored=submissionRows(submission.authoring,expectedIds,'authoring');
  const scopeRows=submissionRows(submission.scope,realIds,'scope');
  const goldById=new Map(reference.cases.map(c=>[c.id,c.request]));
  const realGoldById=new Map(corpusReference.cases.map(c=>[c.id,c]));
  const authoring=[];
  for(const {id} of benchmark.cases){
    const row=authored.get(id),result={id,submitted:!!row,
      valid:false,physicalFidelity:false,componentIdFidelity:false,
      executionPassed:false,nativeStatus:'not-run',analysisStatus:'not-run',
      issues:[]};
    if(!row){result.issues.push({code:'MISSING_SUBMISSION',path:'$.authoring',
      message:'No authoring request submitted'});authoring.push(result);continue;}
    if(!isObject(row.request)){
      result.issues.push({code:'MISSING_REQUEST',path:'$.authoring.'+id,
        message:'A component request object is required'});authoring.push(result);continue;}
    try {
      const actual=prepareScene(row.request).document;
      const expected=prepareScene(goldById.get(id)).document;
      result.valid=true;
      result.physicalFidelity=JSON.stringify(sceneSignature(actual))===
        JSON.stringify(sceneSignature(expected));
      result.componentIdFidelity=JSON.stringify(idsSignature(actual))===
        JSON.stringify(idsSignature(expected));
      // Execution is an independent result, never proof of problem fidelity.
      const run=checkCandidate(serializeSave(actual),core);
      result.executionPassed=run.executionPassed;
      result.nativeStatus=run.native.status;
      result.analysisStatus=run.analysis.status;
      if(!result.physicalFidelity)
        result.issues.push({code:'PHYSICAL_MISMATCH',path:'$.authoring.'+id,
          message:'The authored component types or physical values differ from the benchmark reference'});
      if(run.native.diagnostics?.warnings?.length)
        result.issues.push({code:'NATIVE_WARNINGS',path:'$.authoring.'+id,
          message:run.native.diagnostics.warnings.join(' ').slice(0,500)});
      if(!run.executionPassed)
        result.issues.push({code:'NATIVE_INCOMPLETE',path:'$.authoring.'+id,
          message:'Native execution/round trips did not qualify'});
    }catch(error){result.issues.push(...issue(error));}
    authoring.push(result);
  }
  const scope=[];
  for(const {id} of corpus.cases){
    const row=scopeRows.get(id),expected=realGoldById.get(id);
    const valid=!!row&&typeof row.reason==='string'&&row.reason.trim().length>=15&&
      row.reason.length<=2000&&['exact','illustration-only','unsupported'].includes(row.scope);
    scope.push({id,submitted:!!row,valid,
      scopeLabelCorrect:valid&&row.scope===expected.scope,
      expectedScope:expected.scope,
      issues:!row?['MISSING_SUBMISSION']:!valid?['INVALID_SCOPE_OR_REASON']:
        row.scope!==expected.scope?['SCOPE_MISMATCH']:[],
      explanationAssessment:'requires-independent-review'});
  }
  const counts={totalAuthoring:authoring.length,authored:authoring.filter(x=>x.submitted).length,
    structurallyValid:authoring.filter(x=>x.valid).length,
    physicallyFaithful:authoring.filter(x=>x.physicalFidelity).length,
    idsPreserved:authoring.filter(x=>x.componentIdFidelity).length,
    nativeExecutionPassed:authoring.filter(x=>x.executionPassed).length,
    totalCorpus:scope.length,classificationsSubmitted:scope.filter(x=>x.submitted).length,
    scopeLabelsCorrect:scope.filter(x=>x.scopeLabelCorrect).length};
  return {
    benchmark:'llm-pilot-v1',counts,
    interpretation:'scored-only-against-curated-reference-for-synthetic-scenes',
    corpusExplanations:'not-independently-graded',
    solutionImages:'not-loaded',
    notes:[
      'A physically wrong scene can execute; native completion does not certify semantic fidelity.',
      'Scope-label equality does not certify the reasoning text; independently review explanations.',
      'This runner makes no LLM calls; a control-fixture pass is NOT an LLM success rate.',
      'General tracing has no route-independent analytical image prediction.'
    ],
    authoring,scope
  };
}
function usage(){
  return 'Usage: node evaluation/llm-pilot-v1/score.mjs <submission.json> [--report test-artifacts/llm-evaluation/<file>.json]\n'+
    'Build the pinned core first using npm test. Submissions may be partial; missing cases count as missing.\n';
}
function main(){
  const args=process.argv.slice(2);
  if(args.length!==1&&!(args.length===3&&args[1]==='--report'))throw Error(usage());
  const bytes=readFileSync(resolve(args[0]));
  if(bytes.length>1024*1024)throw Error('Submission exceeds 1 MB');
  const submission=JSON.parse(bytes.toString('utf8'));
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const report=scoreSubmission(submission,core);
  if(args.length===3){
    const target=resolve(args[2]),allowed=resolve(root,'test-artifacts/llm-evaluation')+sep;
    if(!target.startsWith(allowed)||!target.endsWith('.json'))
      throw Error('Report must be a .json below test-artifacts/llm-evaluation/');
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error(error.message);process.exitCode=2;}
}
