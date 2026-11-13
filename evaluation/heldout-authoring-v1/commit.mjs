// Offline checksum commitment, BEFORE any external model sees questions.
// Reference is read only by this offline command and by post-capture review.
import {writeFileSync,existsSync,mkdirSync,lstatSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON,requirePrivateInput,makeCommitment} from './manifest.mjs';
const parseArgs=args=>{
 if(args.length!==6||args[0]!=='--questions'||args[2]!=='--reference'||args[4]!=='--out')
  throw Error('Usage: node commit.mjs --questions test-artifacts/...json --reference test-artifacts/...json --out test-artifacts/...commitment.json');
 return {questions:args[1],reference:args[3],out:args[5]};
};
export function makeOfflineCommitment({questionsPath,referencePath,outPath}){
 const q=readJSON(requirePrivateInput(questionsPath));
 const r=readJSON(requirePrivateInput(referencePath));
 const result=makeCommitment(q.value,r.value,q.bytes,r.bytes);
 const file=requirePrivateInput(outPath),parent=dirname(file);
 if(!file.endsWith('.json')||existsSync(file))throw Error('Commitment JSON must not overwrite any existing file');
 mkdirSync(parent,{recursive:true});
 if(lstatSync(parent).isSymbolicLink())throw Error('Symlink commitment directory unsupported');
 writeFileSync(file,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return {file,commitment:result};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const x=parseArgs(process.argv.slice(2));
  const r=makeOfflineCommitment({questionsPath:x.questions,referencePath:x.reference,outPath:x.out});
  console.log(JSON.stringify({status:'committed',file:r.file,
    questionsSha256:r.commitment.questionsSha256,
    referenceSha256:r.commitment.referenceSha256,caseCount:r.commitment.numberOfCases,
    note:'No model or network call. Commit checksum separately before inference.'},null,2));
 }catch(e){console.error('Private reference commitment failed: '+e.message);process.exitCode=1;}
}
