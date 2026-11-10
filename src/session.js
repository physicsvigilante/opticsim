import { validate } from './contract.js';
import { predict } from './analysis.js';
import { classifyRun } from './adapter.js';
// The document is the only authored state. Runs and predictions belong to a revision.
export class Session {
  constructor(prepare, changed, analyze = predict) {
    this.prepare = prepare; this.changed = changed; this.analyze = analyze;
    this.revision = 0; this.state = 'empty'; this.prediction = null;
    this.analysisStatus = 'unavailable'; this.analysisReason = 'No accepted scene.';
  }
  cancel() { this.runner?.cancel(); this.runner = null; }
  suppressAnalysis(reason) {
    this.prediction = null; this.analysisStatus = 'suppressed'; this.analysisReason = reason;
  }
  invalidate(error) {
    this.cancel(); this.revision++; this.state = 'invalid'; this.suppressAnalysis('The current scene is invalid.');
    this.data = null; this.error = error.message; this.changed(this);
  }
  apply(candidate) {
    let runner;
    try { validate(candidate); runner = this.prepare(candidate); }
    catch (error) { this.invalidate(error); return false; }
    this.cancel();
    this.document = structuredClone(candidate); this.runner = runner;
    const revision = ++this.revision;
    this.state = 'running'; this.prediction = null; this.error = null; this.data = null;
    this.analysisStatus = 'unavailable'; this.analysisReason = null;
    try {
      const prediction = this.analyze(candidate);
      if (!prediction || prediction.kind === 'unavailable') this.analysisReason = prediction?.reason || 'No analytical prediction is available.';
      else { this.prediction = prediction; this.analysisStatus = 'available'; }
    } catch (error) {
      // Analytical failure is not a native tracing or authoring failure.
      this.analysisStatus = 'failed'; this.analysisReason = error.message;
    }
    this.changed(this);
    try {
      runner.run((event, data) => {
        if (revision !== this.revision || this.state !== 'running') return;
        this.data = data;
        this.state = classifyRun(event, data);
        if (!['completed', 'completed-with-warnings'].includes(this.state)) this.suppressAnalysis(`Native simulation is ${this.state}.`);
        this.changed(this);
      });
    } catch (error) {
      this.cancel(); this.state = 'failed'; this.error = error.message; this.suppressAnalysis('Native simulation failed.'); this.changed(this);
    }
    return true;
  }
  stop() {
    if (this.state !== 'running') return;
    this.cancel(); this.revision++; this.state = 'stopped'; this.suppressAnalysis('Native simulation is stopped.'); this.changed(this);
  }
}
