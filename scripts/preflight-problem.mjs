// Zero-native, read-only authoring preflight. No PhyDemo build, network calls,
// default source creation, physics repair, output folders, or result scoring.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {planProblem,problemWorkflowCapabilities} from '../src/problem-workflow.js';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
function main(args){
  if(args.length===1&&args[0]==='capabilities'){
    console.log(JSON.stringify(problemWorkflowCapabilities(),null,2));return;
  }
  if(args.length!==1)throw Error(
    'Usage: node scripts/preflight-problem.mjs capabilities | <opticsim-problem-v1.json>');
  const inputBytes=readFileSync(resolve(args[0]));
  if(inputBytes.length>1024*1024)throw Error('Input exceeds the bounded 1 MB request limit');
  const inputSha256=sha256(inputBytes);
  let plan;
  try{plan=planProblem(JSON.parse(inputBytes.toString('utf8')));}
  catch(error){
    const report={format:'opticsim-problem-preflight-v1',inputSha256,
      status:'rejected',issues:error.issues||[{code:'INVALID_PROBLEM_ENVELOPE',message:error.message}],
      native:{status:'not-run',calls:0},questionSupport:'not-assessed-by-engine'};
    console.log(JSON.stringify(report,null,2));process.exitCode=1;return;
  }
  const results=plan.results.map(({id,kind,status,value,reasonCode,reason,...rest})=>({
    id,kind,status,value,reasonCode,reason,...rest}));
  const blocker=results.some(x=>['needs-information','invalid-input','unavailable','multiple-solutions','numerically-indeterminate'].includes(x.status));
  const status=plan.preparation?.status==='invalid-input'||results.some(x=>x.status==='invalid-input')?'invalid-input':
    blocker||plan.preparation?.status==='unsupported'?'blocked':
    plan.native.canRun?'native-ready':'no-native-required';
  const report={format:'opticsim-problem-preflight-v1',inputSha256,
    status,scenePrepared:!!plan.scene,
    preparation:plan.preparation,results,
    targetBindings:plan.targetBindings,methodSuitability:plan.methodSuitability,
    native:{...plan.native,status:'not-run',calls:0},
    diagnostics:plan.diagnostics,
    interpretationAssessment:plan.interpretation,questionSupport:plan.questionSupport,
    note:'Only exact supplied facts and deterministic model checks. Conditional mathematics may be calculated; native tracing and independent question-fidelity assessment are not performed.'};
  console.log(JSON.stringify(report,null,2));
  if(blocker||status==='invalid-input'||status==='blocked')process.exitCode=2;
}
try{main(process.argv.slice(2));}
catch(error){console.error(JSON.stringify({status:'infrastructure-error',message:error.message}));process.exitCode=1;}
