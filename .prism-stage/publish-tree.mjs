// Temporary immutable Git-object staging. Never creates or moves a branch ref.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const m=JSON.parse(readFileSync('test-artifacts/prism-stage/manifest.json'));
assert.equal(process.env.GITHUB_REPOSITORY,'physicsvigilante/opticsim');
assert.ok(process.env.GITHUB_TOKEN);
const blob=x=>{const b=Buffer.from(x);return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');};
async function post(path,body){
 const r=await fetch('https://api.github.com/repos/physicsvigilante/opticsim/git/'+path,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw Error('Git object staging HTTP '+r.status+' for '+path);
 return r.json();
}
const tree=[];
for(const f of m.files){
 const content=readFileSync(f.path,'utf8');assert.equal(blob(content),f.blob,'Tested bytes changed: '+f.path);
 const saved=await post('blobs',{content,encoding:'utf-8'});assert.equal(saved.sha,f.blob);
 tree.push({path:f.path,mode:'100644',type:'blob',sha:saved.sha});
}
for(const path of m.deletes)tree.push({path,mode:'100644',type:'blob',sha:null});
const result=await post('trees',{base_tree:m.baseTree,tree});
assert.equal(result.sha,m.expectedTree,'Remote tree differs from locally tested source');
writeFileSync('test-artifacts/prism-stage/staged-tree.json',JSON.stringify({format:'opticsim-tested-source-tree-v1',stagingHead:process.env.GITHUB_SHA,testedTree:result.sha,baseTree:m.baseTree,files:m.files,refUpdated:false,temporaryHelpersInFinalTree:false},null,2)+'\n',{flag:'wx'});
console.log('Exact tested tree staged: '+result.sha+'. No ref updated.');
