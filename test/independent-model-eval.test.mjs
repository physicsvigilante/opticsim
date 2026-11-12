import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  protocolVersion,readProblemPng,authoringMessages,scopeMessages,
  collectFirstAttempts,checkedEndpoint,makeChatTransport,sha256
} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const png=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
const entry='14_Geometrical_Optics_Part1/01_Reflection_Plane_Mirror/Problems/sample.png';
function zipWithOneImage(name=entry,bytes=png){
  const filename=Buffer.from(name,'utf8');
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);
  local.writeUInt16LE(20,4);
  local.writeUInt32LE(bytes.length,18);
  local.writeUInt32LE(bytes.length,22);
  local.writeUInt16LE(filename.length,26);
  const central=Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50,0);
  central.writeUInt16LE(20,4);
  central.writeUInt16LE(20,6);
  central.writeUInt32LE(bytes.length,20);
  central.writeUInt32LE(bytes.length,24);
  central.writeUInt16LE(filename.length,28);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(1,8);
  end.writeUInt16LE(1,10);
  end.writeUInt32LE(central.length+filename.length,12);
  end.writeUInt32LE(local.length+filename.length+bytes.length,16);
  return Buffer.concat([local,filename,bytes,central,filename,end]);
}
const prompt={id:'C01',prompt:'One point source S1 at (-10,0) cm, brightness 0.08, full-circle.'};
const corpus={archive:{sha256:null},cases:[{id:'R01',problemPath:entry}]};
test('original Problem PNG is read without extraction or Solutions',()=>{
  const zip=zipWithOneImage();
  assert.deepEqual(readProblemPng(zip,entry),png);
  for(const unsafe of [entry.replace('/Problems/','/Solutions/'),
    '../'+entry,entry.replace('/Problems/','/Problems/../Solutions/'),'/'+entry])
    assert.throws(()=>readProblemPng(zip,unsafe),/Only exact/);
  assert.throws(()=>readProblemPng(zipWithOneImage(
    entry.replace('/Problems/','/Solutions/')),entry),/missing from pinned ZIP/);
  const corrupted=Buffer.from(zip);corrupted[0]=0;
  assert.throws(()=>readProblemPng(corrupted,entry),/Corrupt local ZIP header/);
});
test('messages expose live capabilities without reference answers',()=>{
  const author=authoringMessages(prompt);
  assert.equal(author[0].role,'system');
  assert.ok(author[0].content.includes('general-component-tracing'));
  assert.ok(author[0].content.includes('point-source'));
  assert.ok(!JSON.stringify(author).includes('authoring-reference.json'));
  assert.ok(!JSON.stringify(author).includes('/Solutions/'));
  const scope=scopeMessages({problemPath:entry},png);
  assert.equal(scope[1].content[1].type,'image_url');
  assert.ok(scope[1].content[1].image_url.url.startsWith('data:image/png;base64,'));
  assert.ok(!JSON.stringify(scope).includes('corpus-reference.json'));
  assert.ok(!JSON.stringify(scope).includes('/Solutions/'));
});
test('exactly one mock reply per case is preserved without scoring or repair',async()=>{
  const zip=zipWithOneImage(),used={...corpus,archive:{sha256:sha256(zip)}};
  const calls=[],progress=[];
  const mock=async(messages,tag)=>{
    calls.push({tag,messages});
    return {content:tag.startsWith('authoring')?
      JSON.stringify({request:{lengthUnit:'cm',components:[
        {id:'S1',type:'point-source',parameters:{x:-10,y:0,brightness:.08},
          emission:{mode:'full-circle'}}]}}):
      JSON.stringify({scope:'illustration-only',
        reason:'Native reflection is traceable, but inverse answers need external analysis.'}),
      model:'independent-vision-model',usage:{prompt_tokens:20,completion_tokens:30}};
  };
  const r=await collectFirstAttempts({
    prompts:{cases:[prompt]},corpus:used,archive:zip,
    maxAuthoring:1,maxCorpus:1,send:mock,
    onAttempt:async(state)=>progress.push(state)
  });
  assert.equal(calls.length,2);
  assert.equal(progress.length,2);
  assert.equal(progress[0].attempts.length,1);
  assert.equal(progress[1].attempts.length,2);
  assert.deepEqual(calls.map(x=>x.tag),['authoring:C01','scope:R01']);
  assert.equal(r.submission.authoring[0].request.components.length,1);
  assert.equal(r.submission.scope[0].scope,'illustration-only');
  assert.equal(r.trace.format,protocolVersion);
  assert.equal(r.trace.automatedRepairAttempts,0);
  assert.equal(r.trace.referenceFilesRead,false);
  assert.equal(r.trace.solutionImagesRead,false);
  assert.equal(r.trace.attempts.length,2);
  assert.ok(r.trace.attempts.every(x=>x.actualModel==='independent-vision-model'));
  assert.equal(r.trace.attempts[1].imageSha256,sha256(png));
  assert.ok(r.trace.attempts.every(x=>x.outputSha256===sha256(x.rawOutput)));
});
test('invalid JSON is recorded as an unsuccessful first attempt without retries',async()=>{
  let calls=0;
  const r=await collectFirstAttempts({
    prompts:{cases:[prompt]},corpus:{cases:[]},maxAuthoring:1,maxCorpus:0,
    send:async()=>{calls++;return {content:'not-json'};}
  });
  assert.equal(calls,1);
  assert.equal(r.submission.authoring[0].error,'NON_JSON_FIRST_RESPONSE');
  assert.equal(r.trace.attempts[0].rawOutput,'not-json');
  const wrong=await collectFirstAttempts({
    prompts:{cases:[]},corpus:{...corpus,archive:{sha256:sha256(zipWithOneImage())}},
    archive:zipWithOneImage(),maxAuthoring:0,maxCorpus:1,
    send:async()=>({content:'{"scope":"unsupported","reason":"short"}'})
  });
  assert.equal(wrong.submission.scope[0].error,'INVALID_SCOPE_FIRST_RESPONSE');
});
test('archive checksum and call count budgets reject before any model use',async()=>{
  let calls=0;
  await assert.rejects(collectFirstAttempts({
    prompts:{cases:[prompt]},corpus:{...corpus,archive:{sha256:'0'.repeat(64)}},
    archive:zipWithOneImage(),maxAuthoring:1,maxCorpus:1,
    send:async()=>{calls++;return {content:'{}'};}
  }),/SHA-256/);
  assert.equal(calls,0);
  await assert.rejects(collectFirstAttempts({
    prompts:{cases:[prompt]},corpus,maxAuthoring:2,maxCorpus:0,
    send:async()=>{calls++;}
  }),/bounded case counts/);
  assert.equal(calls,0);
});
test('model URL cannot redirect auth to another origin',async()=>{
  assert.equal(checkedEndpoint('https://api.openai.com/v1/chat/completions',
    'https://api.openai.com'),'https://api.openai.com/v1/chat/completions');
  for(const url of ['http://api.openai.com/v1/chat/completions',
    'https://api.openai.com.evil.com/v1/chat/completions',
    'https://test:secret@api.openai.com/v1/chat/completions',
    'https://another-provider.example/v1/chat/completions'])
    assert.throws(()=>checkedEndpoint(url,'https://api.openai.com'));
  const key='PRIVATE-KEY-DO-NOT-LOG',requests=[];
  const send=makeChatTransport({
    apiKey:key,model:'vision-model',
    url:'https://api.openai.com/v1/chat/completions',
    allowedOrigin:'https://api.openai.com',
    fetchImpl:async(url,opts)=>{
      requests.push({url,opts});
      return {ok:true,status:200,text:async()=>JSON.stringify({
        model:'vision-model',choices:[{message:{content:
          '{"scope":"unsupported","reason":"This experiment cannot be traced exactly."}'}}],
        usage:{prompt_tokens:5,completion_tokens:9,total_tokens:14}})};
    }
  });
  const result=await send(authoringMessages(prompt),'authoring:C01');
  assert.equal(result.model,'vision-model');
  assert.equal(requests.length,1);
  assert.equal(requests[0].opts.redirect,'error');
  assert.equal(requests[0].opts.headers.Authorization,'Bearer '+key);
  assert.ok(!requests[0].opts.body.includes(key));
  assert.equal(JSON.parse(requests[0].opts.body).model,'vision-model');
  assert.equal(JSON.parse(requests[0].opts.body).response_format.type,'json_object');
});
test('external model workflow is manual-only, main-gated and secret-safe',()=>{
  const wf=readFileSync(new URL('../.github/workflows/opticsim-independent-eval.yml',import.meta.url),'utf8');
  assert.match(wf,/\n  workflow_dispatch:/);
  assert.doesNotMatch(wf,/\n  pull_request:/);
  assert.doesNotMatch(wf,/\n  push:/);
  assert.match(wf,/github\.ref == 'refs\/heads\/main'/);
  assert.match(wf,/external_transfer_approved == 'approved'/);
  assert.match(wf,/secrets\.OPTICSIM_MODEL_API_KEY/);
  assert.match(wf,/actions\/upload-artifact@v4/);
});
