// Deterministic ideal-model angle calculation. Canonical scenes are created
// only when full explicit authoring facts exist. Optional native checks cannot
// erase a completed analytical result or its original input evidence.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {analyzePlanarAngleQuery,angularCapabilities} from '../src/planar-angle-queries.js';
import {serializeSave} from '../src/contract.js';
import {initialQualification,createQualifiedBundle} from '../src/qualification.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const usage='Usage: node scripts/planar-angle-query.mjs capabilities | <minimal-request-or-angular-facts.json> <angle-query.json> --out test-artifacts/llm-authoring/<fresh> [--native-check]';
function input(path){
  const bytes=readFileSync(resolve(path));
  if(bytes.length>1024*1024)throw Error('Input is larger than 1MB');
  return bytes;
}
function nativeCheck(scene){
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
    {cwd:root,stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const execution=evaluateDocument(scene,core);
  return {status:execution.summary.native.status,
    executionPassed:execution.summary.executionPassed,
    actualObservations:execution.summary.observations,
    diagnostics:execution.report.native.diagnostics||null,
    limitations:'These are actual native observations or partial diagnostics. They do not confirm that conditional mathematical results were natively observed or that the source question was interpreted correctly.'};
}
function compactCalculation(result){
  return result.kind==='critical-input-angle'?result.value:{
    initial:result.initial,branches:result.results?.map(b=>({
      id:b.id,status:b.status,value:b.value??null,reasonCode:b.reasonCode??null
    }))??[]
  };
}
function calculatedQualification(scene,request,query,result,inputSha256,querySha256){
  const originalUnknown=result.kind==='critical-input-angle';
  const interpretation={requestedResult:'Calculate conditional planar-media angular quantities ('+result.kind+').',
    stated:['Original author input and typed query are preserved with SHA-256 references in calculation provenance.'],
    derived:['Angles are deterministic ideal-model calculations, not PhyDemo native detections.'],
    assumptions:result.assumptions||[],
    unknowns:originalUnknown?['Original source direction was unknown; the saved scene uses a distinctly labelled calculated value.']:[]};
  const origin={status:originalUnknown?'unknown':'fully-specified',appliedChoices:[],policyVersion:null};
  const qualification=initialQualification(scene,origin,{inputSha256,interpretation});
  qualification.calculations=[{
    format:'opticsim-qualified-calculation-v1',inputSha256,querySha256,
    sourceRequest:structuredClone(request),query:structuredClone(query),
    method:'conditional-analytical',kind:result.kind,status:result.status,
    resultValue:structuredClone(compactCalculation(result)),
    computedFields:(result.derivedOnly||[]).map(f=>({...f,unit:'degrees'})),
    conditions:[...(result.assumptions||[])]
  }];
  return qualification;
}
function rejected(out,inputSha256,querySha256,error){
  const report={format:'opticsim-planar-angular-evidence-v1',status:'rejected',
    stage:'input-or-analysis-validation',native:{status:'not-run',observations:null},
    originalInputSha256:inputSha256,queryInputSha256,
    issues:[{code:error?.code||'ANALYTICAL_QUERY_REJECTED',message:String(error?.message||error)}],
    questionSupport:'not-assessed-by-engine'};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
}
// This exported function allows failure injection in tests only. No data-
// supplied callbacks or executable expressions enter the authoring contract.
export async function runAngleQueryEvidence({requestBytes,queryBytes,outputPath,
    runNative=false,executeNative=nativeCheck}){
  if(!requestBytes||!queryBytes||requestBytes.length>1024*1024||queryBytes.length>1024*1024)
    throw Error('Both bounded original JSON inputs are required');
  const out=reserveAuthoringOutput(outputPath,root);
  if(!out)throw Error('A fresh evidence output directory is required');
  writeEvidence(out.input,requestBytes);
  writeEvidence(resolve(out.directory,'angle-query.json'),queryBytes);
  const inputSha256=hash(requestBytes),querySha256=hash(queryBytes);
  let request,query,result;
  try{
    request=JSON.parse(requestBytes.toString('utf8'));
    query=JSON.parse(queryBytes.toString('utf8'));
    result=analyzePlanarAngleQuery(request,query);
  }catch(error){return rejected(out,inputSha256,querySha256,error);}
  const scene=result.proposedForwardScene||result.canonicalForwardScene||null;
  const analysis={format:'opticsim-planar-analytical-result-v1',
    originalInputSha256:inputSha256,queryInputSha256,
    status:result.status,method:result.method,results:result,
    native:{status:'not-run',observations:null},questionSupport:'not-assessed-by-engine'};
  // DURABLE BEFORE optional native build and before packaging.
  writeEvidence(resolve(out.directory,'analytical-result.json'),JSON.stringify(analysis,null,2)+'\n');
  let portable={status:'not-applicable',reason:result.noNativeReason||'No complete forward scene.'};
  if(scene){
    try{
      const q=calculatedQualification(scene,request,query,result,inputSha256,querySha256);
      const bundle=await createQualifiedBundle(scene,q,[]);
      const path=resolve(out.directory,'derived-forward-scene.qualified.json');
      writeEvidence(path,JSON.stringify(bundle,null,2)+'\n');
      portable={status:'created',path,sceneSha256:bundle.sceneSha256,
        integritySha256:bundle.integritySha256};
    }catch(error){
      portable={status:'failed',reason:String(error.message)};
    }
  }
  let native=null,exitCode=portable.status==='failed'?2:0;
  if(runNative){
    if(!scene){
      native={status:'not-run',stage:'scene-preparation',
        reason:result.noNativeReason||'An accepted forward scene is unavailable. Provide missing native-only physics explicitly.'};
      exitCode=2;
    }else{
      try{native=await executeNative(scene);}
      catch(error){
        native={status:'failed',stage:'native-build-or-execution',
          executionPassed:false,actualObservations:null,reason:String(error.message)};
        exitCode=2;
      }
    }
  }
  const report={format:'opticsim-planar-angular-evidence-v1',
    status:exitCode===2?'analysed-with-infrastructure-limitation':'analysed',
    originalInputSha256:inputSha256,queryInputSha256,
    physicalSceneMutated:false,method:'conditional-analytical',
    results:result,portableQualifiedScene:portable,
    ...(scene?{derivedForwardSceneSha256:hash(serializeSave(scene))}:{}),
    ...(native?{forwardNativeCheck:native}:{}),
    originalInterpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:result.status,exitCode,report,reportPath:out.report,
    nativeStatus:native?.status||'not-run'};
}
async function main(){
  const args=process.argv.slice(2);
  if(args[0]==='capabilities'&&args.length===1){
    console.log(JSON.stringify(angularCapabilities(),null,2));return;
  }
  if(args.length<4||args[2]!=='--out'||!args[3]||
    args.length>5||args.length===5&&args[4]!=='--native-check')throw Error(usage);
  const result=await runAngleQueryEvidence({requestBytes:input(args[0]),
    queryBytes:input(args[1]),outputPath:args[3],runNative:args.length===5});
  console.log(JSON.stringify({status:result.status,
    results:result.report.results?.results?.map(r=>({id:r.id,status:r.status,value:r.value}))||
      result.report.results?.value||null,
    nativeCheck:result.nativeStatus,report:result.reportPath},null,2));
  process.exitCode=result.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    console.error(JSON.stringify({status:'infrastructure-error',
      code:'ANALYTICAL_CLI_INFRASTRUCTURE',message:String(error.message)}));
    process.exitCode=1;
  });
}
