// node op1p_test.mjs: op1p.js against the shipped plugin files (data/plugins/) and made-up ones over the loader's limits
import { pluginInfo, checkSet } from './op1p.js';
import { crc32 } from './devupd.js';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const data = new URL('../data/', import.meta.url);
const man = JSON.parse(readFileSync(new URL('manifest.json', data)));
const set = [];
for (const p of man.plugins) {
  const i = pluginInfo(new Uint8Array(readFileSync(new URL('plugins/' + p.file, data))));
  assert(i && i.err === '', `${p.file}: ${i && i.err}`);
  assert.equal(i.kind, p.kind); assert(p.author.startsWith(i.author)); assert(i.mem > 0 && i.api === 1);
  set.push({ file: p.file, ...i });
}
assert.deepEqual(checkSet(set), []);                                     // the full shipped set fits
assert.equal(set.find((p) => p.name === 'amp').needs, 58);              // input engine
assert.equal(set.find((p) => p.name === 'supersaw').needs, 0);

// a plugin file as make_plugin.py writes it (no SVG, no relocations / imports)
function op1p({ kind = 0, name = 'test', img = 64, bss = 0, api = 1, flags = 0, crc = 0 } = {}) {
  const meta = new TextEncoder().encode('author=someone\n'), bin = new Uint8Array(76 + img + meta.length);
  const v = new DataView(bin.buffer);
  [0x5031504F, 1, api, kind].forEach((x, i) => v.setUint32(4 * i, x, true));
  bin.set(new TextEncoder().encode(name), 16);
  v.setUint32(32, img, true); v.setUint32(36, bss, true); v.setUint32(44, 0xFFFFFFFF, true); v.setUint32(64, flags, true);
  bin.set(meta, 76 + img);
  const f = new Uint8Array(bin.length + 16), t = new DataView(f.buffer, bin.length);
  f.set(bin);
  [0x5431504F, 0, bin.length, crc32(bin) ^ crc].forEach((x, i) => t.setUint32(4 * i, x, true));
  return f;
}
const ok = pluginInfo(op1p());
assert.equal(ok.err, ''); assert.equal(ok.author, 'someone'); assert.equal(ok.mem, 64);
assert.match(pluginInfo(op1p({ crc: 1 })).err, /checksum/);
assert.match(pluginInfo(op1p({ api: 2 })).err, /API 2/);
assert.match(pluginInfo(op1p({ img: 2048 * 1024 + 4 })).err, /too large/);
assert.match(pluginInfo(op1p({ bss: 2048 * 1024 + 1 })).err, /too large/);
assert.equal(pluginInfo(op1p({ img: 2048 * 1024, bss: 2048 * 1024 })).err, '');   // each at the limit: loadable alone
assert.match(pluginInfo(op1p({ name: 'Big' })).err, /name/);
assert.match(pluginInfo(op1p({ kind: 6 })).err, /kind/);
assert.equal(pluginInfo(op1p({ flags: 8 })).needs, 60);
assert.equal(pluginInfo(new Uint8Array(200)), null);

const P = (file, o) => ({ file, ...pluginInfo(op1p(o)) });
const has = (errs, re) => assert(errs.some((e) => re.test(e)), errs.join('\n') || '(no error)');
has(checkSet([...set, P('big.op1p', { img: 1024 * 1024, bss: 1024 * 1024 })]), /plugin memory/);   // 2.2 + 2 MB
has(checkSet([...set, { file: 'other.op1p', name: 'other', kind: '', size: 2 * 1024 * 1024 }]), /counted by file size/);
has(checkSet([...set, P('s7.op1p', { kind: 2, name: 's7' }), P('s8.op1p', { kind: 2, name: 's8' }),
              P('s9.op1p', { kind: 2, name: 's9' })]), /9 seq plugins/);
has(checkSet(Array.from({ length: 5 }, (_, i) => P(`t${i}.op1p`, { kind: 5, name: `t${i}` }))), /5 tool plugins/);
has(checkSet([...set, ...['d3', 'd4', 'd5'].map((n) => P(n + '.op1p', { kind: 3, name: n }))]), /5 drum plugins/);
has(checkSet([...set, P('perc2.op1p', { kind: 3, name: 'perc' })]), /both drum "perc"/);
has(checkSet([...set, P('sampler2.op1p', { kind: 4, name: 'x' })]), /2 sampler plugins/);
has(checkSet([...set, P('clouds2.op1p', { kind: 1, name: 'clouds' })]), /both fx "clouds"/);
has(checkSet([P('pat.op1p', { kind: 2, name: 'pattern' })]), /stock one/);
has(checkSet(Array.from({ length: 33 }, (_, i) => P(`e${i}.op1p`, { name: `e${i}` }))), /33 synth plugins need a number/);
assert.deepEqual(checkSet(Array.from({ length: 32 }, (_, i) => P(`e${i}.op1p`, { name: `e${i}` }))), []);
has(checkSet([P('a'.repeat(37) + '.op1p', {})]), /longer than 40/);
has(checkSet(Array.from({ length: 97 }, (_, i) => ({ file: `x${i}.op1p`, name: `x${i}`, kind: '', size: 10 }))), /at most 96/);
console.log('op1p.js: ok');
