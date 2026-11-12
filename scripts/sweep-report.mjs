// Static, escaped reports. Plot points only: no interpolated line across poles,
// unavailable values, failed samples, or nonmonotonic parameter lists.
import {plotSamples} from '../src/parameter-sweep.js';
import {formatRequestedResult} from '../src/result-preview.js';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function sweepHTML(report){
  const rows=report.samples.map(s=>`<tr><td>${s.index+1}</td><td>${esc(s.value)}</td><td>${esc(s.status)}</td><td><pre>${esc(s.error?.message||s.requestedResults?.results.map(formatRequestedResult).join('\n\n')||'No result')}</pre></td></tr>`).join('\n');
  const points=plotSamples(report),good=points.filter(p=>p.y!==null);
  let plot='';
  if(points.length){
    const xs=points.map(p=>p.x),ys=good.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const scale=(v,lo,hi,size)=>lo===hi?size/2:((v-lo)/(hi-lo))*size;
    const circles=good.map(p=>`<circle cx="${70+scale(p.x,minX,maxX,640)}" cy="${330-scale(p.y,minY,maxY,280)}" r="4"><title>${esc(p.x)}: ${esc(p.y)} (${esc(p.status)})</title></circle>`).join('');
    const p=report.specification.parameter,q=report.specification.plot;
    plot=`<h2>${esc(q.observableId)} / ${esc(q.field)}</h2><p>Discrete samples only; no interpolation. ${points.length-good.length} samples have no finite plotted value. See the table for infinity, failures and unavailable results.</p>`+
      (good.length?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Discrete parameter sweep"><path d="M70 50V330H710" fill="none" stroke="currentColor"/>${circles}<text x="70" y="355">${esc(minX)}</text><text x="670" y="355">${esc(maxX)}</text><text x="5" y="50">${esc(Number(maxY.toPrecision(5)))}</text><text x="5" y="330">${esc(Number(minY.toPrecision(5)))}</text><text x="130" y="385">${esc(p.id+'.'+p.key+' ('+(p.unit||'native units')+')')}</text></svg>`:'<p>No finite plot points.</p>');
  }
  return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'"><title>Opticsim parameter sweep</title><style>body{font:16px system-ui;margin:2rem;max-width:1100px}table{border-collapse:collapse;width:100%}td,th{border:1px solid;padding:.6rem;text-align:left;vertical-align:top}pre{font:inherit;white-space:pre-wrap}svg{max-width:800px;width:100%}</style><h1>Opticsim parameter sweep</h1><p>Baseline: ${esc(report.baselineSceneSha256)}</p><p>${report.completedSamples}/${report.plannedSamples} native runs completed. ${report.failedSamples} failed or incomplete samples retained. Conditional predictions are not detected images. Native counts are sampled; power is relative, not watts.</p>${plot}<table><thead><tr><th>Sample</th><th>Parameter value</th><th>Run status</th><th>Requested results / errors</th></tr></thead><tbody>${rows}</tbody></table>`;
}
