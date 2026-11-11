// Package a deliberately small static demo from the existing production
// build. Never publish the repository, vendor checkout, test-core, caches, or
// scene JSON that was not explicitly listed in the browser example menu.
import assert from 'node:assert/strict';
import {cpSync, copyFileSync, existsSync, mkdirSync, readFileSync,
  readdirSync, rmSync, writeFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../src/contract.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'dist');
const site=resolve(root,'test-artifacts/demo-site');
for(const name of ['app.js','index.html','style.css','scenes','licenses'])
  assert.ok(existsSync(resolve(dist,name)),'Missing built '+name);
const html=readFileSync(resolve(dist,'index.html'),'utf8');
assert.match(html,/<meta http-equiv="Content-Security-Policy"/);
assert.match(html,/script-src 'self'/);
assert.match(html,/connect-src 'self'/);
assert.match(html,/<script src="app.js" defer><\/script>/);
assert.match(html,/<link rel="stylesheet" href="style.css">/);
assert.match(html,/id="example-link"/);

// Derive exactly the allowlisted, shareable scene names from the checked UI.
const choices=html.match(/<select id="examples">([\s\S]*?)<\/select>/);
assert.ok(choices,'Missing example selector');
const names=[...choices[1].matchAll(/<option value="([^"]+)"/g)]
  .map(match=>match[1]).filter(Boolean);
assert.ok(names.length>=16,'Missing existing examples');
assert.equal(new Set(names).size,names.length,'Duplicated example slugs');
const checkedScenes=[];
for(const name of names){
  assert.match(name,/^[a-z0-9-]+$/,'Unsafe scene identifier');
  const data=readFileSync(resolve(dist,'scenes',name+'.json'),'utf8');
  const doc=JSON.parse(data);
  assert.equal(validate(doc),doc,'Invalid bundled example '+name);
  checkedScenes.push([name,data]);
}

// Construct a clean tree from a file allowlist instead of copying arbitrary
// build outputs (npm test leaves dist/test-core.cjs behind, for example).
rmSync(site,{recursive:true,force:true});
mkdirSync(site,{recursive:true});
for(const name of ['app.js','index.html','style.css'])
  copyFileSync(resolve(dist,name),resolve(site,name));
cpSync(resolve(dist,'licenses'),resolve(site,'licenses'),{recursive:true,errorOnExist:true});
mkdirSync(resolve(site,'scenes'));
for(const [name,data] of checkedScenes)
  writeFileSync(resolve(site,'scenes',name+'.json'),data);
writeFileSync(resolve(site,'.nojekyll'),'');
assert.ok(statSync(resolve(site,'app.js')).size>100000,'Missing native browser bundle');
for(const name of ['phydemo/LICENSE','phydemo/CITATION.md','INDEX.txt'])
  assert.ok(statSync(resolve(site,'licenses',name)).isFile(),'Missing notice '+name);
assert.deepEqual(readdirSync(site).sort(),
  ['.nojekyll','app.js','index.html','licenses','scenes','style.css']);
assert.deepEqual(readdirSync(resolve(site,'scenes')).sort(),
  names.map(name=>name+'.json').sort());
assert.equal(existsSync(resolve(site,'test-core.cjs')),false);
assert.equal(existsSync(resolve(site,'.env')),false);
assert.equal(readFileSync(resolve(site,'.nojekyll'),'utf8'),'');
console.log('Static demo package PASS: '+names.length+
  ' verified allowlisted examples, local assets, CSP and complete license notices.');
