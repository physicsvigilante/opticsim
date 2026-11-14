// Offline, reference-first SHA commitment. No model/provider calls.
import {writeFileSync,existsSync,mkdirSync,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON,requirePrivateInput} from '../heldout-authoring-v1/manifest.mjs';
import {makeExplorationCommitment} from './manifest.mjs';
export async function commitExploration({questionsPath,referencePath,outPath}){
 const q=readJSON(requirePrivateInput(questionsPath));
 const r=readJSON(requirePrivateInput(referencePath));
 const commitment=await makeExplorationCommitment(q.value,r.value,q.bytes,r.bytes);
 const path=requirePrivateInput(outPath),parent=dirname(path);
 if(!path.endsWith('.json')||existsSync(path))throw Error('Do not overwrite an existing private commitment');
 mkdirSync(parent,{recursive:true});
 if(lstatSync(parent).isSymbolicLink())throw Error('Unsafe private commitment directory');
 writeFileSync(path,JSON.stringify(commitment,null,2)+'\n',{flag:'wx'});
 return {path,commitment};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--questions'||a[2]!=='--reference'||a[4]!=='--out'){
  console.error('Usage: node commit.mjs --questions <private.json> --reference <private-reference.json> --out <new-commitment.json>');
  process.exitCode=1;
 }else commitExploration({questionsPath:a[1],referencePath:a[3],outPath:a[5]})
   .then(x=>console.log(JSON.stringify({status:'committed-offline',ids:x.commitment.ids,questionsSha256:x.commitment.questionsSha256,referenceSha256:x.commitment.referenceSha256,
    note:'No model calls; save an external timestamped record before inference.'})))
   .catch(e=>{console.error('Exploration commitment failed: '+e.message);process.exitCode=1;});
}
