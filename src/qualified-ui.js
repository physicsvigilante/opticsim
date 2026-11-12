// UI adapter for qualified packages. Imports are untrusted data; render text only.
import {parseSave,validate} from './contract.js';
import {bundleFormat,parseQualifiedBundle,createQualifiedBundle,
  recordQualifiedEdit,qualificationSummary} from './qualification.js';
import {evaluateObservables} from './observables.js';
import {sceneHash} from './qualified-utils.js';
import {fitRequestedView,formatRequestedResult} from './result-preview.js';
const $=id=>document.getElementById(id);
export class QualifiedUI {
  constructor(session,download){
    const button=document.createElement('button');button.id='fit-results';button.disabled=true;
    button.textContent='Fit apparatus and requested results';
    const note=document.createElement('p');note.id='fit-note';note.className='muted';note.setAttribute('role','status');
    const stage=$('stage');stage.before(button,note);
    this.applyView=doc=>{
      const tracked=this.prepare(doc);
      if(!this.session.apply(doc))return false;
      this.commit(tracked);$('zoom').value=doc.presentation.view.zoom;return true;
    };this.currentResults=null;this.resultRevision=null;this.fitRevision=null;
    this.session=session;this.download=download;this.qualification=null;this.requests=[];this.sequence=0;
    $('fit-results').onclick=()=>this.fit().catch(e=>{$('fit-note').textContent=e.message;});
    $('save-qualified').onclick=()=>this.save().catch(e=>{$('qualification-error').textContent=e.message;});
  }
  async read(text){
    const parsed=JSON.parse(text);
    if(parsed.format===bundleFormat){
      const bundle=await parseQualifiedBundle(text);
      return {document:bundle.scene,qualification:bundle.qualification,requests:bundle.observables};
    }
    return {document:parseSave(text),qualification:null,requests:[]};
  }
  prepare(doc,imported){
    validate(doc);
    if(imported!==undefined)return {qualification:imported.qualification,requests:imported.requests};
    return {qualification:this.qualification&&this.session.document?
      recordQualifiedEdit(this.session.document,doc,this.qualification):null,requests:this.requests};
  }
  commit(next){
    this.qualification=next.qualification;this.requests=next.requests;
    $('qualification-error').textContent='';this.refresh();
  }
  async save(){
    const s=this.session;
    if(!this.qualification||!s.document||s.state==='invalid')throw Error('No accepted qualified scene is available');
    const revision=s.revision,doc=structuredClone(s.document),q=structuredClone(this.qualification),requests=structuredClone(this.requests);
    const bundle=await createQualifiedBundle(doc,q,requests);
    if(revision!==s.revision)throw Error('Scene changed during export; export the current revision again');
    this.download(JSON.stringify(bundle,null,2)+'\n','scene.qualified.json');
  }
  async fit(){
    const s=this.session,canvas=$('light');
    if(!s.document||!['completed','completed-with-warnings'].includes(s.state))throw Error('Fit requires a completed current run');
    if(this.requests.length&&this.resultRevision!==s.revision)throw Error('Requested results are not current yet');
    const revision=s.revision,width=canvas.width,height=canvas.height;
    const fitted=await fitRequestedView(s.document,this.currentResults,width,height);
    if(revision!==s.revision||width!==canvas.width||height!==canvas.height)throw Error('Scene or viewport changed during fit; retry on the current view');
    if(!this.applyView(fitted.document))throw Error('Presentation edit was not accepted');
    this.fitRevision=s.revision;$('fit-note').textContent=fitted.note;
  }
  refresh(){
    const s=this.session,sequence=++this.sequence;
    this.currentResults=null;this.resultRevision=null;
    delete $('observable-results').dataset.results;
    $('fit-results').disabled=true;
    if(this.fitRevision!==s.revision)$('fit-note').textContent='';
    $('save-qualified').disabled=!this.qualification||!s.document||s.state==='invalid';
    const info=s.document?qualificationSummary(s.document,this.qualification):{status:'unknown',text:'No accepted scene.'};
    if(s.state==='invalid'&&this.qualification){info.status='suspended';info.text='Current edit/import is invalid. Historical assumptions below belong to the last accepted scene, not a current result.';}
    $('qualification-status').textContent='Qualification: '+info.status;
    $('qualification-status').dataset.state=info.status;
    $('qualification-note').textContent=info.text+' Native completion is not question correctness. Raw sandbox/native exports omit this history.';
    const lines=(info.assumptions||[]).map(a=>a.componentId+'.'+a.key+': assumed '+a.value+' '+a.unit+
      (a.changed?' -> currently '+a.current+' (edited)':'')+'. '+a.purpose);
    for(const note of info.declaredAssumptions||[])lines.push('Author assumption: '+note);
    for(const unknown of info.unknowns||[])lines.push('Unresolved: '+unknown);
    if(info.requestedResult)lines.unshift('Requested question result: '+info.requestedResult);
    $('qualification-details').textContent=lines.join('\n');
    if(!this.requests.length){$('fit-results').disabled=!['completed','completed-with-warnings'].includes(s.state);$('observable-results').textContent='No explicit result requests loaded. This view shows native tracing only.';return;}
    if(!s.document||!['completed','completed-with-warnings'].includes(s.state)){
      $('observable-results').textContent='Requested results suppressed until this revision completes.';return;
    }
    const revision=s.revision,doc=structuredClone(s.document),data=structuredClone(s.data),requests=structuredClone(this.requests),status=s.state;
    $('observable-results').textContent='Checking results for this revision…';
    (async()=>{
      const execution={canonicalSha256:await sceneHash(doc),executionPassed:true,
        native:{status,warnings:data?.warnings||[]},observations:{
          emissionsById:data?.emissionsById,reflectionsById:data?.reflectionsById,detectorsById:data?.detectorsById}};
      const results=await evaluateObservables(doc,requests,execution);
      if(sequence!==this.sequence||revision!==s.revision)return;
      this.currentResults=results;this.resultRevision=revision;
      $('observable-results').dataset.results=JSON.stringify(results.results);
      $('fit-results').disabled=false;
      $('observable-results').textContent=results.results.map(formatRequestedResult).join('\n\n');
      if(s.analysisStatus==='unavailable'&&results.results.some(r=>r.status==='conditional'&&r.kind==='ideal-image')){
        $('prediction').textContent='A conditional image prediction is available in Requested results above.';
        $('prediction-note').textContent='The general scene does not assert a unique optical route. The requested analytical result uses a validated restricted model and its stated illumination/route conditions; it is not a native image detection.';
      }
    })().catch(error=>{
      if(sequence===this.sequence&&revision===s.revision)$('observable-results').textContent='Requested results unavailable: '+error.message;
    });
  }
}
