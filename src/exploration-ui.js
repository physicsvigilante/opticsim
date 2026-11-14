// Thin viewer workflow. No model-provider calls, natural-language parser or
// alternative ray renderer. All imported strings remain literal text.
import {explorationBundle,explorationContext,parseExplorationProposal,prepareExplorationProposal,
 browserExecution,snapshotScenario,compareExplorationSnapshots,nativeComparisonReadouts} from './exploration.js';
import {verifyQualifiedBundle} from './qualification.js';
import {canonicalJSON} from './qualified-utils.js';
const same=(a,b)=>canonicalJSON(a)===canonicalJSON(b);
const complete=state=>['completed','completed-with-warnings'].includes(state);
const json=x=>JSON.stringify(x,null,2)+'\n';
export class ExplorationUI {
 constructor({session,qualified,applyBundle,download,hasPending=()=>false}){
  Object.assign(this,{session,qualified,applyBundle,download,hasPending});
  this.saved=[];this.preview=null;this.busy=false;this.comparison=null;this.intent=null;
  const el=(tag,id,text)=>{const x=document.createElement(tag);if(id)x.id=id;if(text)x.textContent=text;return x;};
  this.root=el('details','exploration-panel');this.root.className='exploration-panel';
  this.root.append(el('summary',null,'Explore this model with an LLM'));
  this.root.append(el('p',null,'Keep a baseline, preview a proposed change, run native optics, and compare saved scenarios. No model is called by this page.'));
  const button=(id,text,fn)=>{const b=el('button',id,text);b.type='button';b.onclick=()=>this.act(fn);return b;};
  const labelled=(title,node)=>{const label=el('label',null,title);label.append(node);return label;};
  this.startButton=button('explore-start','Start new exploration',()=>this.start());
  this.root.append(this.startButton,el('p',null,'Starting again replaces this tab’s scenario list. Download saved packages first. With no requested results, existing native counters are selected for comparison; raw scene provenance stays unknown.'));
  this.status=el('p','explore-status','No exploration started.');this.status.setAttribute('role','status');
  this.error=el('p','explore-error');this.error.setAttribute('role','alert');
  this.question=el('textarea','explore-question');this.question.rows=2;this.question.maxLength=1200;
  this.question.placeholder='For example: Move source S2 upward by 25 mm, keeping everything else unchanged.';
  this.contextButton=button('explore-context','Download model context for LLM',()=>this.context());
  this.root.append(this.status,this.error,labelled('Your investigation (not a source-given fact)',this.question),this.contextButton,
   el('p',null,'Inspect the downloaded context before sharing it in your chosen chat. It includes the model and source notes. Ask for the proposed JSON change; no API key or provider connection is required here.'));
  this.proposal=el('textarea','explore-proposal');this.proposal.rows=7;this.proposal.maxLength=64000;
  this.proposal.spellcheck=false;this.proposal.placeholder='Paste the LLM’s JSON proposal here. Missing physical facts should be clarified in the conversation, not guessed.';
  this.proposal.oninput=()=>{this.invalidatePreview();this.refresh();};
  this.previewButton=button('explore-preview','Preview proposed changes',()=>this.inspect());
  this.applyButton=button('explore-apply','Apply changes and simulate',()=>this.apply());
  this.previewText=el('pre','explore-changes','No proposal preview.');
  const actions=el('div');actions.className='actions';actions.append(this.previewButton,this.applyButton);
  this.root.append(labelled('Proposed JSON revision',this.proposal),actions,this.previewText);
  this.name=el('input','explore-name');this.name.type='text';this.name.maxLength=80;this.name.placeholder='Name this scenario';
  this.saveButton=button('explore-capture','Save completed scenario',()=>this.capture());
  this.select=el('select','explore-scenarios');this.select.onchange=()=>{this.comparison=null;delete this.comparisonText.dataset.report;this.comparisonText.textContent='Select Compare to inspect these saved runs.';this.refresh();};
  this.restoreButton=button('explore-restore','Load saved scenario and retrace',()=>this.restore());
  this.exportButton=button('explore-export','Download selected qualified scene',()=>this.exportScene());
  this.compareButton=button('explore-compare','Compare selected with baseline',()=>this.compare());
  this.reportButton=button('explore-report','Download comparison evidence',()=>this.exportComparison());
  const snapshots=el('div');snapshots.className='actions';snapshots.append(this.saveButton,this.restoreButton,this.exportButton,this.compareButton,this.reportButton);
  this.comparisonText=el('pre','explore-comparison','No saved comparison.');
  this.root.append(labelled('Scenario label',this.name),labelled('Saved, individually executed scenarios (maximum 12 per tab)',this.select),snapshots,this.comparisonText,
   el('p',null,'Scenario lists live in this tab only. Download qualified scenes before leaving; opening them retraces the model. Saved comparisons are historical evidence, not live results. Sampled counts are not continuous irradiance; conditional predictions are not detected images.'));
  document.querySelector('.analysis').after(this.root);this.refresh();
 }
 token(){return canonicalJSON({revision:this.session.revision,qualification:this.qualified.qualification,requests:this.qualified.requests});}
 guard(token){if(this.hasPending()||token!==this.token())throw Error('Current model changed during this action. Try again on its completed revision.');}
 requireCurrent(){if(this.hasPending()||!this.session.document||!complete(this.session.state))throw Error('Finish the current edit and native run first.');}
 async act(fn){
  if(this.busy)return;this.busy=true;this.error.textContent='';this.refresh();
  try{await fn();}catch(e){this.error.textContent=e.message;}
  finally{this.busy=false;this.refresh();}
 }
 invalidatePreview(){this.preview=null;this.previewText.textContent='No current preview. Preview again after any edit.';}
 refresh(){
  const ready=!!this.session.document&&complete(this.session.state)&&!this.hasPending();
  if(this.preview&&this.preview.token!==this.token())this.invalidatePreview();
  this.startButton.disabled=this.busy||!ready;
  for(const b of [this.contextButton,this.previewButton,this.saveButton])b.disabled=this.busy||!ready||!this.saved.length;
  this.applyButton.disabled=this.busy||!ready||!this.preview;
  for(const b of [this.restoreButton,this.exportButton,this.compareButton])b.disabled=this.busy||!this.saved.length;
  this.reportButton.disabled=this.busy||!this.comparison;
 }
 async current(){
  this.requireCurrent();const token=this.token();
  const doc=structuredClone(this.session.document),q=structuredClone(this.qualified.qualification),requests=structuredClone(this.qualified.requests);
  const bundle=await explorationBundle(doc,q,requests);this.guard(token);return {bundle,token};
 }
 async currentSnapshot(label,seedReadouts=false){
  this.requireCurrent();const token=this.token(),doc=structuredClone(this.session.document),data=structuredClone(this.session.data),state=this.session.state;
  const q=structuredClone(this.qualified.qualification),requests=structuredClone(this.qualified.requests);
  const selected=seedReadouts&&!requests.length?nativeComparisonReadouts(doc):requests;
  const bundle=await explorationBundle(doc,q,selected);
  const execution=await browserExecution(doc,state,data);
  const match=this.intent?.childIntegritySha256===bundle.integritySha256;
  const snapshot=await snapshotScenario(bundle,execution,label,match?this.intent:{});
  this.guard(token);return snapshot;
 }
 setOptions(index){
  this.select.replaceChildren();this.saved.forEach((s,i)=>{
   const o=document.createElement('option');o.value=String(i);o.textContent=s.label;this.select.append(o);
  });this.select.value=String(index);
 }
 async start(){
  const first=await this.currentSnapshot('Baseline',true);
  // Only qualification/readout selection changes, not physical apparatus or rays.
  this.qualified.commit({qualification:first.bundle.qualification,requests:first.bundle.observables});
  this.saved=[first];this.intent=null;this.comparison=null;delete this.comparisonText.dataset.report;this.invalidatePreview();this.setOptions(0);
  this.status.textContent='Baseline preserved. Edit directly or export context for a hypothetical investigation.';
  this.comparisonText.textContent='One completed baseline saved. Source provenance: '+first.bundle.qualification.origin.preparationStatus+'.';
  this.root.dataset.scenarios='1';
 }
 async context(){
  const {bundle,token}=await this.current();
  const context=await explorationContext(bundle,this.question.value);this.guard(token);
  this.download(json(context),'opticsim-exploration-context.json');
  this.status.textContent='Context downloaded locally. No model call or upload occurred.';
 }
 async inspect(){
  this.invalidatePreview();const rawText=this.proposal.value,raw=parseExplorationProposal(rawText);
  const {bundle,token}=await this.current(),prepared=await prepareExplorationProposal(bundle,raw);
  this.guard(token);if(rawText!==this.proposal.value)throw Error('Proposal text changed during preview. Preview again.');
  this.preview={token,rawText,prepared};
  this.previewText.textContent='PROPOSED HYPOTHETICAL: '+raw.intent+'\n\n'+
   (prepared.changes.length?prepared.changes.map(c=>c.componentId+'.'+c.field+': '+JSON.stringify(c.before)+' → '+JSON.stringify(c.after)).join('\n'):'No physical change.')+
   '\n\nAdditional readouts: '+JSON.stringify(prepared.additionalObservables)+'\n\n'+prepared.note;
  this.status.textContent='Validated, not executed. Check the physical changes before applying.';
 }
 async apply(){
  const preview=this.preview;if(!preview)throw Error('Preview this proposal first.');
  this.guard(preview.token);if(preview.rawText!==this.proposal.value)throw Error('Proposal text changed. Preview it again.');
  const {bundle,token}=await this.current();
  const checked=await prepareExplorationProposal(bundle,preview.prepared.proposal);this.guard(token);
  // The editor remains interactive while hashes are checked. An input event
  // invalidates approval even if the user restores the same text afterward.
  if(this.preview!==preview||preview.rawText!==this.proposal.value)
   throw Error('Proposal text changed during validation. Preview it again before applying.');
  this.intent={intent:checked.proposal.intent,parentIntegritySha256:bundle.integritySha256,childIntegritySha256:checked.child.integritySha256};
  if(!this.applyBundle(checked.child))throw Error('Native setup did not accept the validated revision; current results are withheld.');
  this.invalidatePreview();this.status.textContent='Hypothetical applied. Native tracing is '+this.session.state+'. Save only after completion.';
 }
 async capture(){
  if(this.saved.length>=12)throw Error('Twelve scenarios saved. Download them before starting a new exploration.');
  const snapshot=await this.currentSnapshot(this.name.value);
  if(!same(snapshot.bundle.qualification.origin,this.saved[0].bundle.qualification.origin))
   throw Error('This is a different model origin. Start a new exploration rather than mixing source baselines.');
  this.saved.push(snapshot);this.setOptions(this.saved.length-1);this.comparison=null;delete this.comparisonText.dataset.report;this.comparisonText.textContent='Select Compare to inspect these saved runs.';
  this.root.dataset.scenarios=String(this.saved.length);this.status.textContent='Saved '+snapshot.label+' with its own complete native evidence. Baseline unchanged.';
 }
 selected(){const s=this.saved[Number(this.select.value)];if(!s)throw Error('Select a saved scenario.');return structuredClone(s);}
 async restore(){
  const selected=this.selected(),token=this.token(),bundle=await verifyQualifiedBundle(selected.bundle);this.guard(token);
  this.intent=null;this.invalidatePreview();
  if(!this.applyBundle(bundle))throw Error('Saved scene could not be loaded; native results remain withheld.');
  this.status.textContent='Loaded '+selected.label+' and started a fresh native run. Stored results were not reused.';
 }
 exportScene(){const s=this.selected();this.download(json(s.bundle),'exploration-scene.qualified.json');}
 async compare(){
  const index=this.select.value,selected=this.selected(),baseline=structuredClone(this.saved[0]);
  const compared=await compareExplorationSnapshots(baseline,selected);
  if(index!==this.select.value)throw Error('Scenario selection changed during comparison.');
  this.comparison=compared;
  this.comparisonText.textContent='SAVED SCENARIOS: '+compared.baselineLabel+' → '+compared.scenarioLabel+'\n\n'+
   (compared.entries.length?compared.entries.map(r=>r.id+' ('+r.kind+'): '+r.comparison+'\n'+
     (r.reason?r.reason+'\n':'')+'Baseline: '+JSON.stringify(r.baselineValue??null)+' | Scenario: '+JSON.stringify(r.scenarioValue??null)+
     (r.unit?' '+r.unit:'')+(r.delta!==null&&r.delta!==undefined?' | Sampled delta: '+r.delta:'')).join('\n\n'):'No matching requested readouts. Add explicit observations to the baseline before comparing them.')+'\n\n'+compared.notice;
  this.comparisonText.dataset.report=JSON.stringify(compared);
 }
 exportComparison(){if(!this.comparison)throw Error('Compare saved scenarios first.');this.download(json(this.comparison),'opticsim-saved-comparison.json');}
}
