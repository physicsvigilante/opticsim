// Temporary CI helper: upload tested source as an UNREFERENCED Git tree only.
// The connector, not this workflow, performs the reviewed commit/ref update.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(process.env.GITHUB_REPOSITORY,'physicsvigilante/opticsim');
assert.equal(process.env.GITHUB_REF,'refs/heads/feature/circular-dielectric');
const parent=git('rev-parse','HEAD');assert.equal(parent,process.env.GITHUB_SHA);
unlinkSync('.circle-stage.mjs');
git('add','-A');
// Explicitly prove that pinned physics and sealed first attempts did not change.
git('diff','--cached','--exit-code','HEAD','--','upstream-pin.json','evaluation','vendor','package.json','scripts/build.mjs');
const names=git('diff','--cached','--name-only','HEAD').split('\n').filter(Boolean);
assert.ok(names.every(p=>/^src\/|^public\/|^scenes\/|^scripts\/|^test\/|^docs\/|^examples\/|^\.github\/workflows\/|^\.circle-(build|stage)\.mjs$|^(README|AGENTS)\.md$/.test(p)));
const deleted=new Set(git('diff','--cached','--name-only','--diff-filter=D','HEAD').split('\n'));
const entries=names.map(path=>deleted.has(path)?{path,mode:'100644',type:'blob',sha:null}:
 {path,mode:'100644',type:'blob',content:readFileSync(path,'utf8')});
const res=await fetch('https://api.github.com/repos/physicsvigilante/opticsim/git/trees',{
 method:'POST',redirect:'error',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GH_TOKEN,'Content-Type':'application/json'},
 body:JSON.stringify({base_tree:git('rev-parse','HEAD^{tree}'),tree:entries})});
if(!res.ok)throw Error('Git tree staging failed: HTTP '+res.status);
const result=await res.json();assert.match(result.sha,/^[a-f0-9]{40}$/);
const localTree=git('write-tree');assert.equal(result.sha,localTree,'Remote tree must equal exact tested local source tree');
mkdirSync('test-artifacts/ci-circle-integration',{recursive:true});
writeFileSync('test-artifacts/ci-circle-integration/staged-tree.json',JSON.stringify({parent,tree:result.sha,refUpdated:false,paths:names},null,2)+'\n');
console.log('TESTED_UNREFERENCED_TREE '+JSON.stringify({parent,tree:result.sha,refUpdated:false}));
