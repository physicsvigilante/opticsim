// Temporary materializer for browser contract assertions only; removed now.
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
const path='scripts/circular-dielectric-browser.mjs';let s=readFileSync(path,'utf8');
const changes=[
 ["s=>s.status==='incomplete'&&s.results?.every(r=>r.status==='suppressed'),'full Fresnel truncation'","s=>s.status==='incomplete'&&s.title.endsWith('full-fresnel')&&s.results===null&&s.text.includes('suppressed'),'full Fresnel truncation'"],
 ["assert.ok(s.results.every(r=>r.value===null));check('Full Fresnel","assert.equal(s.results,null);assert.equal(s.fitDisabled,true);check('Full Fresnel"],
 ["s=>s.status==='incomplete'&&s.results?.length===3&&s.results.every(r=>r.status==='suppressed'),'trapped interior TIR'","s=>s.status==='incomplete'&&s.title.endsWith('trapped-tir')&&s.results===null&&s.text.includes('suppressed'),'trapped interior TIR'"],
 ["check('Repeated interior TIR respects","assert.equal(s.fitDisabled,true);check('Repeated interior TIR respects"]
];
for(const [a,b] of changes){if(!s.includes(a))throw Error('Expected previous assertion absent');s=s.replace(a,b);}
writeFileSync(path,s);unlinkSync('scripts/circle-browser-fix.mjs');
