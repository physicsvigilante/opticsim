// J11 symbolic/explicit 3D escape footprint; never runs native rays.
// Original input is preserved verbatim and hashed before mathematical analysis.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {analyzeEscapeDisc,escapeDiscCapabilities} from '../src/axisymmetric-escape-disc.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const usage='Usage: node scripts/axisymmetric-escape-disc-query.mjs capabilities | <query.json> --out test-artifacts/llm-authoring/<fresh>';
export function runEscapeDiscEvidence({queryBytes,outputPath}){
 if(!queryBytes||queryBytes.length===0||queryBytes.length>1024*1024)
  throw Error('A nonempty bounded JSON query of at most 1 MB is required');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('A fresh output directory is required');
 writeEvidence(out.input,queryBytes);
 const originalInputSha256=hash(queryBytes);
 const native={status:'not-run',observations:null,native3DVisibilityCertified:false,
  physicalDiscSimulated:false,nativeImageDetected:false};
 let result;
 try{result=analyzeEscapeDisc(JSON.parse(Buffer.from(queryBytes).toString('utf8')));}
 catch(e){
  const report={format:'opticsim-escape-disc-evidence-v1',status:'rejected',
   originalInputSha256,
   issues:[{code:e?.code??'INVALID_AXISYMMETRIC_ESCAPE_QUERY',message:String(e?.message)}],
   native,originalJeeSolved:false,portable:{status:'not-created'}};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
 }
 const analytical={format:'opticsim-escape-disc-analytical-evidence-v1',
  originalInputSha256,result,native,
  sourceInterpretation:'conditional-3d-axisymmetric-geometrical-only',
  originalJeeSolved:false};
 writeEvidence(resolve(out.directory,'analytical-result.json'),
  JSON.stringify(analytical,null,2)+'\n');
 const report={format:'opticsim-escape-disc-evidence-v1',
  status:result.status,originalInputSha256,result,native,
  sourceInterpretation:'conditional-3d-axisymmetric-geometrical-only',
  originalJeeSolved:false,portable:{status:'not-created'}};
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:0,report,reportPath:out.report};
}
function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  process.stdout.write(JSON.stringify(escapeDiscCapabilities(),null,2)+'\n');return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])throw Error(usage);
 const result=runEscapeDiscEvidence({queryBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
 process.stdout.write(JSON.stringify({status:result.status,
  value:result.report.result?.value??null,native:'not-run',
  report:result.reportPath},null,2)+'\n');
 process.exitCode=result.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){
  console.error(JSON.stringify({status:'infrastructure-error',
   code:'ESCAPE_DISC_CLI_INFRASTRUCTURE',message:String(e.message)}));
  process.exitCode=1;
 }
}
