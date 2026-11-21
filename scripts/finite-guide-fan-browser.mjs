import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runQualifiedChrome} from './qualified-chrome.mjs';

await runQualifiedChrome({name:'browser-finite-guide-fan',format:'opticsim-finite-guide-fan-chrome-v1',
  logPrefix:'FINITE_GUIDE_FAN_CHROME',async exercise({root,downloads,origin,cdp,js,state,upload,edit,shot,check,until}){
    const pkg=join(root,'test-artifacts/llm-authoring/finite-guide-fan/qualified-scene.json');
    async function verified(guided,leaked,label){
      await until(state,s=>s.model==='Finite dielectric guide fan'&&s.status==='completed'&&!s.saveDisabled&&
        s.results?.[0]?.value?.guidedFarFace===guided&&s.results[0].value.sideLeak===leaked,label);
      check(label);
    }
    await cdp.send('Page.navigate',{url:origin});
    await until(state,s=>s.status==='completed','initial viewer');
    await upload(pkg);
    await verified(3,2,'Three guided exits and two side leaks qualify');
    const rendered=await js('document.getElementById("observable-results").textContent');
    if(!rendered.includes('2 sidewall exits'))throw Error('Guide branch counts are missing from the result preview');
    check('Guide branch counts appear in the visible result preview');
    await shot('finite-guide-fan');
    const critical=Math.asin(Math.sqrt(1.36**2-1))*180/Math.PI-15;
    await edit('S-directionDeg',critical);
    await until(state,s=>s.status==='failed'&&(!s.results||s.results.every(result=>result.value===null)),'critical fan withheld');
    check('Critical native sample clears accepted results for the whole fan');
    await upload(pkg);
    await verified(3,2,'Original native fan re-executes');
    await edit('S-directionDeg',55);
    await verified(4,1,'Edited incidence changes the verified native exit counts');
    await js('document.getElementById("save-qualified").click()');
    const file=await until(async()=>(await readdir(downloads)).find(n=>n.endsWith('.json')),Boolean,'qualified download');
    await upload(join(downloads,file));
    await verified(4,1,'Qualified revised guide reloads and retraces');
  }
});
