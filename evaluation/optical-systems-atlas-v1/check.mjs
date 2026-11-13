// Read-only capability-discovery audit: no Solutions, model inference, or native runs.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readProblemPng} from '../llm-pilot-v1/independent-inference.mjs';
const here=fileURLToPath(new URL('./',import.meta.url));
const read=name=>JSON.parse(readFileSync(resolve(here,name),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const assert=(yes,reason)=>{if(!yes)throw Error('Atlas integrity: '+reason);};
const apparatus=['existing','partial','not-exposed'];
const observations=['registered','conditional','unregistered'];
export function checkAtlasMetadata({policy,selection,inventory,review}){
 assert(policy.format==='opticsim-jee-systems-atlas-policy-v1','policy version');
 assert(selection.format==='opticsim-jee-systems-atlas-selection-v1','selection version');
 assert(inventory.format==='opticsim-jee-systems-atlas-inventory-v1','inventory version');
 assert(review.format==='opticsim-optical-systems-atlas-review-v1','review version');
 assert(policy.source.sha256===selection.sourceSha256&&
   policy.source.sha256===inventory.sourceArchiveSha256&&
   policy.source.sha256===review.sourceArchiveSha256,'source hashes disagree');
 assert(policy.baselineMain===selection.baselineMain&&
   policy.baselineMain===review.currentEngineCommit,'engine baseline differs');
 assert(policy.solutionsRead===false&&review.sameAssistantDevelopment===true&&
   selection.selectedBeforeImageReading===true,'unsafe scope or independence claim');
 const chapters=Object.entries(policy.chapterCounts);
 assert(chapters.length===8&&chapters.reduce((s,x)=>s+x[1],0)===114,'archive chapter counts');
 assert(selection.cases.length===40&&review.cases.length===40,'40 reviewed questions');
 assert(inventory.inventory.length===114&&inventory.reviewedCount===40&&
   inventory.notReviewedCount===74,'full metadata inventory');
 const chosen=new Map();
 for(const [chapter,n] of chapters)for(let q=0;q<5;q++){
  const path='08_Ray_Optics_Explanations/'+chapter+'/Problems/'+
   String(Math.floor(q*(n-1)/4)+1).padStart(3,'0')+'.png';
  const id='A'+String(chosen.size+1).padStart(2,'0');
  chosen.set(path,id);
  const s=selection.cases[chosen.size-1];
  assert(s?.id===id&&s.chapter===chapter&&s.selectionRank===q&&
    s.problemPath===path,'frozen quantile choice '+id);
 }
 assert(chosen.size===40,'unique frozen selection');
 const actualPaths=[];
 for(const [chapter,n] of chapters)for(let i=1;i<=n;i++)
  actualPaths.push({chapter,path:'08_Ray_Optics_Explanations/'+chapter+
   '/Problems/'+String(i).padStart(3,'0')+'.png'});
 for(let i=0;i<114;i++){
  const expected=actualPaths[i],got=inventory.inventory[i];
  assert(got.path===expected.path&&got.chapter===expected.chapter&&
    got.reviewStatus===(chosen.has(got.path)?'reviewed':'not-reviewed')&&
    (!chosen.has(got.path)||got.atlasCaseId===chosen.get(got.path)),
    'index mismatch at member '+i);
 }
 const gaps=new Set(Object.keys(review.gapCatalog||{}));
 assert(gaps.size>=10&&gaps.size<=30,'gap catalogue missing');
 for(let i=0;i<40;i++){
  const s=selection.cases[i],r=review.cases[i];
  assert(r.id===s.id&&r.problemPath===s.problemPath&&
    /^[a-f0-9]{64}$/.test(r.imageSha256||''),'source PNG digest '+s.id);
  assert(typeof r.systemSummary==='string'&&r.systemSummary.length>15&&
    typeof r.questionObservable==='string'&&r.questionObservable.length>3&&
    typeof r.caveat==='string'&&r.caveat.length>20,'review narrative '+s.id);
  assert(apparatus.includes(r.currentApparatus)&&observations.includes(r.currentObservable)&&
    Array.isArray(r.objects)&&Array.isArray(r.candidateGaps)&&
    r.candidateGaps.every(g=>gaps.has(g)),'review scope tag '+s.id);
  assert(r.problemPath.includes('/Problems/')&&!r.problemPath.includes('/Solutions/')&&
    !Object.hasOwn(r,'computedAnswer')&&!Object.hasOwn(r,'originalQuestionText'),
    'no original solutions/answers copied');
 }
 const expected={selected:40,inventory:114,chapters:8,unreviewed:74,
  apparatus:Object.fromEntries(apparatus.map(v=>[v,review.cases.filter(r=>r.currentApparatus===v).length])),
  observable:Object.fromEntries(observations.map(v=>[v,review.cases.filter(r=>r.currentObservable===v).length])),
  gaps:Object.fromEntries([...gaps].map(v=>[v,review.cases.filter(r=>r.candidateGaps.includes(v)).length]))};
 assert(JSON.stringify(expected)===JSON.stringify(review.summary),'summary does not match cases');
 return expected;
}
export async function verifyAtlas({archive=null,problemsOnly=false}={}){
 const policy=read('policy.json'),selection=read('selection.json'),
  inventory=read('inventory.json'),review=read('review.json');
 const summary=checkAtlasMetadata({policy,selection,inventory,review});
 let verifiedImages=0,method='metadata-only';
 if(archive!==null){
  const source=readFileSync(resolve(archive));
  if(!problemsOnly)assert(sha(source)===policy.source.sha256,'original archive SHA mismatch');
  for(const c of review.cases){
   const png=readProblemPng(source,c.problemPath);
   assert(sha(png)===c.imageSha256,'selected image mismatch '+c.id);
   verifiedImages++;
  }
  method=problemsOnly?'problems-only-images-check-original-archive-not-reverified':
   'pinned-original-archive-and-images';
 }
 return {format:'opticsim-jee-atlas-verification-v1',status:'passed',
  verification:method,verifiedImages,summary,solutionsRead:false,modelCalls:0,nativeExecutions:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);
  if(args.length!==0&&(args.length!==2||
     !['--archive','--problems-only'].includes(args[0])))
   throw Error('Usage: node evaluation/optical-systems-atlas-v1/check.mjs [--archive original.zip | --problems-only filtered.zip]');
  console.log(JSON.stringify(await verifyAtlas({archive:args[1]??null,
   problemsOnly:args[0]==='--problems-only'}),null,2));
 }catch(e){console.error('Atlas verification failed: '+e.message);process.exitCode=1;}
}
