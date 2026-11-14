// Temporary mechanical transfer of already locally tested source; removed before review.
import {readFileSync as r,writeFileSync as w,unlinkSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
copyFileSync('.dev/composition-test.txt','test/finite-dielectric-composition.test.mjs');
copyFileSync('.dev/composition-acceptance.txt','scripts/finite-composition-acceptance.mjs');
copyFileSync('.dev/composition-doc.txt','docs/FINITE-DIELECTRIC-COMPOSITION.md');
const browser=r('scripts/polygon-dielectric-browser.mjs','utf8');
const start=browser.indexOf('  const acceptance='),end=browser.indexOf('  }catch(error){',start);
assert.ok(start>=0&&end>start,'browser anchors');
let b=browser.slice(0,start)+r('.dev/composition-browser-body.txt','utf8')+'\n'+browser.slice(end);
b=b.replace("'browser-polygon-dielectric'","'browser-finite-composition'").replace('Polygon dielectric browser PASS:','Finite dielectric composition browser PASS:');
w('scripts/finite-composition-browser.mjs',b);
const f='.github/workflows/planar-refraction.yml';let s=r(f,'utf8');
const anchor='      - name: Package existing allowlisted static viewer (not a deployment)';assert.ok(s.includes(anchor));
s=s.replace(anchor,`      - name: Native finite glass and external mirror composition, rejection and sweep
        run: node scripts/finite-composition-acceptance.mjs
      - name: Composition browser edits, misses, incomplete results and qualified exports
        run: node scripts/finite-composition-browser.mjs
      - name: Package existing allowlisted static viewer (not a deployment)`);
s=s.replace('            test-artifacts/browser-polygon-dielectric/','            test-artifacts/browser-polygon-dielectric/\n            test-artifacts/llm-authoring/finite-composition/\n            test-artifacts/browser-finite-composition/');w(f,s);
w('README.md',r('README.md','utf8')+'\n### Finite dielectric composition pilot\n\nSchema v10 combines one convex four-vertex glass region, one external finite plane mirror, 1–4 explicit single rays and optional external detectors using the unchanged pinned native engine. Older schemas retain their scopes. See [scope, numerical limits and verification](docs/FINITE-DIELECTRIC-COMPOSITION.md) and the synthetic [unified request](examples/finite-dielectric-composition.json). The existing viewer menu includes “Finite glass + external mirror”; no prescribed ray path or image prediction is implied.\n');
w('AGENTS.md',r('AGENTS.md','utf8')+'\n- Finite dielectric composition v10 combines exactly one existing convex four-vertex polygon dielectric and one external plane mirror, 1–4 explicit single rays and 0–2 external detectors. Reuse polygon validation and native component observers; do not relax historical v4–v9 scopes or silently migrate qualified models. External segments need a common separating face and 0.01 mm clearance; no other optics/media are admitted. No prescribed return path, source-attributed ray history or analytical image is implied. The unchanged maxRayDepth=8 counts detector encounters too; two crossed detectors can truncate a return and all accepted readings must remain suppressed. Keep PR #64 experimental intersections out of production. See docs/FINITE-DIELECTRIC-COMPOSITION.md.\n');
unlinkSync('.github/workflows/composition-dev-transfer.yml');
const manifest=JSON.parse(r('.dev/composition-manifest.json','utf8'));
for(const [path,expected] of Object.entries(manifest)){
 const bytes=r(path),actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 assert.equal(actual,expected,'Exact locally tested source mismatch: '+path);
}
console.log('All 16 generated files match their locally tested Git blob hashes.');
