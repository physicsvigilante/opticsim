// Package a deployable, self-contained static demo from the existing production
// build. Never upload the repository, vendor checkout, test-core.cjs, caches or
// any unreviewed dist files. All deployment artifacts stay ignored in this repo.
import assert from 'node:assert/strict';
import {cpSync, copyFileSync, existsSync, mkdirSync, readFileSync,
  readdirSync, rmSync, writeFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../src/contract.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'dist');
const site=resolve(root,'test-artifacts/demo-site');
const required=['app.js','index.html','style.css','scenes','licenses'];
for(const name of required)assert.ok(existsSync(resolve(dist,name)),'Missing built '+name);
rmSync(site,{recursive:true,force:true});
mkdirSync(site,{recursive:true});
for(const name of ['app.js','index.html','style.css'])
  copyFileSync(resolve(dist,name),resolve(site,name));
for(const name of ['scenes','licenses'])
  cpSync(resolve(dist,name),resolve(site,name),{recursive:true,errorOnExist:true});
writeFileSync(resolve(site,'.nojekyll'),'');

const html=readFileSync(resolve(site,'index.html'),'utf8');
assert.match(html,/<meta http-equiv="Content-Security-Policy"/);
assert.match(html,/script-src 'self'/);
assert.match(html,/connect-src 'self'/);
assert.match(html,/<script src="app.js" defer><\/script>/);
assert.match(html,/<link rel="stylesheet" href="style.css">/);
assert.match(html,/id="example-link"/);
assert.ok(statSync(resolve(site,'app.js')).size>100000,'Missing native browser bundle');
for(const name of ['phydemo/LICENSE','phydemo/CITATION.md','INDEX.txt'])
  assert.ok(statSync(resolve(site,'licenses',name)).isFile(),'Missing notice '+name);

// Every option in the shareable examples menu is an actual bundled, strict
// scene. Arbitrary ?scene= strings never become fetch paths in app.js.
const choices=html.match(/<select id="examples">([\s\S]*?)<\/select>/);
assert.ok(choices,'Missing example selector');
const names=[...choices[1].matchAll(/<option value="([^"]+)"/g)]
  .map(match=>match[1]).filter(Boolean);
assert.ok(names.length>=16,'Missing existing examples');
assert.equal(new Set(names).size,names.length,'Duplicated example slugs');
for(const name of names){
  assert.match(name,/^[a-z0-9-]+$/,'Unsafe scene identifier');
  const path=resolve(site,'scenes',name+'.json');
  const doc=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(validate(doc),doc,'Invalid scene '+name);
}
const rootItems=readdirSync(site).sort();
assert.deepEqual(rootItems,['.nojekyll','app.js','index.html','licenses','scenes','style.css']);
assert.equal(existsSync(resolve(site,'test-core.cjs')),false);
assert.equal(existsSync(resolve(site,'.env')),false);
const nojekyll=readFileSync(resolve(site,'.nojekyll'),'utf8');
assert.equal(nojekyll,'');
console.log('Static demo package PASS: '+names.length+
  ' verified examples; isolated files, local assets, CSP and preserved licenses. '+site);
