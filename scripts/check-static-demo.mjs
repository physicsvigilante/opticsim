// Validate the exact browser-only files that can be served by GitHub Pages.
// This uses the already-built dist directory and never publishes anything.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validate} from '../src/contract.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'dist');
const args=process.argv.slice(2);
let reportPath=null;
if(args.length){
  assert.equal(args.length,2,'Only --report <path> is supported');
  assert.equal(args[0],'--report');
  reportPath=resolve(root,args[1]);
  const allowed=resolve(root,'test-artifacts/static-demo')+sep;
  assert.ok(reportPath.startsWith(allowed)&&reportPath.endsWith('.json'),
    'Report must be a JSON file under test-artifacts/static-demo/');
}
const walk=(dir='')=>readdirSync(resolve(dist,dir),{withFileTypes:true})
  .flatMap(entry=>{
    const path=(dir?dir+'/':'')+entry.name;
    assert.ok(!entry.isSymbolicLink(),'Static demo must not include symlinks: '+path);
    if(entry.isDirectory())return walk(path);
    assert.ok(entry.isFile(),'Static demo must contain regular files only: '+path);
    return [path];
  }).sort();
const paths=walk();
const files=new Set(paths);
const required=['index.html','style.css','app.js','.nojekyll',
  'licenses/INDEX.txt','licenses/phydemo/LICENSE','licenses/phydemo/CITATION.md'];
for(const path of required)assert.ok(files.has(path),'Missing standalone demo asset: '+path);
assert.ok(paths.length>required.length,'Static site unexpectedly empty');
for(const path of paths)assert.ok(
  ['index.html','style.css','app.js','.nojekyll'].includes(path) ||
  path.startsWith('scenes/')&&path.endsWith('.json') ||
  path.startsWith('licenses/'),
  'Unexpected file in publishable output: '+path
);
assert.equal(readFileSync(resolve(dist,'.nojekyll'),'utf8'),'');
const index=readFileSync(resolve(dist,'index.html'),'utf8');
assert.match(index,/<script src="app\.js" defer><\/script>/);
assert.match(index,/<link rel="stylesheet" href="style\.css">/);
assert.doesNotMatch(index,/<base\b/i,'Static demo must use project-relative URLs');
assert.doesNotMatch(index,/(?:src|href)=["'](?:https?:)?\/\//i,
  'HTML must not load resources from other origins');
assert.doesNotMatch(index,/(?:src|href)=["']\//i,
  'HTML must not use root-absolute asset URLs');
const source=readFileSync(resolve(root,'src/app.js'),'utf8');
assert.match(source,/fetch\(\x60scenes\/\$\{name\}\.json\x60\)/,
  'Example loading must stay relative to the current project subpath');
const exampleSelect=index.match(/<select id="examples">([\s\S]*?)<\/select>/);
assert.ok(exampleSelect,'Example picker is missing from static index');
const selected=[...exampleSelect[1].matchAll(/<option value="([a-z][a-z0-9-]+)">/g)]
  .map(match=>match[1]);
assert.equal(new Set(selected).size,selected.length,'Duplicate example IDs');
assert.ok(selected.length>=16,'Previously supported examples disappeared');
for(const example of selected){
  const path='scenes/'+example+'.json';
  assert.ok(files.has(path),'Missing example referenced by index: '+example);
  const scene=JSON.parse(readFileSync(resolve(dist,path),'utf8'));
  assert.equal(validate(scene),scene,'Invalid published example: '+example);
}
const sources=Object.fromEntries(paths.map(path=>{
  const buf=readFileSync(resolve(dist,path));
  return [path,{bytes:buf.length,sha256:createHash('sha256').update(buf).digest('hex')}];
}));
const output={status:'pass',siteType:'standalone-static-browser',
  basePathCompatibility:['/','/opticsim/'],exampleCount:selected.length,
  exampleIds:selected,fileCount:paths.length,files:sources,
  notes:'No web API or GitHub authentication is needed at runtime; browser JS and authored examples are shipped as static files.'};
if(reportPath){
  mkdirSync(dirname(reportPath),{recursive:true});
  writeFileSync(reportPath,JSON.stringify(output,null,2)+'\n');
}
console.log('Static demo checks PASS: '+selected.length+' selectable scenes, '+
  paths.length+' files, root and /opticsim/ project-path ready.');
