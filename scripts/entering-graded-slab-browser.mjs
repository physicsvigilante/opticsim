import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-entering-graded-slab',format:'opticsim-entering-graded-slab-chrome-v1',
  logPrefix:'ENTERING_GRADED_SLAB_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/entering-graded-slab/qualified-scene.json');
    async function verify(label){
      const s=await until(state,s=>s.model.includes('graded-index slab')&&s.status==='completed'&&
        !s.saveDisabled&&s.results?.[0]?.value?.length===1,label);
      check(label);return s.results[0].value[0];
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);const before=await verify('Native graded slab with a finite incidence');
    await js('document.getElementById("fit-results").click()');
    await until(()=>js('Number(document.getElementById("zoom").value)'),zoom=>zoom>2,'GRIN viewport magnification');
    await shot('graded-slab');
    await edit('S-directionDeg',0);
    await until(state,s=>s.status==='invalid'&&s.results===null&&s.saveDisabled,'grazing incidence refused');
    check('Grazing launch clears detector evidence');
    await upload(pkg);await verify('Restored original after invalid launch');
    await edit('S-directionDeg',40);const after=await verify('Edited incidence retraces the slab');
    if(Math.abs(after.pointMm.x-before.pointMm.x)<.01)throw Error('Native detector position did not respond to incidence');
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(pkg);await verify('Original scene re-executed');
    await upload(join(downloads,file));const reopened=await verify('Qualified GRIN revision reopened');
    if(JSON.stringify(reopened)!==JSON.stringify(after))throw Error('Reopened detector evidence changed');
  }
});
