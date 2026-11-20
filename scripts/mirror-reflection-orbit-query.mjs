// J02 formal mirror reflection-group orbit: source-only structural or
// explicitly authored finite-depth geometry. No native rays, visible images,
// power, output detector, source brightness or real scene is invented.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {analyzeMirrorFormalOrbit,mirrorOrbitCapabilities}
 from '../src/mirror-reflection-orbit.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const usage='Usage: node scripts/mirror-reflection-orbit-query.mjs capabilities | <query.json> --out test-artifacts/llm-authoring/<fresh>';
export function runMirrorFormalOrbitEvidence({queryBytes,outputPath}){
 if(!queryBytes||queryBytes.length===0||queryBytes.length>1024*1024)
  throw Error('A nonempty bounded JSON query of at most 1 MB is required');
 const out=reserveAuthoringOutput(outputPath,root);
 if(!out)throw Error('A fresh allowed output directory is required');
 writeEvidence(out.input,queryBytes);
 const originalInputSha256=hash(queryBytes);
 const native={status:'not-run',observations:null,nativeImageDetected:false,
  actualVisibleImagesCertified:false};
 let result;
 try{result=analyzeMirrorFormalOrbit(JSON.parse(Buffer.from(queryBytes).toString('utf8')));}
 catch(e){
  const report={format:'opticsim-mirror-orbit-evidence-v1',
   status:'rejected',originalInputSha256,
   issues:[{code:e?.code??'INVALID_MIRROR_ORBIT_QUERY',message:String(e?.message)}],
   native,originalJeeImageCountCertified:false,portable:{status:'not-created'}};
  writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
  return {status:'rejected',exitCode:1,report,reportPath:out.report};
 }
 const analytical={format:'opticsim-mirror-orbit-analytical-evidence-v1',
  originalInputSha256,result,native,originalJeeImageCountCertified:false};
 writeEvidence(resolve(out.directory,'analytical-result.json'),
  JSON.stringify(analytical,null,2)+'\n');
 const report={format:'opticsim-mirror-orbit-evidence-v1',
  status:result.status,originalInputSha256,result,native,
  originalJeeImageCountCertified:false,portable:{status:'not-created'}};
 writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
 return {status:result.status,exitCode:0,report,reportPath:out.report};
}
function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='capabilities'){
  process.stdout.write(JSON.stringify(mirrorOrbitCapabilities(),null,2)+'\n');
  return;
 }
 if(args.length!==3||args[1]!=='--out'||!args[2])throw Error(usage);
 const r=runMirrorFormalOrbitEvidence({
  queryBytes:readFileSync(resolve(args[0])),outputPath:args[2]});
 process.stdout.write(JSON.stringify({status:r.status,
  value:r.report.result?.value??null,native:'not-run',report:r.reportPath},null,2)+'\n');
 process.exitCode=r.exitCode;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){
  console.error(JSON.stringify({status:'infrastructure-error',
   code:'MIRROR_ORBIT_CLI_INFRASTRUCTURE',message:String(e.message)}));
  process.exitCode=1;
 }
}
