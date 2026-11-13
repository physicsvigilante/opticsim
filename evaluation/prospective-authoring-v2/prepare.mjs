// Select with ZIP central-directory metadata ONLY; extract selected PNGs
// only after selection.json and exposure-register.json have been committed.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {join,resolve,relative,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=resolve(root,'evaluation/prospective-authoring-v2');
const out=resolve(root,'test-artifacts/prospective-authoring-v2');
const hash=x=>createHash('sha256').update(x).digest('hex');
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const policy=load(resolve(dir,'policy.json'));
if(policy.format!=='opticsim-prospective-policy-v2'||policy.sections.length!==8)throw Error('Bad policy');
const zip=readFileSync(resolve(root,policy.archive.name));
if(hash(zip)!==policy.archive.sha256)throw Error('Archive SHA mismatch');
function names(b){
 let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 if(end<0||b.length>50*1024*1024)throw Error('ZIP EOCD/size invalid');
 const count=b.readUInt16LE(end+10);let p=b.readUInt32LE(end+16);
 if(!count||count>2000||p+b.readUInt32LE(end+12)>end)throw Error('ZIP directory invalid');
 const rows=[],seen=new Set();
 for(let i=0;i<count;i++){
  if(p+46>end||b.readUInt32LE(p)!==0x02014b50)throw Error('ZIP entry invalid');
  const n=b.readUInt16LE(p+28),e=b.readUInt16LE(p+30),c=b.readUInt16LE(p+32);
  if(p+46+n+e+c>end)throw Error('ZIP entry overflow');
  const path=b.subarray(p+46,p+46+n).toString('utf8');
  if(seen.has(path))throw Error('Duplicate ZIP member');
  seen.add(path);
  rows.push({path,size:b.readUInt32LE(p+24),compressed:b.readUInt32LE(p+20),
   method:b.readUInt16LE(p+10),flags:b.readUInt16LE(p+8)});
  p+=46+n+e+c;
 }
 return rows;
}
const members=names(zip).filter(x=>x.path.includes('/Problems/')&&x.path.endsWith('.png'));
const valid=x=>x.size>=24&&x.size<=policy.maxImageBytes&&x.compressed<=policy.maxImageBytes&&
 !(x.flags&1)&&(x.method===0||x.method===8);
function exposures(){
 const texts=[],skip=new Set(['.git','.github','vendor','dist','node_modules','test-artifacts']);
 function walk(d){
  for(const v of readdirSync(d,{withFileTypes:true})){
   if(skip.has(v.name))continue;
   const file=join(d,v.name),r=relative(root,file).split(sep).join('/');
   if(r.startsWith('evaluation/prospective-authoring-v2/'))continue;
   if(v.isDirectory())walk(file);
   else if(v.isFile()&&/\.(md|json|mjs|js|txt|yml|yaml)$/i.test(v.name)&&statSync(file).size<300000)
    texts.push([r,readFileSync(file,'utf8')]);
  }
 }
 walk(root);texts.sort((a,b)=>a[0].localeCompare(b[0]));
 const recordedPaths=members.map(x=>x.path).filter(p=>texts.some(t=>t[1].includes(p))).sort();
 return {format:'opticsim-exposure-register-v2',archiveSha256:hash(zip),
   recordedPaths,trackedTextFileCount:texts.length,
   sourceTextDigestSha256:hash(texts.map(t=>t[0]+' '+hash(t[1])).join('\n')),
   caveat:'Tracked full-path exposure only, not a guarantee of truly unseen content.'};
}
function selection(e){
 if(e.format!=='opticsim-exposure-register-v2'||e.archiveSha256!==hash(zip)||!Array.isArray(e.recordedPaths))
  throw Error('Bad frozen exposure register');
 const blocked=new Set(e.recordedPaths);
 const cases=policy.sections.map(section=>{
  const pool=members.filter(x=>x.path.startsWith(section.prefix)&&
    /^\d{3}\.png$/.test(x.path.slice(section.prefix.length)));
  const eligible=pool.filter(valid),candidates=eligible.filter(x=>!blocked.has(x.path));
  candidates.sort((a,b)=>hash(policy.seed+'|'+a.path).localeCompare(hash(policy.seed+'|'+b.path))||a.path.localeCompare(b.path));
  if(!candidates.length)throw Error('No eligible candidate for '+section.id);
  const chosen=candidates[0];
  return {id:section.id,problemPath:chosen.path,uncompressedBytes:chosen.size,
   sectionCount:pool.length,eligibleCount:eligible.length,priorMentionCount:eligible.length-candidates.length,
   rankSha256:hash(policy.seed+'|'+chosen.path)};
 });
 return {format:'opticsim-prospective-selection-v2',frozenEngineCommit:policy.frozenEngineCommit,
  archiveSha256:hash(zip),policySha256:hash(readFileSync(resolve(dir,'policy.json'))),
  exposureRegisterSha256:hash(JSON.stringify(e,null,2)+'\n'),solutionsRead:false,
  imagesViewedBeforeSelection:false,automaticRepairs:0,externalModelCalls:0,
  claim:'same-assistant prospective development only, not independently certified',cases};
}
async function main(){
 const mode=process.argv[2];
 if(!['select','extract'].includes(mode)||process.argv.length!==3)throw Error('Use select or extract');
 mkdirSync(out,{recursive:true});
 if(mode==='select'){
  const e=exposures(),s=selection(e);save(resolve(out,'exposure-register.json'),e);
  save(resolve(out,'selection.json'),s);
  console.log('Selected '+s.cases.length+' filenames only; no PNG images, Solutions or answers read. Commit both files before extract.');return;
 }
 const e=load(resolve(dir,'exposure-register.json')),s=load(resolve(dir,'selection.json'));
 if(JSON.stringify(s)!==JSON.stringify(selection(e))||
    hash(readFileSync(resolve(dir,'exposure-register.json')))!==s.exposureRegisterSha256)
  throw Error('Committed selection/exposure/policy do not match');
 const {readProblemPng}=await import('../llm-pilot-v1/independent-inference.mjs');
 const imageDir=resolve(out,'images');mkdirSync(imageDir,{recursive:true});
 const result=[];
 for(const c of s.cases){
  if(!c.problemPath.includes('/Problems/')||c.problemPath.includes('/Solutions/'))throw Error('Invalid candidate path');
  const png=readProblemPng(zip,c.problemPath);
  if(png.length!==c.uncompressedBytes)throw Error('Selected PNG size mismatch');
  writeFileSync(resolve(imageDir,c.id+'.png'),png,{flag:'wx'});
  result.push({id:c.id,problemPath:c.problemPath,pngSha256:hash(png),bytes:png.length});
 }
 save(resolve(out,'image-manifest.json'),{
  format:'opticsim-prospective-image-manifest-v2',selectionSha256:hash(readFileSync(resolve(dir,'selection.json'))),
  solutionsRead:false,externalModelCalls:0,records:result});
 console.log('Extracted '+result.length+' frozen Problems images; no Solutions/model calls.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
