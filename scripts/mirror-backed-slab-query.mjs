// Source-bound mirror-backed slab displacement, pure analytical evidence.
// No native PhyDemo is imported, no missing exterior medium invented.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {analyzeMirrorBackedSlab,mirrorBackedSlabCapabilities}
 from '../src/mirror-backed-slab-displacement.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=x=>createHash('sha256').update(x).digest('hex');
export function runMirrorBackedSlabEvidence({queryBytes,outputPath}){
 if(!queryBytes||queryBytes.length===0||queryBytes.length>1024*1024)
  throw Error('A nonempty bounded JSON query of at most 1 MB is required');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('A fresh output directory beneath test-artifacts/llm-authoring is required');
 writeEvidence(out.input,queryBytes);
 const originalInputSha256=hash(queryBytes);
 const native={status:'not-run',observations:null,nativePathVerified:false,nativeImageDetected:false};
 let result;
 try{result=analyzeMirrorBackedSlab(JSON.parse(Buffer.from(queryBytes).toString('utf8')));}
 catch(e){
  const report={format:'opticsim-mirror-backed-slab-evidence-v1',
   status:'rejected',originalInputSha256,
   issues:[{code:e?.code||'INVALID_SLAB_QUERY',message:String(e?.message)}],
   native,originalJeeSolved:false,portable:{status:'not-created'}};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
 }
 const analytical={format:'opticsim-mirror-backed-slab-analytical-evidence-v1',
  originalInputSha256,result,native,originalJeeSolved:false};
 writeEvidence(resolve(out.directory,'analytical-result.json'),
  JSON.stringify(analytical,null,2)+'\n');
 const report={format:'opticsim-mirror-backed-slab-evidence-v1',
  status:result.status,originalInputSha256,result,native,
  originalJeeSolved:false,portable:{status:'not-created'}};
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:0,report,reportPath:out.report};
}
function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  process.stdout.write(JSON.stringify(mirrorBackedSlabCapabilities(),null,2)+'\n');return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])
  throw Error('Usage: node scripts/mirror-backed-slab-query.mjs capabilities | <input.json> --out test-artifacts/llm-authoring/<fresh>');
 const report=runMirrorBackedSlabEvidence({queryBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
 process.stdout.write(JSON.stringify({status:report.status,value:report.report.result?.value??null,
  native:'not-run',report:report.reportPath},null,2)+'\n');
 process.exitCode=report.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){
  console.error(JSON.stringify({status:'infrastructure-error',
   code:'MIRROR_BACKED_SLAB_CLI_INFRASTRUCTURE',message:String(e?.message)}));
  process.exitCode=1;
 }
}
