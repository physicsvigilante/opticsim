// JEE-style two-source lens inverse: signed conditional Gaussian positions.
// No native scene or material parameters are invented; source bytes hashed.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeTwoSourceLensCoincidence,twoSourceLensCoincidenceCapabilities}
 from '../src/two-source-lens-coincidence-query.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const usage='Usage: node scripts/two-source-lens-coincidence-query.mjs capabilities | <query.json> --out test-artifacts/llm-authoring/<fresh>';
export function runTwoSourceLensCoincidenceEvidence({queryBytes,outputPath}){
 if(!queryBytes||queryBytes.length===0||queryBytes.length>1024*1024)
  throw Error('A nonempty bounded JSON query of at most 1 MB is required');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('Fresh output path is required');
 writeEvidence(out.input,queryBytes);
 const originalInputSha256=hash(queryBytes);
 const native={status:'not-run',observations:null,nativeImageDetected:false};
 let result;
 try{
  result=analyzeTwoSourceLensCoincidence(JSON.parse(Buffer.from(queryBytes).toString('utf8')));
 }catch(e){
  const report={format:'opticsim-two-source-lens-evidence-v1',
   status:'rejected',originalInputSha256,
   issues:[{code:e?.code??'INVALID_LENS_INVERSE_QUERY',message:String(e?.message)}],
   native,originalInterpretation:'not-assessed-by-engine',
   sourceQuestionSolved:false};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
 }
 const analytical={format:'opticsim-two-source-lens-analytical-evidence-v1',
  originalInputSha256,results:result,native,
  originalInterpretation:'conditional-coaxial-paraxial-only'};
 writeEvidence(resolve(out.directory,'analytical-result.json'),
  JSON.stringify(analytical,null,2)+'\n');
 const report={format:'opticsim-two-source-lens-evidence-v1',
  status:'analysed',originalInputSha256,results:result,native,
  originalInterpretation:'conditional-coaxial-paraxial-only',
  sourceQuestionSolved:null,nativeImageDetected:false};
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:0,report,reportPath:out.report};
}
function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  process.stdout.write(JSON.stringify(twoSourceLensCoincidenceCapabilities(),null,2)+'\n');
  return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])throw Error(usage);
 const r=runTwoSourceLensCoincidenceEvidence({
  queryBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
 process.stdout.write(JSON.stringify({status:r.status,
  value:r.report.results?.value??null,native:'not-run',report:r.reportPath},null,2)+'\n');
 process.exitCode=r.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){
  console.error(JSON.stringify({status:'infrastructure-error',
   code:'TWO_SOURCE_LENS_INVERSE_CLI_INFRASTRUCTURE',message:String(e.message)}));
  process.exitCode=1;
 }
}
