import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { readFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = resolve(root, 'vendor/ray-optics');
const pin = JSON.parse(readFileSync(resolve(root, 'upstream-pin.json')));
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: vendor, encoding: 'utf8' }).trim() !== pin.commit) throw Error('Upstream pin mismatch');
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--'], { cwd: vendor });
const require = createRequire(resolve(vendor, 'package.json'));
const webpack = require('webpack');
const testing = process.argv.includes('--test');
const motion = process.argv.includes('--motion');
if(testing&&motion)throw Error('Build test core and motion UI separately');
const output = resolve(root, 'dist');
mkdirSync(output, { recursive: true });
const stats = await new Promise((accept, reject) => {
  const compiler = webpack({
    mode: 'production', target: testing ? 'node' : 'web', context: root,
    entry: resolve(root, testing ? 'src/test-entry.js' : motion ? 'src/motion-app.js' : 'src/app.js'),
    output: { path: output, filename: testing ? 'test-core.cjs' : motion ? 'motion.js' : 'app.js', ...(testing ? { library: { type: 'commonjs2' } } : {}) },
    optimization: { minimize: false }, performance: { hints: false },
    resolve: { modules: [resolve(vendor, 'node_modules'), 'node_modules'], alias: { mathjs: resolve(vendor, 'node_modules/mathjs') } },
    resolveLoader: { modules: [resolve(vendor, 'node_modules')] },
    module: { rules: [{ test: /\.html$/, use: 'html-loader' }, { test: /\.(png|jpg)$/, type: 'asset/resource' }, { test: /\.svg$/, type: 'asset/inline' }] }
  });
  compiler.run((error, result) => compiler.close(closeError => error || closeError ? reject(error || closeError) : result.hasErrors() ? reject(Error(result.toString({ all: false, errors: true }))) : accept(result)));
});
if (!testing) {
  for (const name of (motion ? ['motion.html','motion.css'] : ['index.html', 'style.css'])) copyFileSync(resolve(root, 'public', name), resolve(output, name));
  mkdirSync(resolve(output, 'scenes'), { recursive: true });
  for (const name of readdirSync(resolve(root, 'scenes'))) copyFileSync(resolve(root, 'scenes', name), resolve(output, 'scenes', name));
  // Preserve upstream notices plus license texts for packages included in this bundle.
  const packages = new Set([vendor]);
  for (const module of stats.compilation.modules) {
    let directory = module.resource && dirname(module.resource.split('?')[0]);
    if (!directory?.includes('node_modules')) continue;
    while (directory.startsWith(vendor)) {
      if (existsSync(resolve(directory, 'package.json')) && JSON.parse(readFileSync(resolve(directory, 'package.json'))).name) { packages.add(directory); break; }
      directory = dirname(directory);
    }
  }
  const notices = [];
  for (const directory of packages) {
    const info = JSON.parse(readFileSync(resolve(directory, 'package.json')));
    const label = directory === vendor ? 'phydemo' : info.name.replaceAll('/', '__');
    const destination = resolve(output, 'licenses', label);
    mkdirSync(destination, { recursive: true });
    const files = readdirSync(directory).filter(name => /^(licen[sc]e|notice|copying|copyright|citation)(\.|$|[-_])/i.test(name));
    if (!files.length) {
      // Some npm archives keep their license/attribution only in README/source headers.
      for (const name of ['README.md', 'package.json']) if (existsSync(resolve(directory, name))) files.push(name);
    }
    for (const name of files) copyFileSync(resolve(directory, name), resolve(destination, name));
    notices.push(`${info.name}@${info.version}: ${info.license || 'see package source'}; ${files.join(', ') || 'license text unavailable at package root'}`);
  }
  copyFileSync(resolve(root, 'third_party/ADDITIONAL-MIT-NOTICES.txt'), resolve(output, 'licenses/ADDITIONAL-MIT-NOTICES.txt'));
  notices.push('Additional MIT notices: ADDITIONAL-MIT-NOTICES.txt (bezier-js, javascript-natural-sort, seedrandom). Original source headers are retained in the unminified bundle.');
  writeFileSync(resolve(output, 'licenses', 'INDEX.txt'), notices.sort().join('\n') + '\n');
}
console.log(`Built ${testing ? 'headless test core' : 'local browser app'} from ${pin.commit} (${stats.compilation.modules.size} modules).`);
