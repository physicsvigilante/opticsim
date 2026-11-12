// One offline entry point, existing physics/analysis implementations. No model
// call, retries, generated executable code, or implicit numerical-mode changes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planProblem,resultCoverage,problemWorkflowCapabilities} from '../src/problem-workflow.js';
import {evaluateDocument} from './author-scene.mjs';
import {evaluateObservables} from '../src/observables.js';
import {initialQualification,createQualifiedBundle} from '../src/qualification.js';
import {calculatedQualification} from './planar-angle-query.mjs';
import {canonicalJSON,sceneHash} from '../src/qualified-utils.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function executeNative(scene){
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  return evaluateDocument(scene,core);
}
// execute is a trusted test seam, never data loaded from user JSON.
export async function runProblemEvidence({inputBytes,outputPath,execute=executeNative}){
  if(!(inputBytes instanceof Uint8Array)||inputBytes.length>1024*1024)throw Error('A byte input of at most 1 MB is required');
  const bytes=Buffer.from(inputBytes),inputSha256=hash(bytes);
  const out=reserveAuthoringOutput(outputPath,root);
  if(!out)throw Error('Provide a fresh evidence output directory');
  writeEvidence(out.input,bytes);
  const persist=(name,obj)=>writeEvidence(resolve(out.directory,name),JSON.stringify(obj,null,2)+'\n');
  let plan;
  try{plan=planProblem(JSON.parse(bytes.toString('utf8')));}
  catch(error){
    const report={format:'opticsim-problem-report-v1',inputSha256,status:'rejected',
      issues:error.issues||[{code:'INVALID_PROBLEM_ENVELOPE',message:error.message}],
      native:{status:'not-run'},results:[],questionSupport:'not-assessed-by-engine'};
    persist('report.json',report);return {exitCode:1,report,output:out.directory};
  }
  // Persist all mathematical outcomes before invoking optional native code.
  persist('plan.json',plan);
  persist('analytical-results.json',{inputSha256,calculations:plan.calculations,interpretation:plan.request.interpretation??null});
  let portable={status:'not-created'},execution=null;
  if(plan.scene){
    try{
      const notes=plan.request.interpretation??null;
      let q=initialQualification(plan.scene,plan.preparation?.status==='illustrative'?plan.preparation:null,
        {inputSha256,interpretation:notes});
      if(plan.calculations.length){
        const records=plan.calculations.map((c,i)=>{
          const queryBytes=Buffer.from(JSON.stringify(c.query,null,2)+'\n');
          writeEvidence(resolve(out.directory,'calculation-'+(i+1)+'.query.json'),queryBytes);
          return calculatedQualification(plan.scene,plan.request.physical,c.query,c.result,inputSha256,hash(queryBytes));
        });
        q.calculations=records.flatMap(x=>x.calculations);
        if(records.some(x=>x.origin.preparationStatus==='unknown'))q.origin.preparationStatus='unknown';
      }
      // Original interpretation is never replaced with generated interpretation.
      const bundle=await createQualifiedBundle(plan.scene,q,plan.nativeRequests);
      persist('qualified-scene.json',bundle);
      portable={status:'created',file:'qualified-scene.json',sceneSha256:bundle.sceneSha256,integritySha256:bundle.integritySha256};
    }catch(error){portable={status:'failed',reason:error.message};}
  }
  let native={status:'not-run',reason:plan.native.reason};
  let results=structuredClone(plan.results);
  if(plan.native.canRun){
    try{
      execution=await execute(structuredClone(plan.scene));
      if(!execution?.summary||execution.summary.canonicalSha256!==await sceneHash(plan.scene))
        throw Error('Native evidence does not match the planned scene hash');
      native={...execution.summary.native,executionPassed:execution.summary.executionPassed};
    }catch(error){
      native={status:'failed',executionPassed:false,reason:error.message};
      execution={summary:{canonicalSha256:await sceneHash(plan.scene),native,executionPassed:false,observations:null}};
    }
    // Storage failure is infrastructure failure, never relabelled as failed optics.
    // The durable plan/math still exist; do not claim final evidence was saved.
    persist('native-evidence.json',execution);
    const observed=await evaluateObservables(plan.scene,plan.nativeRequests,execution.summary);
    const map=new Map(observed.results.map(r=>[r.id,r]));
    results=results.map(r=>map.get(r.id)||r);
  }
  const coverage=resultCoverage(results),invalid=results.some(r=>r.status==='invalid-input')||plan.preparation?.status==='invalid-input';
  const status=invalid?'invalid-input':coverage.status;
  const report={format:'opticsim-problem-report-v1',inputSha256,status,coverage,
    dispatch:{calculationRequests:plan.calculations.length,nativeRequested:plan.native.required,
      nativeCalls:plan.native.canRun?1:0,nativeCallDefinition:'executor attempts, including setup failure',
      repairs:0,externalModelCalls:0},
    preparation:plan.preparation,diagnostics:plan.diagnostics,
    interpretation:plan.request.interpretation??null,interpretationAssessment:plan.interpretation,
    native,results,portable,questionSupport:'not-assessed-by-engine'};
  persist('report.json',report);
  const exitCode=invalid?1:coverage.available<coverage.requested||native.status==='failed'||portable.status==='failed'||
    plan.native.required&&!['completed','completed-with-warnings'].includes(native.status)?2:0;
  return {exitCode,report,output:out.directory};
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='capabilities'){console.log(JSON.stringify(problemWorkflowCapabilities(),null,2));return;}
  if(args.length!==3||args[1]!=='--out')throw Error('Usage: node scripts/run-problem.mjs capabilities | problem.json --out test-artifacts/llm-authoring/<fresh>');
  const result=await runProblemEvidence({inputBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
  console.log(JSON.stringify({status:result.report.status,coverage:result.report.coverage,
    native:result.report.native,report:resolve(result.output,'report.json')},null,2));
  process.exitCode=result.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{
  console.error(JSON.stringify({status:'infrastructure-error',message:error.message}));process.exitCode=1;
});
