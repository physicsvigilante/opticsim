import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-immersed-arc-port',format:'opticsim-immersed-arc-port-chrome-v1',
  logPrefix:'IMMERSED_ARC_PORT_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/immersed-arc-port/qualified-scene.json');
    async function verify(reflections,label){
      await until(state,s=>s.model.includes('Immersed spherical mirror')&&s.status==='completed'&&
        !s.saveDisabled&&s.results?.[0]?.value===reflections&&s.results[1]?.value===3&&s.results[2]?.value?.length===3,label);
      check(label);
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);await verify(3,'Singly reflected measurements');
    await shot('return');
    await edit('S-directionDeg',90);
    await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled,'off-axis input');
    check('Unsupported launch withholds measurements');
    await upload(pkg);await verify(3,'Restored reflected configuration');
    await edit('S-directionDeg',180);await verify(0,'Direct passage through the same plane');
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(pkg);await verify(3,'Original reflected scene re-executed');
    await upload(join(downloads,file));await verify(0,'Qualified direct revision reopened');
  }
});
