// Deterministic ideal-model inverse/branch analysis over a raw v5 authoring
// request. It does not fabricate native observations, modify original inputs,
// run external models, or introduce an optical ray-route programming language.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {analyzePlanarAngleQuery,angularCapabilities} from '../src/planar-angle-queries.js';
import {serializeSave} from '../src/contract.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
const usage='Usage: node scripts/planar-angle-query.mjs capabilities | <minimal-scene-request.json> <angle-query.json> --out test-artifacts/llm-authoring/<fresh> [--native-check]';
function input(path){
  const bytes=readFileSync(resolve(path));
  if(bytes.length>1024*1024)throw Error('Input is larger than 1MB');
  return bytes;
}
async function main(){
  const args=process.argv.slice(2);
  if(args[0]==='capabilities'&&args.length===1){console.log(JSON.stringify(angularCapabilities(),null,2));return;}
  if(args.length<4||args[2]!=='--out'||!args[3]||
    args.length>5||args.length===5&&args[4]!=='--native-check')throw Error(usage);
  const requestBytes=input(args[0]),queryBytes=input(args[1]);
  const output=reserveAuthoringOutput(args[3],root);
  if(!output)throw Error('Fresh evidence output required');
  writeEvidence(output.input,requestBytes);
  writeEvidence(resolve(output.directory,'angle-query.json'),queryBytes);
  const request=JSON.parse(requestBytes),query=JSON.parse(queryBytes);
  const result=analyzePlanarAngleQuery(request,query);
  const scene=result.proposedForwardScene||result.canonicalForwardScene||null;
  let native=null;
  if(args.length===5){
    if(!scene)native={status:'not-run',reason:'No supported validated forward scene can be constructed from this constraint.'};
    else{
      execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
        {cwd:root,stdio:['ignore','pipe','pipe']});
      const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
      const execution=evaluateDocument(scene,core);
      native={status:execution.summary.native.status,
        executionPassed:execution.summary.executionPassed,
        actualObservations:execution.summary.observations,
        diagnostics:execution.report.native.diagnostics||null,
        limitations:'These are native observations/partial diagnostics, not evidence that the conditional analytical result is a native detected result.'};
    }
  }
  const report={format:'opticsim-planar-angular-evidence-v1',
    originalInputSha256:hash(requestBytes),queryInputSha256:hash(queryBytes),
    physicalSceneMutated:false,method:'conditional-analytical',results:result,
    ...(native?{forwardNativeCheck:native}:{}),
    originalInterpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'};
  if(scene){
    const path=resolve(output.directory,'derived-forward-scene.ray-optics-2d.json');
    writeEvidence(path,serializeSave(scene));
    report.derivedForwardSceneSha256=hash(serializeSave(scene));
    report.derivedForwardScene=path;
  }
  writeEvidence(output.report,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:result.status,kind:result.kind,
    results:result.results?.map(r=>({id:r.id,status:r.status,value:r.value}))||result.value,
    nativeCheck:native?.status||'not-run',report:output.report},null,2));
}
main().catch(e=>{
  console.error(JSON.stringify({status:'rejected',error:e.message}));
  process.exitCode=1;
});
