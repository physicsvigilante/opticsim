// Local deterministic runner; no model API, shell commands from inputs or retries.
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {parseQualifiedBundle} from '../src/qualification.js';
import {serializeSave} from '../src/contract.js';
import {validateSweep,runParameterSweep} from '../src/parameter-sweep.js';
import {evaluateDocument} from './author-scene.mjs';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
import {sweepHTML} from './sweep-report.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function read(path){const bytes=readFileSync(path);if(bytes.length>1024*1024)throw Error('Input exceeds 1 MB');return bytes;}
let output;
async function main(){
  const [baselinePath,specPath,flag,out,...rest]=process.argv.slice(2);
  if(!baselinePath||!specPath||flag!=='--out'||!out||rest.length)throw Error('Usage: node scripts/run-parameter-sweep.mjs <qualified-scene.json> <sweep.json> --out test-artifacts/llm-authoring/<fresh-directory>');
  const baselineBytes=read(baselinePath),specBytes=read(specPath);
  output=reserveAuthoringOutput(out,root);
  writeEvidence(output.input,baselineBytes);
  writeEvidence(resolve(output.directory,'sweep.json'),specBytes);
  const bundle=await parseQualifiedBundle(baselineBytes.toString('utf8')),spec=JSON.parse(specBytes.toString('utf8'));
  validateSweep(spec,bundle); // Reject malformed or over-budget experiments before building/running.
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
  const report=await runParameterSweep(bundle,spec,{
    execute:doc=>evaluateDocument(doc,core),
    onSample:async(sample,{bundle:qualified,execution})=>{
      const name='sample-'+String(sample.index+1).padStart(3,'0'),dir=resolve(output.directory,name);
      mkdirSync(dir);
      writeEvidence(resolve(dir,'changes.json'),JSON.stringify({expectedSha256:bundle.sceneSha256,...sample.changes},null,2)+'\n');
      if(qualified){
        writeEvidence(resolve(dir,'qualified-scene.json'),JSON.stringify(qualified,null,2)+'\n');
        writeEvidence(resolve(dir,'scene.ray-optics-2d.json'),serializeSave(qualified.scene));
      }
      writeEvidence(resolve(dir,'report.json'),JSON.stringify({sample,execution:execution?.summary||null},null,2)+'\n');
    }
  });
  report.inputSha256=hash(baselineBytes);report.specificationSha256=hash(specBytes);
  writeEvidence(output.report,JSON.stringify(report,null,2)+'\n');
  writeEvidence(resolve(output.directory,'comparison.html'),sweepHTML(report));
  console.log(JSON.stringify({status:report.status,planned:report.plannedSamples,completed:report.completedSamples,
    failed:report.failedSamples,report:output.report,comparison:resolve(output.directory,'comparison.html')},null,2));
  if(report.failedSamples)process.exitCode=2;
}
main().catch(error=>{
  const failure={status:'failed',message:error.message,partialEvidenceMayExist:true};
  if(output)try{writeEvidence(resolve(output.directory,'failure.json'),JSON.stringify(failure,null,2)+'\n');}catch{}
  console.error(JSON.stringify(failure));process.exitCode=1;
});
