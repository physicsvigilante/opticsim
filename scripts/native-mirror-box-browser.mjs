import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-native-mirror-box',format:'opticsim-native-mirror-box-chrome-v1',
  logPrefix:'NATIVE_MIRROR_BOX_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/native-mirror-box/qualified-scene.json');
    async function verified(label){
      await until(state,s=>s.model==='Rectangular mirror box'&&s.status==='completed'&&!s.saveDisabled&&
        s.results?.length===5&&s.results.every(r=>r.value===1),label);
      check(label);
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);
    await verified('Native box has four reflection results and one absorption');
    await shot('native-mirror-box');
    await edit('S-directionDeg',0);
    await until(state,s=>['failed','incomplete','stopped'].includes(s.status)&&
      (!s.results||s.results.every(r=>r.value===null)),'unqualified launch');
    check('A different launch withholds prior mirror and target evidence');
    await upload(pkg);
    await verified('Original launch re-executes successfully');
    await edit('S-directionDeg',-135.97);
    await verified('A finite directional revision retraces and qualifies');
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(join(downloads,file));
    await verified('Qualified mirror-box revision reopened');
    const actual=await js('Number(document.getElementById("S-directionDeg").value)');
    if(actual!==-135.97)throw Error('Reopened source direction does not match the revision');
    check('Reopened package retains the exact revised direction');
  }
});
