// Post-execution regression checks, NOT answers supplied to an author/model.
// Lens oracle uses scalar conjugates rather than the production ABCD code.
import assert from 'node:assert/strict';
export function scalarLensOracle(doc){
  const sources=doc.physics.components.filter(c=>c.type==='point-source');
  assert.equal(sources.length,1);
  const lenses=doc.physics.components.filter(c=>c.type==='ideal-lens').sort((a,b)=>a.parameters.x-b.parameters.x);
  let x=sources[0].parameters.x,y=sources[0].parameters.y,magnification=1,distance;
  for(const {parameters:p} of lenses){
    const u=p.x-x,v=1/(1/p.focalLength-1/u),m=-v/u;
    x=p.x+v;y*=m;magnification*=m;distance=v;
  }
  return {x,y,distance,magnification};
}
export function assertSupportedOutcome(id,phase,doc,run){
  const results=run.requestedResults.results;
  const result=kind=>results.find(r=>r.kind===kind);
  assert.equal(doc.physics.model,'general-component-tracing','Analysis must not rewrite native model');
  if(id==='D1-single-lens'||id==='D2-two-lens'){
    const image=result('ideal-image');
    assert.equal(image.status,'conditional');assert.equal(image.nativeImageDetected,false);
    assert.equal(image.method,'existing-analytical-model');
    for(const [key,expected] of Object.entries(scalarLensOracle(doc)))
      assert.ok(Math.abs(image.value[key]-expected)<1e-8,key+' disagrees with scalar lens oracle');
    assert.equal(result('source-emissions').value,100);
  }else if(id==='D3-mirror-detector'){
    // Fixed sampled regression values recorded AFTER the sealed native first run.
    // They are not a continuous-throughput oracle or unique-ray attribution.
    const expected={'source-emissions':7,'mirror-reflections':7,
      'detector-crossings':phase==='initial'?7:0,'detector-signed-power':phase==='initial'?2.1:0};
    for(const [kind,value] of Object.entries(expected)){
      const r=result(kind);assert.equal(r.method,'native-observation');assert.equal(r.status,'available');
      assert.ok(Math.abs(r.value-value)<1e-10,kind+' changed at pinned preview-v1');
    }
  }else throw Error('Unknown supported demonstration');
}
