import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {parseQualifiedBundle} from '../src/qualification.js';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-refractive-fan',format:'opticsim-refractive-fan-chrome-v1',
 logPrefix:'REFRACTIVE_FAN_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
  const pkg=join(root,'test-artifacts/llm-authoring/refractive-fan/qualified-scene.json');
  async function verify(tir,label){
    await until(state,s=>s.status==='completed'&&!s.saveDisabled&&s.model.includes('Directional fan')&&
      s.results?.[0]?.value===2&&s.results[1].value===2&&s.results[2].value===tir,label);
    check(label);
  }
  await cdp.send('Page.navigate',{url:origin});
  await until(state,s=>s.status==='completed','initial viewer');
  await upload(pkg);await verify(1,'Fan straddles the critical angle');
  await shot('straddle');
  await edit('I-positiveIndex',1.5*Math.sin(50*Math.PI/180));
  await until(state,s=>s.status==='invalid'&&s.results===null&&s.error.includes('critical')&&s.saveDisabled,'critical sample');
  check('Critical sample clears results and disables qualified save');
  await upload(pkg);await verify(1,'Restore original fan');
  await edit('I-positiveIndex',1.4);await verify(0,'Both samples transmit after material edit');
  await shot('transmission');
  await js('document.getElementById("save-qualified").click()');
  const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
  const path=join(downloads,file),bundle=await parseQualifiedBundle(await readFile(path,'utf8'));
  assert.equal(bundle.scene.schemaVersion,29);
  assert.equal(bundle.scene.physics.components.find(c=>c.id==='I').parameters.positiveIndex,1.4);
  await upload(pkg);await verify(1,'Baseline restored before reopen');
  await upload(path);await verify(0,'Reopened qualified revision retraces');
}});
