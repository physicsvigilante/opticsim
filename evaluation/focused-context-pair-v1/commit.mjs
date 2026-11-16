// Offline paired-protocol precommit. Reference is read ONLY here and later
// in offline REVIEW; never by the model-capture module or its prompt builder.
import {writeFileSync,existsSync,mkdirSync,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON,requirePrivateInput} from '../heldout-authoring-v1/manifest.mjs';
import {makeExplorationCommitment,validateExplorationQuestions,
 validateExplorationReference} from '../heldout-exploration-v1/manifest.mjs';
export const PAIR_NOTE='Paired full/focused context eligibility: only supported revise/observe or negative; 2-12 even cases; external independent reviews and timestamped commitment required.';
export async function commitPair({questionsPath,referencePath,outPath}){
 const q=readJSON(requirePrivateInput(questionsPath)),r=readJSON(requirePrivateInput(referencePath));
 await validateExplorationQuestions(q.value);
 validateExplorationReference(r.value,q.value);
 if(q.value.cases.length<2||q.value.cases.length%2!==0)
  throw Error('Paired comparison requires an EVEN original 2–12 case list');
 if(r.value.cases.some(x=>x.classification==='supported'&&!['revise','observe'].includes(x.expectedAction)))
  throw Error('Unsupported paired comparison: supported structural tasks require the full context and cannot be graded against focused');
 const commit=await makeExplorationCommitment(q.value,r.value,q.bytes,r.bytes);
 commit.note=PAIR_NOTE;
 const path=requirePrivateInput(outPath),parent=dirname(path);
 if(!path.endsWith('.json')||existsSync(path))throw Error('Do not overwrite a private paired commitment');
 mkdirSync(parent,{recursive:true});
 if(lstatSync(parent).isSymbolicLink())throw Error('Unsafe private commitment directory');
 writeFileSync(path,JSON.stringify(commit,null,2)+'\n',{flag:'wx'});
 return {path,commitment:commit};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const a=process.argv.slice(2);
 if(a.length!==6||a[0]!=='--questions'||a[2]!=='--reference'||a[4]!=='--out'){
  console.error('Usage: node commit.mjs --questions <private.json> --reference <private-reference.json> --out <new-paired-commitment.json>');
  process.exitCode=1;
 }else commitPair({questionsPath:a[1],referencePath:a[3],outPath:a[5]})
  .then(x=>console.log(JSON.stringify({status:'offline-paired-commitment',ids:x.commitment.ids,
   questionsSha256:x.commitment.questionsSha256,referenceSha256:x.commitment.referenceSha256,
   note:'No model calls. Preserve independent external timestamp before inference.'})))
  .catch(e=>{console.error('Pair precommit failed: '+e.message);process.exitCode=1;});
}
