import {isCurved} from './curved-mirrors.js';
import {QualifiedUI} from './qualified-ui.js';
import { loadDocument, Simulator, diagnostics, nativeExport, observeSourceSet, observeMirrorSet, observeDetectorSet, observeInterfaceSet } from './adapter.js';
import { parseSave, serializeSave, SAMPLING_PRESETS, samplingPreset, setSourceMode } from './contract.js';
import { Session } from './session.js';
import pointSourceIcon from '../vendor/ray-optics/src/img/PointSource.svg';
import angleSourceIcon from '../vendor/ray-optics/src/img/AngleSource.svg';
import raysIcon from '../vendor/ray-optics/src/img/rays_icon.svg';
import extendedIcon from '../vendor/ray-optics/src/img/extended_icon.svg';
const $ = id => document.getElementById(id);
$('view-rays-icon').src = raysIcon;
$('view-extended-icon').src = extendedIcon;
const canvases = ['light', 'below', 'above', 'grid'].map($);
let size = { width: 1200, height: 700 };
let scheduled;
let bindings = [];
let activeSourceId = null; // UI selection only; not part of authoritative scene JSON.
function cancelScheduled() { clearTimeout(scheduled); scheduled = undefined; }
const session = new Session(doc => {
  const { scene, idMap } = loadDocument(doc, size.width, size.height);
  const meter = observeSourceSet(doc, scene, idMap);
  const mirrorMeter = observeMirrorSet(doc, scene, idMap);
  const detectorMeter = observeDetectorSet(doc, scene, idMap);
  const interfaceMeter = observeInterfaceSet(doc, scene, idMap);
  const sim = new Simulator(scene, ...canvases.map(c => c.getContext('2d')), null, true, doc.simulation.processedRayLimit);
  const cancel = () => {
    if (sim.simulationTimerId !== -1) clearTimeout(sim.simulationTimerId);
    sim.simulationTimerId = -1; sim.shouldSimulatorStop = true;
  };
  return { scene, cancel, run: notify => {
    for (const event of ['simulationComplete', 'simulationStop']) sim.on(event, () => notify(event, diagnostics(scene, sim, meter, mirrorMeter, detectorMeter, interfaceMeter)));
    sim.updateSimulation(false, false);
  } };
}, update);
const qualificationUI = new QualifiedUI(session, download);
function update() {
  qualificationUI.refresh();
  const state = session.state;
  $('status').textContent = state.replaceAll('-', ' ');
  $('status').dataset.state = state;
  $('revision').textContent = `Revision ${session.revision}`;
  $('error').textContent = session.error || '';
  $('error').hidden = !session.error;
  $('stop').disabled = state !== 'running';
  $('rerun').disabled = !session.document || state === 'invalid';
  for (const id of ['save', 'export']) $(id).disabled = !session.document || state === 'invalid';
  $('sampling').disabled = !session.document;
  for (const mode of ['rays', 'extended']) {
    $(`mode-${mode}`).disabled = !session.document || state === 'invalid';
    $(`mode-${mode}`).checked = session.document?.presentation.mode === mode;
  }
  $('stage').classList.toggle('invalid', ['invalid', 'failed'].includes(state));
  const d = session.data;
  const mixed = session.document?.physics.model === 'lens-mirror-return-geometric';
  const mirror = session.document?.physics.components.some(c => c.type === 'plane-mirror'||isCurved(c.type));
  const hasOptics = session.document?.physics.components.some(c =>
    c.type==='ideal-lens'||c.type==='plane-mirror'||c.type==='circular-dielectric'||isCurved(c.type));
  const partial = !['completed', 'completed-with-warnings'].includes(state);
  const perMirror = d?.reflectionsById ? Object.entries(d.reflectionsById)
    .map(([id,count])=>id+': '+count).join(' · ') : '';
  const sources = session.document?.physics.components.filter(c=>c.type==='point-source') || [];
  const complete = ['completed','completed-with-warnings'].includes(state);
  $('source-emissions').hidden = sources.length < 2 || state === 'invalid';
  $('source-emissions').textContent = sources.length < 2 ? '' :
    !d || !complete ? 'Per-source emission counts pending or incomplete; no current totals are published.' :
    Object.entries(d.emissionsById || {}).map(([id,reading]) =>
      id+': '+reading.emitted+' native rays'+
      (Number.isFinite(reading.brightnessScale) ? ' · native brightness scale '+format(reading.brightnessScale) : '')
    ).join('  |  ');
  $('stats').textContent = d ? `${d.emitted} rays emitted · ${d.processed} segments processed${d.reflections != null ? ` · ${d.reflections} native reflections${partial ? ' (partial run)' : ''}${perMirror ? ' (' + perMirror + ')' : ''}` : ''} · truncated brightness ${d.truncation.toPrecision(3)} · undefined brightness ${d.undefinedBehavior.toPrecision(3)}` : session.document ? `Native emission pending · ${session.document.simulation.processedRayLimit} segment limit` : 'Loading scene';
  const detectors = session.document?.physics.components.some(c=>c.type==='ray-detector');
  $('detector-readouts').hidden = !detectors || state==='invalid';
  $('detector-readouts').textContent = !detectors ? '' :
    !d || !['completed','completed-with-warnings'].includes(state) ?
      'Ray detector readings pending or incomplete. No current measurement is published.' :
    Object.entries(d.detectorsById || {}).map(([id,r])=>
      id+': '+r.crossings+' native crossings · signed detector power '+
      (r.signedPower===null?'unavailable':format(r.signedPower))+' (relative native units)').join('  |  ');
  $('sampling-note').textContent = ['planar-media-tracing','circular-dielectric-tracing'].includes(session.document?.physics.model) ?
    'Each single-ray source emits one exact native ray. Sampling density does not widen it into a cone; change its explicit direction to investigate incidence.' : d && d.emitted < 3 ?
    !hasOptics ? `Only ${d.emitted} native ray${d.emitted===1?'':'s'} emitted; increase sampling to inspect free-space propagation.` :
    `Only ${d.emitted} native ray${d.emitted===1?'':'s'} emitted. This cone is sparsely sampled and may miss the ${mixed ? 'lens or mirror' : mirror ? 'mirror' : 'lenses'}. Increase sampling or opening angle to inspect more rays.` :
    'Sampling changes the angular spacing, not the optical model.';
  $('reflection-note').textContent = mirror ? !d ? state === 'running' ? 'Native reflection count pending for this revision.' : 'No current reflection count is available.' : partial ? 'Reflection counts are partial; the simulation is incomplete.' :
    d.reflections === 0 ? `No sampled rays reflected. ${session.prediction ? 'The analytical image is conditional; this run does not establish a simulated image.' : 'This run does not establish a simulated image.'}` :
    `${d.reflections} sampled ray${d.reflections === 1 ? '' : 's'} reflected. This count does not establish an image or guarantee ${mixed ? 'the lens → mirror → lens path or ' : ''}continuous-cone coverage.` : '';
  $('brightness-note').textContent = d && d.brightnessScale > 0 && d.brightnessScale < 1 ? `Native brightness scale ${format(d.brightnessScale)}: intensity is clipped at this sampling level. This is separate from ray truncation and completion.` : '';
  if (session.document && state !== 'invalid') syncSampling();
  $('warnings').textContent = [...(d?.errors || []), ...(d?.warnings || [])].join('\n');
  if (['stopped', 'incomplete', 'failed'].includes(state)) $('warnings').textContent += '\nSimulation incomplete. Partial rays do not represent a complete run.';
  const p = session.prediction;
  $('analysis-status').textContent = `Analysis: ${session.analysisStatus}. Native simulation: ${state.replaceAll('-', ' ')}.`;
  $('prediction').replaceChildren();
  if (!p) {
    // The general image predictor belongs to a different scope from
    // hash-bound conditional angular calculations carried in qualification.
    // An incomplete native run does not erase a valid ideal-model calculation.
    const calculations=qualificationUI.qualification?.calculations||[];
    if(calculations.length&&session.document&&state!=='invalid'){
      const revised=qualificationUI.qualification.edits.some(e=>e.kind==='physics');
      const calculationType=calculations.some(c=>c.kind.startsWith('curved-mirror-'))?'curved-mirror':'angular';
      $('analysis-status').textContent='General image analysis: '+
        session.analysisStatus+'. Attached conditional '+calculationType+' calculation: '+
        (revised?'historical after a physical edit':calculations[0].status)+
        '. Native simulation: '+state.replaceAll('-', ' ')+'.';
      $('prediction').textContent=revised?
        'An earlier conditional '+calculationType+' result is preserved in Qualification, but the scene was physically revised. Recompute for the current scene.':
        'A separate conditional '+calculationType+' calculation is available in Qualification above. It is not a native ray observation or image detection.';
      $('prediction-note').textContent='General image prediction and the attached ideal-model angular calculation use different methods. Native tracing is '+
        state.replaceAll('-', ' ')+'. Its incomplete or missing ray branches are not described as successful native results.';
      return;
    }
    $('prediction').textContent = session.analysisStatus === 'failed' ? 'Analytical calculation failed.' :
      session.analysisStatus === 'unavailable' ? 'No reliable, route-independent analytical image prediction is available for this scene.' :
      'Prediction unavailable for the current edit or run state.';
    $('prediction-note').textContent = `${session.analysisReason || 'No current analytical result is displayed.'}${['unavailable', 'failed'].includes(session.analysisStatus) && session.document ? ' Native tracing and sandbox save/export remain available for the accepted scene.' : ''}`;
    return;
  }
  const label = document.createElement('strong');
  const mirrorPrediction = p.kind === 'plane-mirror-virtual';
  const returnPrediction = p.kind === 'lens-mirror-return';
  const imageKind = returnPrediction ? p.imageKind : p.kind;
  label.textContent = returnPrediction ? imageKind === 'at-infinity' ? 'Return image at infinity' : imageKind === 'finite-real' ? 'Real return image' : 'Virtual return image' :
    mirrorPrediction ? 'Analytical virtual-image prediction' : imageKind === 'at-infinity' ? 'Image at infinity' : imageKind === 'finite-real' ? 'Real image' : 'Virtual image';
  $('prediction').append(label);
  const details = document.createElement('p');
  details.textContent = mirrorPrediction ? `x = ${format(p.x)} mm · y = ${format(p.y)} mm\nSource and image normal distances = ${format(p.normalDistance)} mm each, on opposite sides of the mirror line.` : imageKind === 'at-infinity' ? `${returnPrediction ? 'Collimated left-going return output.' : 'Collimated output.'} No finite image position or transverse magnification. Numerical infinity tolerance: 1e−10 on the scaled matrix denominator.` :
    `x = ${format(p.x)} mm · y = ${format(p.y)} mm\nMagnification = ${format(p.magnification)}×${returnPrediction ? `\nReturn travel distance = ${format(p.distance)} mm along −x from the lens (negative means a virtual image to its right).` : ''}`;
  $('prediction').append(details);
  $('prediction-note').textContent = returnPrediction ?
    `Analytical prediction for ${p.path.join(' → ')} at revision ${session.revision}. Conditional on rays hitting the lens, mirror and same lens in that order, with left-going output. PhyDemo determines actual intersections: finite components, the cone and sampling can miss this path. Some rays can miss the first lens and still reflect or meet the lens on return. Reflections, extensions and a completed run do not establish an image or path coverage.` : mirrorPrediction ?
    `Analytical prediction for revision ${session.revision}. Simulation: ${state.replaceAll('-', ' ')}. Conditional on rays striking the finite mirror segment; missed rays continue unchanged. The native mirror reflects from both sides. The virtual point is behind the supporting line relative to the source, not light propagating there or a detected image. The selected cone and sampling may produce no reflections.` :
    `Analytical ideal-lens prediction for revision ${session.revision}. Simulation: ${state.replaceAll('-', ' ')}. Conditional on rays through all lenses: the selected cone and samples may not illuminate this image or even hit the first lens. Rays missing a lens are not blocked.`;
}
function format(n) { return Number(n.toPrecision(7)).toString(); }
function controls() {
  $('controls').replaceChildren();
  $('source-tools').replaceChildren();
  $('source-parameters').replaceChildren();
  bindings = [];
  const sourceList=session.document.physics.components.filter(c=>c.type==='point-source');
  if(!sourceList.some(c=>c.id===activeSourceId)) activeSourceId=sourceList[0].id;
  const multipleSources=sourceList.length>1;
  if(multipleSources){
    const chooser=document.createElement('label'); chooser.className='active-source-picker';
    chooser.textContent='Edit light source';
    const select=document.createElement('select'); select.id='active-source';
    for(const source of sourceList) {
      const option=document.createElement('option');
      option.value=source.id;option.textContent=source.id;
      select.append(option);
    }
    select.value=activeSourceId;
    select.onchange=()=>{
      const wanted=select.value;
      if(scheduled) {
        cancelScheduled();commitDraft();
        if(session.state==='invalid')return;
      }
      activeSourceId=wanted;
      controls(); // Selection is a local UI action, not a new physics revision.
    };
    chooser.append(select);$('source-tools').append(chooser);
  }
  const mixed = session.document.physics.model === 'lens-mirror-return-geometric';
  const planar = session.document.physics.model === 'planar-media-tracing';
  const circular = session.document.physics.model === 'circular-dielectric-tracing';
  const curved = session.document.physics.model === 'curved-mirror-tracing';
  const general = session.document.physics.model === 'general-component-tracing';
  const tracing = general || session.document.physics.model === 'mixed-lens-mirror-tracing';
  const labels = { radius:circular?'Circle radius (positive)':'Signed curvature radius',insideIndex:'Inside refractive index',outsideIndex:'Outside refractive index',normalDeg:'Normal direction',negativeIndex:'Negative-side index',positiveIndex:'Positive-side index',x: 'Position x', y: 'Position y', focalLength: 'Focal length', apertureHeight: 'Aperture height', orientationDeg: 'Surface orientation', length: 'Length' };
  for (const component of session.document.physics.components) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend'); legend.textContent = component.id;
    const caption = document.createElement('p'); caption.className = 'component-type'; caption.textContent = component.type;
    fieldset.append(legend, caption);
    if (component.type === 'point-source' && component.id === activeSourceId)
      $('source-tools').append(sourcePicker(component));
    for (const [key, value] of Object.entries(component.parameters)) {
      if(key==='partialReflection'){
        const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id=component.id+'-'+key;input.checked=value;
        label.textContent='Include native Fresnel partial reflections';label.append(input);fieldset.append(label);
        bindings.push({id:component.id,section:'parameters',key,input});input.onchange=()=>{cancelScheduled();commitDraft();};continue;
      }
      const slider = key === 'brightness' ? { min: 0.01, max: 1, step: 0.01 } :
        ['plane-mirror','ray-detector'].includes(component.type) ?
        { min: key === 'length' ? 1 : key === 'orientationDeg' ? -180 : -10000, max: key === 'orientationDeg' ? 180 : 10000, step: 1 } : null;
      const fixed = mixed && component.type === 'plane-mirror' && ['y', 'orientationDeg'].includes(key);
      addNumber(component.type === 'point-source' && key === 'brightness' && !multipleSources ?
        $('source-parameters') : fieldset, component.id, 'parameters', key,
        key === 'brightness' ? 'Brightness (relative)' : `${labels[key]} (${['orientationDeg','normalDeg'].includes(key) ? '°' : ['negativeIndex','positiveIndex','insideIndex','outsideIndex'].includes(key)?'dimensionless':'mm'})`, value, slider, fixed);
    }
    if (component.type === 'plane-mirror') {
      const note = document.createElement('p'); note.className = 'muted';
      note.textContent = mixed ? 'Return layout fixes centre y=0 and perpendicular orientation ±90°. Mirror x and finite length remain editable. The same lens is used on both encounters.' : 'Position is the segment centre. Surface tangent: 0° horizontal · 90° vertical · +45° rises right. Reflects from both sides.';
      fieldset.append(note);
    }
    if(isCurved(component.type)){
      const note=document.createElement('p');note.className='muted';
      note.textContent=component.type==='ideal-curved-mirror'?
        'Native IdealMirror: ideal Gaussian mapping, not a circular surface. Positive f concave, negative f convex; normal defines the front side.':
        'Native ArcMirror: circular geometry and local-normal reflection. Positive radius concave toward front; negative convex. Gaussian image prediction is paraxial, not exact finite-aperture ray intersection.';
      fieldset.append(note);
    }
    if(component.type==='circular-dielectric'){
      const note=document.createElement('p');note.className='muted';
      note.textContent='One homogeneous circular region, 2D cross section. Both indices are explicit; native CircleGlass uses their ratio. Fresnel off omits partial reflections, not TIR. No detected-image or 3D-sphere claim.';fieldset.append(note);
    }
    if(component.type==='planar-interface'){
      const note=document.createElement('p');note.className='muted';
      note.textContent='Infinite plane. Normal points from negative to positive side; indices are explicit. Unchecking Fresnel is a transmitted-only approximation, not a complete dielectric model. TIR remains native. Parallel layers require matching adjacent indices.';fieldset.append(note);
    }
    if (component.type === 'ray-detector') {
      const note = document.createElement('p'); note.className = 'muted';
      note.textContent = 'Passive native detector. Orientation is its surface tangent; signed power uses native relative units and can cancel across directions. Crossing count is sampled, not continuous throughput.';
      fieldset.append(note);
    }
    if (component.type === 'point-source') {
      const disabled = component.emission.mode !== 'directional';
      const sourceParent=multipleSources ? fieldset : $('source-parameters');
      addNumber(sourceParent, component.id, 'emission', 'angleDeg', 'Opening angle (°)', component.emission.angleDeg, { min: 1, max: 180, step: 1 }, disabled);
      addNumber(sourceParent, component.id, 'emission', 'directionDeg', 'Direction (°)', component.emission.directionDeg, { min: -180, max: 180, step: 1 }, component.emission.mode==='full-circle');
      const note = document.createElement('p'); note.className = 'muted';
      note.textContent = (planar||circular) ? 'One exact native ray; the cone-angle field is inactive. 0° right · +90° up · −90° down.' : (multipleSources ? 'Use the toolbar to select this source for Full-circle / Directional mode. ' : '')+
        '0° right · +90° up · −90° down. Opening is the full cone angle. Selecting Directional starts at Medium global sampling.';
      fieldset.append(note);
    }
    $('controls').append(fieldset);
  }
  $('title').textContent = session.document.presentation.title;
  const mirror = session.document.physics.model === 'plane-mirror-geometric';
  $('model-label').textContent = circular?'Circular dielectric · native local-normal refraction':curved?'Curved mirrors · distinct ideal / circular models':planar?'Planar refractive media · native tracing':mixed ? 'Lens / mirror return · geometric optics' : general ? 'General component tracing' : tracing ? 'Mixed lens / mirror tracing' : mirror ? 'Plane mirror · geometric optics' : 'Ideal lenses · geometric optics';
  $('parameter-guidance').textContent = `Lengths in mm. x points right; y points up. ${circular?'One circular region; 1–4 exact rays inside or outside; up to two external detectors. Explicit inside/outside indices and positive radius.':curved?'1–2 curved mirrors, 1–4 sources and separate plane mirrors/detectors. Normal points to the declared front; signed radius is not focal length.':planar?'1–4 exact single rays; 1–4 parallel interfaces with consistent indices; finite surfaces cannot cross an interface.':mixed ? 'Source left of lens left of perpendicular mirror; lens and mirror share y=0.' : general ? '1–4 sources, up to four coaxial lenses, four mirrors and two detectors; finite surfaces must not intersect.' : tracing ? '1–4 independent point sources, 1–4 coaxial lenses and 1–4 plane mirrors; finite optical surfaces must not intersect.' : mirror ? 'Mirror orientation describes the surface tangent.' : 'Lenses share the horizontal axis.'}`;
  $('physical-note').textContent = circular?'Native CircleGlass chooses intersections and refracts at the actual local normal. Fresnel-off is an explicit approximation; TIR remains active. Truncated or undefined runs suppress requested readings, even after a native completion callback. No image solver, nested media, cap geometry, light speed or 3D imaging is implied.':curved?'Native IdealMirror obeys an ideal mapping; ArcMirror reflects from a circular surface and can exhibit spherical aberration. No calculated image is a native detection. Finite mirrors may be missed; conservative aperture separation is enforced.':planar?'Native PlaneGlass uses relative index ratios to represent the stated media. Native Fresnel branches and TIR are observed without rerouting. Transmitted-only mode is an explicit approximation. Weak-branch/depth truncation suppresses requested results. No time-of-flight, phase, dispersion or image solver is exposed.':mixed ? 'One native lens can be encountered in both directions. PhyDemo chooses every intersection; finite lens/mirror misses are not blocked. Positive f converges; negative f diverges.' : general ? 'Native PhyDemo traces each supported component and all actual intersections. Sources need not encounter a lens or mirror. Analytic image predictions are unavailable without a justified optical path; counts and detector readings are sampled observations, not image detection.' : tracing ? 'PhyDemo chooses each hit; analytical image predictions are intentionally unavailable without a specified optical path. Reflection totals and per-mirror counts describe sampled native encounters, not image formation.' : mirror ? 'The finite native mirror reflects from both sides. Rays missing its segment continue unchanged. Edit physical values here; the canvas is a simulation view.' : 'Positive focal length converges. Negative focal length diverges. Edit physical values here; the canvas is a simulation view.';
  $('grid-toggle').checked = session.document.presentation.grid;
  $('zoom').value = session.document.presentation.view.zoom;
  syncSampling();
}
function sourcePicker(component) {
  const choices = [5,7].includes(session.document.schemaVersion)?[{mode:'single-ray',title:'Single ray (native)',description:'One exact direction; sampling density does not create a cone',icon:angleSourceIcon}]:[
    { mode: 'full-circle', title: 'Point source (360°)', description: 'Light in every direction', icon: pointSourceIcon },
    { mode: 'directional', title: 'Point source (directional)', description: 'Symmetric cone · 1–180°', icon: angleSourceIcon }
  ];
  if(session.document.schemaVersion===6)choices.push({mode:'single-ray',title:'Single ray (native)',description:'One exact direction; no cone from sampling',icon:angleSourceIcon});
  const details = document.createElement('details'); details.className = 'source-picker';
  const summary = document.createElement('summary'); summary.id = `${component.id}-mode`;
  const heading = document.createElement('span');
  heading.textContent = session.document.physics.components.filter(c=>c.type==='point-source').length>1 ?
    'Light Source · '+component.id : 'Light Source';
  const selected = document.createElement('small'); selected.textContent = choices.find(c => c.mode === component.emission.mode).title;
  summary.append(heading, selected);
  const menu = document.createElement('div'); menu.className = 'source-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Light Source');
  for (const choice of choices) {
    const button = document.createElement('button'); button.type = 'button'; button.id = `${component.id}-mode-${choice.mode}`;
    button.setAttribute('role', 'menuitemradio'); button.setAttribute('aria-checked', String(choice.mode === component.emission.mode));
    const icon = document.createElement('img'); icon.src = choice.icon; icon.alt = ''; icon.width = 44; icon.height = 44;
    const text = document.createElement('span'); const title = document.createElement('strong'); title.textContent = choice.title;
    const description = document.createElement('small'); description.textContent = choice.description; text.append(title, description);
    const check = document.createElement('span'); check.className = 'selection-check'; check.textContent = choice.mode === component.emission.mode ? '✓' : ''; check.setAttribute('aria-hidden', 'true');
    button.append(icon, text, check);
    button.onclick = () => {
      try {
        if (apply(setSourceMode(readDraft(), component.id, choice.mode), true)) $(`${component.id}-mode`).focus();
        else { details.open = false; summary.focus(); }
      } catch (error) { cancelScheduled(); session.invalidate(error); details.open = false; summary.focus(); }
    };
    menu.append(button);
  }
  details.append(summary, menu);
  details.onkeydown = event => {
    if (event.key === 'Escape') { details.open = false; summary.focus(); event.preventDefault(); }
    if (details.open && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      const buttons = [...menu.querySelectorAll('button')]; const index = buttons.indexOf(document.activeElement);
      const next = index === -1 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
      buttons[next].focus();
      event.preventDefault();
    }
  };
  return details;
}
document.addEventListener('click', event => {
  for (const picker of document.querySelectorAll('.source-picker[open]')) if (!picker.contains(event.target)) picker.open = false;
});
// Same basic range + editable-number interaction as upstream ObjBar, with all
// writes going through the authored document instead of native object mutation.
function addNumber(parent, id, section, key, text, value, slider = null, disabled = false) {
  const row = document.createElement('div'); row.className = slider ? 'number-pair' : 'number-row';
  const label = document.createElement('label'); label.textContent = text;
  const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = value;
  input.id = `${id}-${key}`; input.disabled = disabled; label.htmlFor = input.id;
  row.append(label, input);
  bindings.push({ id, section, key, input });
  if (slider) {
    const range = document.createElement('input'); range.type = 'range'; range.id = `${input.id}-slider`;
    range.min = slider.min; range.max = slider.max; range.step = slider.step; range.value = value; range.disabled = disabled;
    range.setAttribute('aria-label', `${text} slider`);
    range.oninput = () => { input.value = range.value; queueEdit(); };
    range.onchange = () => { cancelScheduled(); commitDraft(); };
    // The thumb uses its finite step; precise number edits are never read back
    // from the slider, rounded, or clamped into the document.
    input.oninput = () => { if (input.value.trim() && Number.isFinite(Number(input.value))) range.value = input.value; queueEdit(); };
    row.append(range);
  } else input.oninput = queueEdit;
  input.onkeydown = e => { if (e.key === 'Enter') { cancelScheduled(); commitDraft(); } };
  parent.append(row);
}
function readDraft() {
  const candidate = structuredClone(session.document);
  for (const { id, section, key, input } of bindings) {
    const c = candidate.physics.components.find(c => c.id === id);
    c[section][key] = input.type==='checkbox'?input.checked:input.value.trim() === '' ? NaN : Number(input.value);
  }
  return candidate;
}
function commitDraft() {
  scheduled = undefined;
  try { apply(readDraft()); } catch (error) { session.invalidate(error); }
}
function queueEdit() {
  session.invalidate(Error('Editing parameters — waiting for a valid scene.'));
  // Throttle rather than debounce: continuous drags still simulate every 75ms.
  if (!scheduled) scheduled = setTimeout(commitDraft, 75);
}
function syncSampling() {
  const density = session.document.simulation.rayDensity;
  const preset = samplingPreset(density);
  $('sampling-custom').hidden = preset !== 'custom';
  $('sampling-custom').textContent = `Custom (${density})`;
  $('sampling').value = preset;
}
$('sampling').onchange = e => {
  if (!(e.target.value in SAMPLING_PRESETS)) return;
  const candidate = readDraft(); candidate.simulation.rayDensity = SAMPLING_PRESETS[e.target.value]; apply(candidate);
};
function apply(doc, rebuild = false, imported = undefined) {
  cancelScheduled();
  let tracked;
  try { tracked = qualificationUI.prepare(doc, imported); }
  catch (error) { session.invalidate(error); return false; }
  const accepted = session.apply(doc);
  if (accepted) qualificationUI.commit(tracked);
  if (accepted && rebuild) controls();
  return accepted;
}
function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('save').onclick = () => download(serializeSave(session.document), 'scene.ray-optics-2d.json');
$('export').onclick = () => { try { download(nativeExport(session.document), 'scene.phydemo.json'); } catch (e) { session.invalidate(e); } };
$('load').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  cancelScheduled();
  const request = ++exampleRequest;
  session.invalidate(Error('Loading sandbox scene…'));
  const loadingRevision = session.revision;
  try { if (file.size > 1024 * 1024) throw Error('Scene file exceeds 1 MB limit');
    const incoming = await qualificationUI.read(await file.text());
    if (request === exampleRequest && loadingRevision === session.revision && apply(incoming.document, true, incoming)) {
      $('examples').value = '';
      setExampleLink(null); // A local save is not a shareable URL.
    }
  }
  catch (error) { if (request === exampleRequest && loadingRevision === session.revision) session.invalidate(error); }
  event.target.value = '';
});
let exampleRequest = 0;
// Share only an explicitly bundled starting example. The URL never encodes
// current edits or local file contents; use Save sandbox to preserve those.
function isBundledExample(name) {
  return !!name && Array.from($('examples').options)
    .some(option => option.value === name && !option.disabled);
}
function setExampleLink(name) {
  const supported = isBundledExample(name);
  const link = $('example-link');
  link.hidden = !supported;
  const url = new URL(window.location.href);
  url.search = ''; // Share only this allowlisted example, never unrelated URL parameters.
  if (supported) url.searchParams.set('scene', name);
  else url.searchParams.delete('scene');
  url.hash = '';
  if (supported) link.href = url.href;
  window.history.replaceState(null, '', url.pathname + url.search);
}
async function example(name) {
  if (!isBundledExample(name)) {
    session.invalidate(Error('Unknown bundled example.'));
    return;
  }
  const request = ++exampleRequest;
  cancelScheduled();
  session.invalidate(Error('Loading example scene…'));
  try { const response = await fetch(`scenes/${name}.json`); if (!response.ok) throw Error('Scene could not be loaded');
    const doc = parseSave(await response.text());
    if (request === exampleRequest && apply(doc, true, {qualification:null, requests:[]})) {
      $('examples').value = name;
      setExampleLink(name);
    }
  } catch (error) { if (request === exampleRequest) session.invalidate(error); }
}
$('examples').onchange = e => example(e.target.value);
$('stop').onclick = () => session.stop();
$('rerun').onclick = () => apply(session.document);
function viewChange(change) {
  if (!session.document || session.state === 'invalid') return;
  const next = structuredClone(session.document); change(next.presentation); apply(next);
}
for (const mode of ['rays', 'extended']) $(`mode-${mode}`).onchange = e => {
  if (e.target.checked) viewChange(p => { p.mode = mode; });
};
$('grid-toggle').onchange = e => viewChange(p => { p.grid = e.target.checked; });
$('zoom').oninput = e => viewChange(p => { p.view.zoom = Number(e.target.value); });
for (const [id, dx] of [['pan-left', -100], ['pan-right', 100]]) $(id).onclick = () => viewChange(p => { p.view.x += dx; });
function resize() {
  const rect = $('stage').getBoundingClientRect();
  const nextSize = { width: Math.max(200, Math.round(rect.width)), height: Math.max(200, Math.round(rect.height)) };
  // ResizeObserver may notify after UI-only layout work even when the rounded
  // drawing viewport is unchanged. Do not clear canvases or invent a new run.
  if (nextSize.width === size.width && nextSize.height === size.height &&
      canvases.every(canvas => canvas.width === nextSize.width && canvas.height === nextSize.height)) return;
  size = nextSize;
  for (const canvas of canvases) { canvas.width = size.width; canvas.height = size.height; }
  if (session.document && session.state !== 'invalid') apply(session.document);
}
let resizeTimer;
new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 100); }).observe($('stage'));
const requestedExample = new URL(window.location.href).searchParams.get('scene');
resize(); example(isBundledExample(requestedExample) ? requestedExample : 'single-lens');
