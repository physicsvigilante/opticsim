import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capabilities,inspectAuthoringRequest} from '../src/authoring.js';
import {resolveProblemRequest} from '../src/problem-authoring.js';
import {authoringMessages,scopeMessages} from '../evaluation/llm-pilot-v1/independent-inference.mjs';

test('model prompts include the full live contract, not a lossy copy without observations',()=>{
  const author=authoringMessages({id:'test',prompt:'Describe the stated apparatus.'});
  const scope=scopeMessages({problemPath:'chapter/Problems/example.png'},Buffer.from([137,80,78,71]));
  for(const messages of [author,scope]){
    const contract=JSON.parse(messages[0].content.split('CAPABILITIES: ')[1]);
    assert.deepEqual(contract,capabilities());
    assert.deepEqual(contract.observations,['emissionsById','reflectionsById','detectorsById','interfacesById']);
    assert.equal(contract.schemaVersion,4);
    assert.equal(contract.planarMedia.schemaVersion,5);
    assert.equal(contract.planarMedia.model,'planar-media-tracing');
    assert.deepEqual(contract.componentTypes['planar-interface'].booleanParameters,['partialReflection']);
    assert.equal(contract.componentTypes['point-source'].emission.planarOnlyMode,'single-ray');
    assert.ok(contract.limitations.includes('no source-specific detector provenance'));
  }
});

test('preparation error category does not depend on unsupported-component ordering',()=>{
  const source={type:'point-source',parameters:{x:-20,y:1}};
  const prism={type:'prism',parameters:{}};
  for(const components of [[source,prism],[prism,source]]){
    const request={lengthUnit:'cm',components};
    assert.equal(resolveProblemRequest(request).status,'unsupported');
    const issues=inspectAuthoringRequest(request);
    assert.ok(issues.some(x=>x.code==='UNSUPPORTED_COMPONENT'));
    assert.ok(issues.some(x=>x.path.endsWith('brightness')&&x.code==='MISSING_VALUE'));
    assert.ok(issues.some(x=>x.path.endsWith('emission')&&x.code==='MISSING_VALUE'));
  }
});

test('explicit invalid numbers are exposed even when other physical values are missing',()=>{
  const request={lengthUnit:'cm',components:[
    {type:'point-source',parameters:{x:-20,y:1}},
    {type:'ideal-lens',parameters:{x:0,focalLength:0}}
  ]};
  const result=resolveProblemRequest(request);
  assert.equal(result.status,'invalid-input');
  assert.ok(result.issues.some(x=>x.path.endsWith('focalLength')&&x.code==='INVALID_INPUT'));
  assert.ok(result.issues.some(x=>x.path.endsWith('apertureHeight')&&x.code==='MISSING_VALUE'));
  assert.equal(result.prepared,null);
});
