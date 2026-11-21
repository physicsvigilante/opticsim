import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-finite-circular-cap',format:'opticsim-finite-cap-chrome-v1',
  logPrefix:'FINITE_CIRCULAR_CAP_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/finite-circular-cap/qualified-scene.json');
    async function verify(label){
      const s=await until(state,s=>s.model.includes('circular glass cap')&&s.status==='completed'&&
        !s.saveDisabled&&s.results?.[0]?.value?.['face-arc']?.interactions===3&&s.results[1]?.value?.length===3,label);
      check(label);return s.results[1].value;
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);const original=await verify('Finite cap exits and detector coordinates');
    await shot('cap');
    await edit('S-x',0);
    await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled,'base contact');
    check('A source on the flat base withholds the measurement');
    await upload(pkg);await verify('Original scene restored');
    await edit('C-capHeight',25);const altered=await verify('Changing cap height retraces the scene');
    if(JSON.stringify(altered)===JSON.stringify(original))throw Error('Cap edit did not change detector directions');
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(pkg);await verify('Original scene re-executed');
    await upload(join(downloads,file));const reopened=await verify('Qualified cap reopened');
    if(JSON.stringify(reopened)!==JSON.stringify(altered))throw Error('Reopened cap evidence changed');
  }
});
