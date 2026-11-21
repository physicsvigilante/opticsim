import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-slab-arc-return',format:'opticsim-slab-arc-return-chrome-v1',
  logPrefix:'SLAB_ARC_RETURN_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/slab-arc-return/qualified-scene.json');
    async function verified(label){
      const result=await until(state,s=>s.status==='completed'&&!s.saveDisabled&&s.model.includes('spherical mirror')&&
        s.results?.[0]?.value===3&&s.results[1].value===6&&s.results[2].value===6&&
        Array.isArray(s.results[3].value)&&s.results[3].value.filter(hit=>hit.incomingUnit.x<0).length===3,label);
      check(label);
      return result.results[3].value;
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);const before=await verified('Native slab and spherical mirror return');
    await shot('baseline');
    await edit('I2-x',-285);
    await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled,'coincident planes refused');
    check('Coincident planes clear measurements and disable qualified save');
    await upload(pkg);await verified('Restored original');
    await edit('M-radius',220);
    const edited=await verified('Edited radius qualifies a fresh return');
    if(JSON.stringify(edited)===JSON.stringify(before))throw Error('Mirror edit did not change native detector positions');
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(pkg);await verified('Original rerun');
    await upload(join(downloads,file));
    const reopened=await verified('Reopened qualified revision');
    if(JSON.stringify(reopened)!==JSON.stringify(edited))throw Error('Reopened native evidence changed');
  }
});
