import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parseQualifiedBundle} from '../src/qualification.js';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-post-lens-aperture',format:'opticsim-post-lens-aperture-chrome-v1',
 logPrefix:'POST_LENS_APERTURE_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
  const pkg=join(root,'test-artifacts/llm-authoring/post-lens-aperture/qualified-scene.json');
  const verify=async(absorbed,detected,label)=>{
    await until(state,s=>s.status==='completed' && !s.saveDisabled &&
      s.results?.[0]?.value===8 && s.results[1].value===absorbed && s.results[2].value===detected &&
      s.results[3].value?.length===detected,label);
    check(label);
  };
  await cdp.send('Page.navigate',{url:origin});
  await until(state,s=>s.status==='completed','initial viewer');
  await upload(pkg);await verify(4,4,'Converging lens and downstream stop');
  await shot('converging');
  await edit('A1-openingLength',12.5);
  await until(state,s=>s.status==='invalid' && s.results===null && s.saveDisabled && s.error.includes('endpoint'),'inner endpoint refusal');
  check('Endpoint edit clears prior results and disables qualified save');
  await upload(pkg);await verify(4,4,'Reload after invalid edit');
  await edit('L1-focalLength',-100);await verify(6,2,'Diverging lens retraces');
  await shot('diverging');
  await js('document.getElementById("save-qualified").click()');
  const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
  const path=join(downloads,file);
  const bundle=await parseQualifiedBundle(await readFile(path,'utf8'));
  assert.equal(bundle.scene.schemaVersion,28);
  assert.equal(bundle.scene.physics.components.find(c=>c.id==='L1').parameters.focalLength,-100);
  assert.equal(Object.hasOwn(bundle,'results'),false);
  await upload(pkg);await verify(4,4,'Restore original physical baseline');
  await upload(path);await verify(6,2,'Reopened qualified revision retraces');
}});
