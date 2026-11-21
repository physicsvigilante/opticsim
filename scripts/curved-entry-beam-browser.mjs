import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-curved-entry-beam',format:'opticsim-curved-entry-beam-chrome-v1',
  logPrefix:'CURVED_ENTRY_BEAM_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/curved-entry-beam/qualified-scene.json');
    async function verify(count,maximum,label){
      await until(state,s=>{
        const range=s.results?.[0]?.value?.['face-flat']?.sampledYRangeMm;
        return s.model.includes('Curved-entry') && s.status==='completed' && !s.saveDisabled &&
          range?.count===count && Math.abs(range.max-maximum)<1e-5 && Math.abs(range.min+range.max)<1e-5;
      },label);
      check(label);
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);await verify(20,32.14512591,'Centred native footprint');
    await shot('baseline');
    await edit('B-y',20);
    await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled,'invalid source offset');
    check('Invalid offset withholds readings');
    await upload(pkg);await verify(20,32.14512591,'Original restored after the invalid offset');
    await edit('B-width',40);
    const label='Narrower beam re-executes';
    const narrow=await until(state,s=>s.status==='completed'&&s.results?.[0]?.value?.['face-flat']?.sampledYRangeMm?.count===8,label);
    const maximum=narrow.results[0].value['face-flat'].sampledYRangeMm.max;
    if (!(maximum>0&&maximum<15)) throw Error('Unexpected narrow-beam extent');
    check(label);
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(pkg);await verify(20,32.14512591,'Original measured again');
    await upload(join(downloads,file));await verify(8,maximum,'Reopened qualified narrow beam');
  }
});
