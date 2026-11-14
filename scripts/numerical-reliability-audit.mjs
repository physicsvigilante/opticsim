// Reproducible, bounded comparison of pinned native numerical modes.
// Not a substitute for the sealed original requests, a new physical model,
// a new source, an inverse solver or a canonical qualified execution.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareScene} from '../src/authoring.js';
import {serializeSave} from '../src/contract.js';
import {nativeNumericalReplay} from '../src/numerical-reliability.js';
import {evaluateObservables} from '../src/observables.js';
import {reserveAuthoringOutput,writeEvidence} from './authoring-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const originalPath=resolve(root,'evaluation/original-refraction-pair-v1/first-attempt.json');
const data=readFileSync(originalPath),original=JSON.parse(data);
const gitBlob=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
if(gitBlob!=='6507989a0074b68ac0e465c0982335e88fe4767f')throw Error('Sealed original inputs changed');
const out=reserveAuthoringOutput(process.argv[2]||
  'test-artifacts/llm-authoring/numerical-reliability',root);
if(!out)throw Error('An explicit safe evidence destination is required');
writeEvidence(out.input,data);
const records=[];
async function probe(id,name,request,requests){
  const canonical=prepareScene(request).document;
  for(const mode of ['default','linear']){
    const result=nativeNumericalReplay(canonical,core,mode);
    const summary={
      canonicalSha256:hash(serializeSave(canonical)),
      native:{status:result.status,warnings:result.diagnostic.warnings,
        errors:result.diagnostic.errors,truncation:result.diagnostic.truncation,
        undefinedBehavior:result.diagnostic.undefinedBehavior,
        processed:result.diagnostic.processed},
      executionPassed:result.complete,
      observations:result.observations
    };
    const requestedResults=await evaluateObservables(canonical,requests,summary);
    const record={id,name,mode,nativeColorMode:result.nativeSceneColorMode,
      threshold:result.nativeWeakBranchThreshold,status:result.status,complete:result.complete,
      truncatedBrightness:result.diagnostic.truncation,
      processedRaySegments:result.diagnostic.processed,
      // Labels matter: partial native events are NOT accepted observables.
      firstEvents:Object.fromEntries(Object.entries(result.diagnostic.interfacesById||{})
        .map(([id,m])=>[id,m.first])),
      interfaceCounters:Object.fromEntries(Object.entries(result.diagnostic.interfacesById||{})
        .map(([id,m])=>[id,{interactions:m.interactions,reflected:m.reflected,
          transmitted:m.transmitted,invalidObservations:m.invalidObservations}])),
      requestedResults,interactionTrace:result.diagnostic.interactionTrace,
      numericalFindings:result.numericalFindings,
      canonicalSha256:summary.canonicalSha256,
      // Unavailable requests have no value, but do not determine native completion.
      incompleteResultsWithheld:!result.complete&&requestedResults.results.every(r=>
        ['suppressed','unavailable'].includes(r.status)&&r.value===null)};
    records.push(record);
    writeEvidence(resolve(out.directory,name+'-'+mode+'.json'),JSON.stringify(record,null,2)+'\n');
  }
}
execFileSync(process.execPath,[resolve(root,'scripts/build.mjs'),'--test'],
  {cwd:root,stdio:['ignore','pipe','pipe']});
const core=createRequire(import.meta.url)(resolve(root,'dist/test-core.cjs'));
const b05=original.cases.find(c=>c.id==='B05'),b06=original.cases.find(c=>c.id==='B06');
await probe('B06','original-full-fresnel',b06.request,b06.observables);
const split=structuredClone(b06.request);
for(const c of split.components)if(c.type==='planar-interface'&&c.id!=='I12')c.parameters.partialReflection=false;
await probe('B06','essential-reflection-only',split,b06.observables);
const initialAngle=Math.asin(1.3/1.6)*180/Math.PI;
const critical=structuredClone(b05.request);
for(const c of critical.components)if(c.type==='planar-interface')c.parameters.partialReflection=false;
for(const [name,delta] of [['near-below',-0.001],['exact-derived',0],['near-above',0.001]]){
 const candidate=structuredClone(critical);
 candidate.components[0].emission.directionDeg=90-initialAngle+delta;
 await probe('B05',name,candidate,b05.observables);
}
const report={
  format:'opticsim-numerical-reliability-audit-v1',
  originalInputBlob:gitBlob,originalSha256:hash(data),upstreamCommit:core.UPSTREAM||'811f508d2b070898c241a568b0c167dcb8645251',
  source:'existing sealed B05/B06 questions; prepared numerical probes are not first attempts',
  policy:'Only supported native Scene.colorMode is varied. Modes affect weak-ray retention and visualization. No source, ray, native code, intensity, threshold constant, physical index or numerical budget is silently changed.',
  originalRequestsWereNotRunAsNewFirstAttempts:true,
  interpretation:'not-assessed-by-engine',
  records
};
writeEvidence(out.report,JSON.stringify(report,null,2)+'\n');
const summarized=records.map(x=>({id:x.id,name:x.name,mode:x.mode,status:x.status,
  truncated:x.truncatedBrightness,
  I12:x.interfaceCounters.I12||null,I1A:x.interfaceCounters.I1A||null,
  I23:x.interfaceCounters.I23||null,complete:x.complete}));
console.log(JSON.stringify({status:'diagnostic-recorded',sourceHash:report.originalSha256,
  output:out.directory,records:summarized},null,2));
