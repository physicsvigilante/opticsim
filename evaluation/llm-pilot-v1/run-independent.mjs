// One-pass, explicit external-model runner. No API key or model invocation
// exists until the owner provides a private secret AND runs this command.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectFirstAttempts,makeChatTransport,sha256} from './independent-inference.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const here=fileURLToPath(new URL('.',import.meta.url));
const read=path=>readFileSync(path);
const asCount=(text,maximum,label)=>{
  if(!/^(?:0|[1-9][0-9]?)$/.test(text||''))
    throw Error(label+' must be a bounded nonnegative integer');
  const value=Number(text);
  if(value>maximum)throw Error(label+' exceeds its declared limit');
  return value;
};
async function main(){
  const env=process.env;
  // All requirements checked before the first model call; never echo secrets.
  const model=env.OPTICSIM_MODEL_ID;
  const apiKey=env.OPTICSIM_MODEL_API_KEY;
  const apiUrl=env.OPTICSIM_MODEL_API_URL||
    'https://api.openai.com/v1/chat/completions';
  const allowedOrigin=env.OPTICSIM_MODEL_ALLOWED_ORIGIN||
    'https://api.openai.com';
  const send=makeChatTransport({model,apiKey,url:apiUrl,allowedOrigin});
  const n=asCount(env.OPTICSIM_MAX_AUTHORING||'1',10,'Authoring case count');
  const m=asCount(env.OPTICSIM_MAX_CORPUS||'1',9,'Corpus case count');
  if(n+m===0)throw Error('At least one case must be selected');
  if(env.OPTICSIM_EXTERNAL_DATA_APPROVED!=='yes')
    throw Error('External model transfer requires explicit approval flag');
  const promptsBytes=read(resolve(here,'prompts.json'));
  const corpusBytes=read(resolve(here,'corpus-prompts.json'));
  const prompts=JSON.parse(promptsBytes),corpus=JSON.parse(corpusBytes);
  const zipPath=resolve(env.OPTICSIM_CORPUS_ZIP||resolve(root,'01_problems.zip'));
  const zip=m?read(zipPath):null;
  // No reference files are opened or imported by this process.
  const directory=resolve(env.OPTICSIM_RESULT_DIR||
    resolve(root,'test-artifacts/llm-evaluation/independent'));
  const allowed=resolve(root,'test-artifacts/llm-evaluation/independent');
  if(directory!==allowed&&!directory.startsWith(allowed+sep))
    throw Error('Evaluation output must remain inside ignored independent evidence area');
  for(const name of ['submission.json','first-attempt-trace.json','progress.json']){
    if(existsSync(resolve(directory,name)))
      throw Error('An existing evidence file blocks reruns; choose a fresh directory');
  }
  // Restrict all writes before any possibly billable external model requests.
  mkdirSync(directory,{recursive:true});
  const result=await collectFirstAttempts({
    prompts,corpus,archive:zip,maxAuthoring:n,maxCorpus:m,send,
    onAttempt:async(state)=>{
      writeFileSync(resolve(directory,'progress.json'),JSON.stringify({
        format:'opticsim-independent-partial-v1',modelRequested:model,
        firstAttemptOnly:true,referenceFilesRead:false,solutionImagesRead:false,
        ...state
      },null,2)+'\n');
    }
  });
  const context={
    protocol:result.trace.format,modelRequested:model,
    serviceOrigin:new URL(apiUrl).origin,
    promptManifestSha256:sha256(promptsBytes),
    corpusManifestSha256:sha256(corpusBytes),
    archiveSha256:m?sha256(zip):null,
    executionRevision:env.GITHUB_SHA||'local-unverified',
    runId:env.GITHUB_RUN_ID||null,
    firstAttemptOnly:true,
    referenceAnswersRead:false,solutionImagesRead:false,
    selectedCases:{authoring:n,corpus:m},
    note:'Actual external model responses are preserved, not simulated or repaired. Score separately.'
  };
  const files=[
    ['submission.json',result.submission],
    ['first-attempt-trace.json',{...context,...result.trace}]
  ];
  for(const [name,body] of files)
    writeFileSync(resolve(directory,name),JSON.stringify(body,null,2)+'\n',
      {flag:'wx'});
  console.log('Independent model responses captured: '+n+
    ' authored arrangements and '+m+' image classifications. Model: '+model+
    '. Evidence: '+directory+'. No repairs or reference-answer reads.');
  console.log('Next: node evaluation/llm-pilot-v1/score.mjs '+
    resolve(directory,'submission.json')+' --report '+
    resolve(directory,'score.json'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{
    console.error('Independent evaluation did not complete: '+e.message);
    process.exitCode=1;
  });
}
