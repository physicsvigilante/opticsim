// Offline deterministic CLI for the Paraxial Stack <-> Native v37 Witness Bridge.
// Reuses dist/test-core.cjs (pinned PhyDemo); no network calls or silent writes.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  buildCoaxialStackNativeWitness,
  coaxialStackNativeWitnessCapabilities,
  runCoaxialStackNativeWitness
} from '../src/coaxial-stack-native-witness.js';
import {evaluateDocument} from './author-scene.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const MAX_BYTES=1024*1024;
const USAGE=[
  'Usage: node scripts/witness-coaxial-stack.mjs <command> [args...]',
  '  capabilities',
  '  plan <stack-or-package.json> <witness-spec.json>',
  '  run <stack-or-package.json> <witness-spec.json>'
].join('\n');

function readJson(path){
  const bytes=readFileSync(path);
  if(bytes.length>MAX_BYTES)throw Object.assign(new Error('Input file exceeds 1 MB limit: '+path),{code:'INPUT_TOO_LARGE'});
  return JSON.parse(bytes.toString('utf8'));
}

function loadCore(){
  execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],{cwd:root,stdio:['ignore','pipe','pipe']});
  return createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
}

async function main(){
  const [cmd,...args]=process.argv.slice(2);
  let output;
  if(cmd==='capabilities'&&args.length===0){
    output=coaxialStackNativeWitnessCapabilities();
  }else if(cmd==='plan'&&args.length===2){
    output=await buildCoaxialStackNativeWitness(readJson(args[0]),readJson(args[1]));
  }else if(cmd==='run'&&args.length===2){
    const core=loadCore();
    output=await runCoaxialStackNativeWitness(readJson(args[0]),readJson(args[1]),{
      execute:(doc,requests)=>evaluateDocument(doc,core,requests)
    });
  }else{
    throw Object.assign(new Error(USAGE),{code:'INVALID_CLI_USAGE'});
  }
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}

main().catch(err=>{
  process.stderr.write(JSON.stringify({status:'error',code:err.code||'WITNESS_ERROR',message:err.message})+'\n');
  process.exitCode=1;
});
