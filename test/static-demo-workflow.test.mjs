import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Pages publication is manual-only and requires a positive visibility choice on main',()=>{
  const flow=text('.github/workflows/opticsim-pages.yml');
  assert.match(flow,/^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(flow,/^\s*(?:push|pull_request|schedule):/m);
  assert.match(flow,/default: do-not-publish/);
  assert.match(flow,/^\s+if: github\.ref == 'refs\/heads\/main' && inputs\.publish_scope == 'public-site-approved'$/m);
  assert.match(flow,/pages: write/);
  assert.match(flow,/id-token: write/);
  assert.match(flow,/environment:\n\s+name: github-pages/);
  assert.match(flow,/actions\/upload-pages-artifact@v4/);
  assert.match(flow,/actions\/deploy-pages@v4/);
});

test('published website is an allowlisted build artifact, not repository or test-core',()=>{
  const pack=text('scripts/pack-demo.mjs');
  assert.match(pack,/const names=\[\.\.\.choices\[1\]\.matchAll/);
  assert.match(pack,/writeFileSync\(resolve\(site,'scenes',name\+'\.json'\),data\)/);
  assert.match(pack,/assert\.deepEqual\(readdirSync\(site\)\.sort\(\)/);
  assert.match(pack,/test-core\.cjs/);
  assert.match(pack,/assert\.match\(html,\/<meta http-equiv="Content-Security-Policy"/);
  assert.doesNotMatch(pack,/cpSync\(resolve\(dist,'scenes'\)/);
});
