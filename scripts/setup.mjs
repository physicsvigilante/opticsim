import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = resolve(root, 'vendor/ray-optics');
const pin = JSON.parse(readFileSync(resolve(root, 'upstream-pin.json')));
const env = { ...process.env, GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'url.https://github.com/.insteadOf',
  GIT_CONFIG_VALUE_0: 'ssh://git@github.com/', GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never',
  npm_config_cache: resolve(root, '.npm-cache') };
function run(command, args, cwd = root) {
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
}
if (!existsSync(vendor)) run('git', ['clone', '--branch', pin.release, '--depth', '1', pin.repository, vendor]);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: vendor, encoding: 'utf8' }).trim();
if (sha !== pin.commit) throw Error(`Upstream revision mismatch: ${sha}; expected ${pin.commit}. No automatic reset performed.`);
run('git', ['diff', '--exit-code', 'HEAD', '--'], vendor);
// Invoke npm through its JS entry to avoid Windows .cmd shell quoting.
const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw Error('Run this setup using npm run setup.');
run(process.execPath, [npmCLI, 'ci', '--omit=optional', '--no-audit', '--no-fund'], vendor);
run('git', ['diff', '--exit-code', 'HEAD', '--'], vendor);
console.log(`Pinned PhyDemo ready: ${sha}`);
