// Private, local-only playable artifact. Does not change the Pages allowlist,
// upload anything publicly, include a headless core, or expose source archives.
import {mkdirSync,copyFileSync,cpSync,writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const out=resolve('test-artifacts/motion-demo');
if(existsSync(out))throw Error('Motion demo output must be fresh');
mkdirSync(out,{recursive:true});
for(const [from,to] of [['motion.html','index.html'],['motion.js','motion.js'],['motion.css','motion.css']])
 copyFileSync(resolve('dist',from),resolve(out,to));
cpSync('dist/licenses',resolve(out,'licenses'),{recursive:true});
writeFileSync(resolve(out,'README.txt'),`OPTICSIM — U2 moving-source prototype\n\nExtract this folder, then open index.html in Chrome or Edge.\nNo model API, installation or network connection is needed.\nUse Play, Pause, Reset, and the time slider. Save experiment retains the motion;\nSave current static scene exports just one frame for the regular optics app.\n\nThe native ray panel reruns pinned PhyDemo at each time. The image-position\ndiagram is a separate conditional calculation, not native image detection.\nOnly t=0 is specified by U2; later motion assumes uniform velocity.\nFinite aperture and source emission are explicitly illustrative.\nNo finite light-travel time, moving-mirror dynamics or general time solver.\n\nThis is a private test artifact, not a public deployment. Licenses are in licenses/.\n`);
console.log('Packed private, directly openable motion demo: '+out);
