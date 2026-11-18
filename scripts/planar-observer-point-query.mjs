// Standalone JEE analytical source-to-observer planar query evidence.
// No native ray, detector, brightness, Fresnel setting, visibility or image
// is added from incomplete query facts.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeObserverPointQuery,observerPointCapabilities} from '../src/planar-observer-point-query.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const hash=data=>createHash('sha256').update(data).digest('hex');
const usage='Usage: node scripts/planar-observer-point-query.mjs capabilities | <query.json> --out test-artifacts/llm-authoring/<fresh>';
export function runObserverPointEvidence({queryBytes,outputPath}){
 if(!queryBytes||queryBytes.length===0||queryBytes.length>1024*1024)
  throw Error('A nonempty JSON query of at most 1 MB is required');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('A new output directory is required for evidence');
 writeEvidence(out.input,queryBytes);
 const originalInputSha256=hash(queryBytes);
 let result;
 try{
  result=analyzeObserverPointQuery(JSON.parse(Buffer.from(queryBytes).toString('utf8')));
 }catch(error){
  const report={format:'opticsim-planar-observer-point-evidence-v1',
   status:'rejected',issues:[{code:'INVALID_OBSERVER_POINT_QUERY',message:String(error.message)}],
   originalInputSha256,native:{status:'not-run',observations:null,nativeImageDetected:false},
   interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
 }
 const analytical={format:'opticsim-planar-observer-point-analytical-evidence-v1',
  originalInputSha256,results:result,
  native:{status:'not-run',observations:null,nativeImageDetected:false},
  questionSupport:'not-assessed-by-engine'};
 writeEvidence(resolve(out.directory,'analytical-result.json'),JSON.stringify(analytical,null,2)+'\n');
 const report={format:'opticsim-planar-observer-point-evidence-v1',
  status:'analysed',originalInputSha256,results:result,
  native:{status:'not-run',observations:null,nativeImageDetected:false},
  interpretation:'not-assessed-by-engine',questionSupport:'not-assessed-by-engine'};
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:0,report,reportPath:out.report};
}
function readBoundedInput(path){
 const bytes=readFileSync(resolve(path));
 if(bytes.length>1024*1024)throw Error('Query JSON exceeds 1 MB input bound');
 return bytes;
}
function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  process.stdout.write(JSON.stringify(observerPointCapabilities(),null,2)+'\n');return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])throw Error(usage);
 const run=runObserverPointEvidence({queryBytes:readBoundedInput(args[0]),outputPath:args[2]});
 process.stdout.write(JSON.stringify({status:run.status,
  reasonCode:run.report.results?.reasonCode??null,
  value:run.report.results?.value??null,native:'not-run',
  report:run.reportPath},null,2)+'\n');
 process.exitCode=run.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(error){
  console.error(JSON.stringify({status:'infrastructure-error',
   code:'OBSERVER_QUERY_INFRASTRUCTURE',message:String(error.message)}));
  process.exitCode=1;
 }
}
