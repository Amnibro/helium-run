#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {createHash, createPublicKey, verify} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {homedir, platform, arch} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const VERSION = '1.0.0', HERE = dirname(fileURLToPath(import.meta.url)), PUB = 't2R6HP5etMonp9UXAISDymgpLY0JCv-w7kEPRtNJutY', API = process.env.HELIUM_RUN_API || 'https://helium-run.amnibro7.workers.dev', FREE = 25, MAXOUT = 524288;
const CFG = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'helium-run'), CACHE = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'helium-run');
const HC = process.env.HELIUM_HC || join(HERE, 'bin', platform() === 'darwin' ? 'hc' : 'hcn'), LIB = process.env.HELIUM_LIB || join(HERE, 'lib'), INC = process.env.HELIUM_INCLUDE || join(HERE, 'include'), NATIVE = !process.env.HELIUM_C && platform() === 'linux' && arch() === 'x64', V3 = NATIVE && (() => { try { const f = readFileSync('/proc/cpuinfo', 'utf8'); return [' avx2', ' fma', ' bmi2'].every(x => f.includes(x)); } catch { return false; } })();
platform() === 'darwin' && !process.env.HELIUM_HC && spawnSync('xattr', ['-dr', 'com.apple.quarantine', join(HERE, 'bin')], {stdio: 'ignore'});
const PRIMER = () => readFileSync(join(HERE, 'primer.md'), 'utf8');
const b64 = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const readJ = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } }, writeJ = (f, v) => { mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, JSON.stringify(v)); };
export function license(key, pub = process.env.HELIUM_RUN_PUB || PUB, now = Date.now()) {
  const t = String(key || '').replace(/\s+/g, ''), m = /^(AMNIPRO1\.)([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(t);
  if (!m) return null;
  try {
    const ok = verify(null, Buffer.from(m[1] + m[2]), createPublicKey({key: {kty: 'OKP', crv: 'Ed25519', x: pub}, format: 'jwk'}), b64(m[3])), L = JSON.parse(b64(m[2]).toString('utf8'));
    return ok && L.plan === 'helium' && (!L.exp || L.exp > now) ? {...L, key: t} : null;
  } catch { return null; }
}
let TRIED = 0;
async function current(now = Date.now()) {
  const e = L => L.exp || Infinity, L = [process.env.HELIUM_RUN_KEY, readJ(join(CFG, 'license.json'), {}).key].map(k => license(k, undefined, 0)).filter(Boolean).sort((a, b) => e(b) - e(a))[0], ok = L => L && e(L) > now ? L : null;
  if (!L || e(L) - now > 3 * 864e5 || now - TRIED < 36e5) return ok(L);
  TRIED = now;
  try { const r = await fetch(API + '/renew', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({key: L.key}), signal: AbortSignal.timeout(7000)}), j = await r.json(), N = license(j.key); if (N) { writeJ(join(CFG, 'license.json'), {key: N.key}); return N; } } catch {}
  return ok(L);
}
export function meter(paid, day = new Date().toISOString().slice(0, 10), file = join(CFG, 'usage.json')) {
  const u = readJ(file, {}); const n = u.day === day ? u.runs || 0 : 0;
  if (!paid && n >= FREE) return false;
  writeJ(file, {day, runs: n + 1}); return true;
}
function sh(cmd, args, {cwd, input = '', timeout = 10000, env = {}} = {}) {
  return new Promise(res => {
    const t0 = Date.now(), p = spawn(cmd, args, {cwd, env: {...process.env, ...env}, stdio: ['pipe', 'pipe', 'pipe'], detached: platform() !== 'win32'});
    let out = '', err = '', cut = false, killed = false;
    const add = (s, d) => { const v = s + d; if (v.length > MAXOUT) { cut = true; kill(); return v.slice(0, MAXOUT); } return v; };
    const kill = () => { killed = true; try { process.kill(-p.pid, 'SIGKILL'); } catch { try { p.kill('SIGKILL'); } catch {} } };
    const timer = setTimeout(kill, timeout);
    p.stdout.on('data', d => out = add(out, d)); p.stderr.on('data', d => err = add(err, d));
    p.on('error', e => { clearTimeout(timer); res({code: -1, out, err: String(e.message || e), ms: Date.now() - t0}); });
    p.on('close', code => { clearTimeout(timer); res({code: killed && !cut ? 'timeout' : code, out: out + (cut ? '\n[output cut at 512 KB]' : ''), err, ms: Date.now() - t0}); });
    p.stdin.on('error', () => {}); p.stdin.end(input);
  });
}
async function compile(code, syntax) {
  const ext = syntax === 'he' ? 'he' : 'amni', h = createHash('sha256').update(VERSION + ext + code).digest('hex').slice(0, 24), dir = join(CACHE, h), exe = join(dir, 'prog');
  if (existsSync(exe)) return {exe, dir, cached: true, ms: 0};
  mkdirSync(dir, {recursive: true}); writeFileSync(join(dir, 'main.' + ext), code);
  const b = (cmd, args) => sh(cmd, args, {cwd: dir, timeout: 120000, env: {HC_LIB: LIB}});
  let r = await b(HC, ['build', 'main.' + ext, '-o', NATIVE ? 'prog' : 'main.c', ...(V3 ? ['--v3'] : [])]);
  if (!NATIVE && r.code === 0) { const c = await b(process.env.CC || 'cc', ['-O2', '-fwrapv', '-w', '-I' + INC, 'main.c', '-o', 'prog', '-lm']); r = {...c, ms: r.ms + c.ms, err: c.code !== 0 && /xcrun|ENOENT|not found/i.test(c.err) ? c.err + '\nHelium builds through a C compiler on this computer and none works yet. On a Mac, install one with: xcode-select --install' : c.err}; }
  if (r.code !== 0 || !existsSync(exe)) { rmSync(dir, {recursive: true, force: true}); return {error: (r.err + r.out).trim() || 'compile failed', ms: r.ms}; }
  return {exe, dir, cached: false, ms: r.ms};
}
const TOOLS = [
  {name: 'helium_learn', description: 'Returns the Helium language primer (about 7k tokens). Read it once before writing Helium.', inputSchema: {type: 'object', properties: {}}},
  {name: 'helium_run', description: 'Compile a Helium program natively and run it. Returns exit code, timings, stdout and stderr, or compiler errors.', inputSchema: {type: 'object', properties: {code: {type: 'string', description: 'Full program with fn main()'}, syntax: {type: 'string', enum: ['amni', 'he'], description: 'amni (braces, default) or he (layout)'}, stdin: {type: 'string'}, args: {type: 'array', items: {type: 'string'}}, timeout_s: {type: 'number', description: 'Default 10, max 120'}}, required: ['code']}},
  {name: 'helium_check', description: 'Typecheck a Helium program without running it. Returns every error with its line.', inputSchema: {type: 'object', properties: {code: {type: 'string'}, syntax: {type: 'string', enum: ['amni', 'he']}}, required: ['code']}}];
const INSTRUCTIONS = 'Helium is a compiled language with no heap and no garbage collector. Its programs run at about C speed, often 10x or more faster than Python. Call helium_learn once, then write programs and run them with helium_run. Use it for computation, simulation, parsing and data crunching that would be slow in Python.';
async function call(name, a = {}) {
  if (name === 'helium_learn') return PRIMER();
  if (name !== 'helium_run' && name !== 'helium_check') throw new Error('unknown tool ' + name);
  if (typeof a.code !== 'string' || !a.code.trim()) throw new Error('code is required');
  if (name === 'helium_check') {
    const dir = join(CACHE, 'check-' + process.pid), ext = a.syntax === 'he' ? 'he' : 'amni'; mkdirSync(dir, {recursive: true}); writeFileSync(join(dir, 'main.' + ext), a.code);
    const r = await sh(HC, ['check', 'main.' + ext], {cwd: dir, timeout: 70000, env: {HC_LIB: LIB}});
    return r.code === 0 ? 'ok: no errors' : (r.err + r.out).trim();
  }
  if (!meter(!!await current())) return {isError: true, text: `The free plan runs ${FREE} programs a day and today's are used. Unlimited runs: https://amni-scient.com/helium-run.html (then set HELIUM_RUN_KEY or run: node server.mjs --key <key>).`};
  const c = await compile(a.code, a.syntax);
  if (c.error) return {isError: true, text: `compile error (${c.ms} ms):\n${c.error}`};
  const r = await sh(c.exe, (a.args || []).map(String), {cwd: c.dir, input: a.stdin || '', timeout: Math.min(120, Math.max(1, +a.timeout_s || 10)) * 1000});
  const head = r.code === 'timeout' ? `timed out after ${Math.min(120, Math.max(1, +a.timeout_s || 10))} s` : `exit ${r.code}`;
  return {isError: r.code !== 0, text: `${head} · compile ${c.cached ? 'cached' : c.ms + ' ms'} · run ${r.ms} ms\n--- stdout ---\n${r.out}${r.err ? '\n--- stderr ---\n' + r.err : ''}`};
}
async function rpc(m) {
  const {id, method, params = {}} = m;
  if (method === 'initialize') return {protocolVersion: params.protocolVersion || '2025-06-18', capabilities: {tools: {}}, serverInfo: {name: 'helium-run', version: VERSION}, instructions: INSTRUCTIONS};
  if (method === 'tools/list') return {tools: TOOLS};
  if (method === 'ping') return {};
  if (method === 'tools/call') {
    try { const v = await call(params.name, params.arguments); const o = typeof v === 'string' ? {text: v} : v; return {content: [{type: 'text', text: o.text}], isError: !!o.isError}; }
    catch (e) { return {content: [{type: 'text', text: String(e.message || e)}], isError: true}; }
  }
  if (id === undefined) return undefined;
  throw Object.assign(new Error('method not found: ' + method), {code: -32601});
}
function serve() {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) handle(line); } });
  const send = v => process.stdout.write(JSON.stringify(v) + '\n');
  const handle = async line => {
    let m; try { m = JSON.parse(line); } catch { return send({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'parse error'}}); }
    try { const r = await rpc(m); if (m.id !== undefined && r !== undefined) send({jsonrpc: '2.0', id: m.id, result: r}); }
    catch (e) { if (m.id !== undefined) send({jsonrpc: '2.0', id: m.id, error: {code: e.code || -32603, message: String(e.message || e)}}); }
  };
}
const argv = process.argv.slice(2);
if (argv[0] === '--key') { const L = license(argv[1]); if (!L) { console.error('That key is not a valid Helium Run key.'); process.exit(1); } writeJ(join(CFG, 'license.json'), {key: L.key}); console.log(`Saved. Unlimited runs until ${new Date(L.exp).toDateString()} (renews automatically).`); }
else if (argv[0] === '--version') console.log(VERSION);
else if (argv[0] === '--selftest') call('helium_run', {code: 'fn main() { print("hello from helium ", 21 * 2); }'}).then(r => { console.log(typeof r === 'string' ? r : r.text); process.exit(r.isError ? 1 : 0); });
else if (!process.env.HELIUM_RUN_NO_SERVE) serve();
