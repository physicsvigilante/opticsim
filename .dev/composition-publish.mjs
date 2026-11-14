// TEMPORARY branch-only transport. Verify exact tested files, remove transport,
// then publish a non-force descendant to this draft PR only. Never merges.
import {readFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repo='physicsvigilante/opticsim',branch='feature/finite-dielectric-composition';
assert.equal(process.env.GITHUB_REPOSITORY,repo);
const head=process.env.EXPECTED_HEAD,token=process.env.GH_TOKEN;
assert.match(head||'',/^[a-f0-9]{40}$/);assert.ok(token);
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(git(['rev-parse','HEAD']),head);
const manifest=JSON.parse(readFileSync('.dev/composition-manifest.json','utf8'));
assert.equal(Object.keys(manifest).length,16);
const files=Object.entries(manifest).map(([path,expected])=>{
 const bytes=readFileSync(path),sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(sha,expected,path);return {path,sha,content:bytes.toString('utf8')};
});
const temporary=git(['ls-files','.dev']).split('\n').filter(Boolean);
assert.ok(temporary.length>0&&temporary.every(p=>p.startsWith('.dev/')));
const deleted=[...temporary,'.github/workflows/composition-bootstrap.yml','.github/workflows/composition-dev-transfer.yml'];
for(const path of deleted)rmSync(path,{force:true});
const allowed=new Set([...files.map(f=>f.path),...deleted]);
const changed=git(['diff','--name-only','HEAD']).split('\n').filter(Boolean);
assert.ok(changed.every(p=>allowed.has(p)),'Unintended tracked changes');
const untracked=git(['ls-files','--others','--exclude-standard']).split('\n').filter(Boolean);
assert.ok(untracked.every(p=>allowed.has(p)),'Unintended untracked source');
const api=async(path,method='GET',body)=>{
 const res=await fetch('https://api.github.com/repos/'+repo+'/'+path,{method,
  headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Error('GitHub '+method+' '+path+' failed '+res.status);
 return res.json();
};
assert.equal((await api('git/ref/heads/'+branch)).object.sha,head,'Draft branch changed');
const base=await api('git/commits/'+head),tree=[];
for(const file of files){const blob=await api('git/blobs','POST',{content:file.content,encoding:'utf-8'});assert.equal(blob.sha,file.sha);tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});}
for(const path of deleted)tree.push({path,mode:'100644',type:'blob',sha:null});
const newTree=await api('git/trees','POST',{base_tree:base.tree.sha,tree});
const commit=await api('git/commits','POST',{message:'Add verified bounded finite glass and external mirror composition; remove temporary development transport',tree:newTree.sha,parents:[head]});
assert.equal((await api('git/ref/heads/'+branch)).object.sha,head,'Draft branch changed before publication');
await api('git/refs/heads/'+branch,'PATCH',{sha:commit.sha,force:false});
console.log(JSON.stringify({branch,commit:commit.sha,tree:newTree.sha,files:files.length,temporaryTransportRemoved:true,merged:false}));
