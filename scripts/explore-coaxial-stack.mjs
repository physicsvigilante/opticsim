// Offline deterministic CLI for composable coaxial paraxial stack exploration.
// Pure JSON file input -> stdout JSON; no network calls, no silent input writes,
// and no native PhyDemo ray-trace execution.
import {readFileSync} from 'node:fs';
import {COAXIAL_STACK_QUERY} from '../src/coaxial-paraxial-stack.js';
import {
  coaxialStackExplorationCapabilities,
  coaxialStackHash,
  compareCoaxialStackResults,
  createCoaxialStackPackage,
  plotCoaxialStackSweep,
  reviseCoaxialStack,
  reviseCoaxialStackStructure,
  runCoaxialStackSweep,
  verifyCoaxialStackPackage
} from '../src/coaxial-stack-exploration.js';

const MAX_BYTES=1024*1024;
const USAGE=[
  'Usage: node scripts/explore-coaxial-stack.mjs <command> [args...]',
  '  capabilities',
  '  hash <facts.json>',
  '  package <facts.json> [metadata.json]',
  '  verify <package.json>',
  '  revise <facts-or-package.json> <revision.json>',
  '  structure <facts-or-package.json> <structure-revision.json>',
  '  sweep <facts-or-package.json> <sweep.json>',
  '  compare <baseline.json> <variant.json> <query-kind>'
].join('\n');

function readJson(path){
  const bytes=readFileSync(path);
  if(bytes.length>MAX_BYTES)throw Object.assign(new Error('Input file exceeds 1 MB limit: '+path),{code:'INPUT_TOO_LARGE'});
  return JSON.parse(bytes.toString('utf8'));
}

async function main(){
  const [cmd,...args]=process.argv.slice(2);
  let output;
  if(cmd==='capabilities'&&args.length===0){
    output=coaxialStackExplorationCapabilities();
  }else if(cmd==='hash'&&args.length===1){
    const facts=readJson(args[0]);
    output={sha256:await coaxialStackHash(facts),nativeObservation:false,nativeImageDetected:false};
  }else if(cmd==='package'&&(args.length===1||args.length===2)){
    const facts=readJson(args[0]);
    const meta=args.length===2?readJson(args[1]):{};
    output=await createCoaxialStackPackage(facts,meta);
  }else if(cmd==='verify'&&args.length===1){
    const pkg=await verifyCoaxialStackPackage(readJson(args[0]));
    output={valid:true,baselineSha256:pkg.baselineSha256,currentSha256:pkg.currentSha256,
      integritySha256:pkg.integritySha256,editCount:pkg.edits.length,retiredIds:pkg.retiredIds,
      nativeObservation:false,nativeImageDetected:false};
  }else if(cmd==='revise'&&args.length===2){
    output=await reviseCoaxialStack(readJson(args[0]),readJson(args[1]));
  }else if(cmd==='structure'&&args.length===2){
    output=await reviseCoaxialStackStructure(readJson(args[0]),readJson(args[1]));
  }else if(cmd==='sweep'&&args.length===2){
    const report=await runCoaxialStackSweep(readJson(args[0]),readJson(args[1]));
    output=report.specification.plot?{...report,plotSeries:plotCoaxialStackSweep(report)}:report;
  }else if(cmd==='compare'&&args.length===3){
    output=await compareCoaxialStackResults(readJson(args[0]),readJson(args[1]),{format:COAXIAL_STACK_QUERY,kind:args[2]});
  }else{
    throw Object.assign(new Error(USAGE),{code:'INVALID_CLI_USAGE'});
  }
  process.stdout.write(JSON.stringify(output,null,2)+'\n');
}

main().catch(err=>{
  process.stderr.write(JSON.stringify({status:'error',code:err.code||'EXPLORATION_ERROR',message:err.message})+'\n');
  process.exitCode=1;
});
