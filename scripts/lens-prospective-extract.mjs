// Extract only the PRESELECTED original Problems PNGs. This never enumerates,
// opens, decodes or reads a Solutions entry. Selection was committed first.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {sha256,readProblemPng} from '../evaluation/llm-pilot-v1/independent-inference.mjs';
const root=resolve('.'),raw=readFileSync('evaluation/lens-motion-prospective-v1/selection.json');
const selection=JSON.parse(raw),archive=readFileSync(resolve(root,selection.archiveName));
assert.equal(selection.format,'opticsim-lens-motion-prospective-selection-v1');
assert.equal(sha256(archive),selection.archiveSha256);
assert.equal(selection.solutionsRead,false);
assert.equal(selection.cases.length,3);
const out=resolve(root,'test-artifacts/lens-prospective');mkdirSync(out,{recursive:true});
const records=[];
for(const c of selection.cases){
 assert.match(c.id,/^L[123]$/);
 assert.ok(c.problemPath.includes('/Problems/'));
 assert.ok(!c.problemPath.includes('/Solutions/'));
 const png=readProblemPng(archive,c.problemPath);
 const imageSha256=sha256(png);
 writeFileSync(resolve(out,c.id+'.png'),png,{flag:'wx'});
 records.push({id:c.id,problemPath:c.problemPath,imageSha256,bytes:png.length});
}
const manifest={format:'opticsim-lens-motion-extracted-problems-v1',
 selectionSha256:sha256(raw),archiveName:selection.archiveName,archiveSha256:selection.archiveSha256,
 selectionRule:selection.rule,firstAttemptsNotYetWritten:true,
 solutionsRead:false,independentEvaluation:false,records};
writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log('Selected original Problems PNGs extracted without Solutions, manifest: '+
 JSON.stringify(records.map(r=>({id:r.id,sha256:r.imageSha256,bytes:r.bytes}))));
