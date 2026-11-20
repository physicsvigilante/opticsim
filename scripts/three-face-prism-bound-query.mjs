// Source-bound J13 strict TIR inequality, not a native reconstructed ray.
// Original JSON bytes are recorded unchanged; only standalone maths runs.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {analyzeThreeFacePrismBound,threeFacePrismCapabilities}
 from '../src/three-face-prism-tir-bound.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const usage='Usage: node scripts/three-face-prism-bound-query.mjs capabilities | <query.json> --out test-artifacts/llm-authoring/<fresh>';
export function runThreeFacePrismBoundEvidence({queryBytes,outputPath}){
 if(!queryBytes||queryBytes.length===0||queryBytes.length>1024*1024)
  throw Error('A nonempty bounded JSON input of at most 1 MB is required');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('A fresh bounded output directory is required');
 writeEvidence(out.input,queryBytes);
 const originalInputSha256=sha256(queryBytes);
 const native={status:'not-run',observations:null,nativeFaceSequenceVerified:false,nativeImageDetected:false};
 let result;
 try{result=analyzeThreeFacePrismBound(JSON.parse(Buffer.from(queryBytes).toString('utf8')));}
 catch(e){
  const report={format:'opticsim-three-face-prism-bound-evidence-v1',
   originalInputSha256,status:'rejected',
   issues:[{code:e?.code??'INVALID_THREE_FACE_QUERY',message:String(e?.message)}],
   native,sourceQuestionSolved:false,portable:{status:'not-created'}};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
 }
 const analytical={format:'opticsim-three-face-prism-bound-analytical-evidence-v1',
  originalInputSha256,result,native,
  conditionalSourceInterpretation:true,originalQuestionSolved:false};
 writeEvidence(resolve(out.directory,'analytical-result.json'),
  JSON.stringify(analytical,null,2)+'\n');
 const report={format:'opticsim-three-face-prism-bound-evidence-v1',
  originalInputSha256,status:result.status,result,native,
  sourceQuestionSolved:false,portable:{status:'not-created'}};
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:0,report,reportPath:out.report};
}
function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  process.stdout.write(JSON.stringify(threeFacePrismCapabilities(),null,2)+'\n');
  return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])throw Error(usage);
 const r=runThreeFacePrismBoundEvidence({
  queryBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
 process.stdout.write(JSON.stringify({status:r.status,
  value:r.report.result?.value??null,native:'not-run',report:r.reportPath},null,2)+'\n');
 process.exitCode=r.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){
  console.error(JSON.stringify({status:'infrastructure-error',
   code:'THREE_FACE_PRISM_CLI_INFRASTRUCTURE',message:String(e.message)}));
  process.exitCode=1;
 }
}
