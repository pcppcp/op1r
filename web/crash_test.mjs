// node crash_test.mjs (node 20: node --experimental-detect-module crash_test.mjs): crash.js on a sample crash screen
// (the same cases as op1r-src tools/op1crash_test.py)
import * as C from './crash.js';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const SCREEN = `SEQSTAT : RETX
0x00000024 : 0x01a85c8e
op1r 64 sp 0x1fe3c40
0x1a85c8e 0x1e00030
0x1e00004 clouds+0x1c4
0xffa03100 bogus+0x10
0x1e00078 0x1aff000
`;
const stock = JSON.parse(readFileSync(new URL('../data/symbols/r246.json', import.meta.url)));
assert.equal(stock.op1r, null);
assert(stock.stock.length > 200 && stock.stock.every(([a], i, s) => !i || s[i - 1][0] < a), 'R246 names sorted, unique');
const map = { op1r: '64', image_end: 0x01E00400, stock: stock.stock,
  core: [[0x01E00000, 0, 'l1v_metro'], [0x01E00020, 0x40, 'dispatcher_render'], [0x01E00060, 0x10, 'helper'], [0xFFA030F0, 0x1A0, 'eq_stage']],
  plugins: { clouds: [[0x100, 0x100, 'clouds_render']] } };

const p = C.parse(SCREEN);
assert.equal(p.version, '64'); assert.equal(p.sp, 0x1FE3C40);
assert.deepEqual(p.addrs.map((e) => e.tok), ['0x01a85c8e', '0x1a85c8e', '0x1e00030', '0x1e00004', 'clouds+0x1c4', '0xffa03100',
  'bogus+0x10', '0x1e00078', '0x1aff000']);                   // not 0x24 (SEQSTAT), not the stack pointer

const d = (f, a) => C.decode(map, f, a);
assert.deepEqual(d(null, 0x01E00030), { where: 'op1r', text: 'dispatcher_render+0x10' });
assert.deepEqual(d(null, 0x01E00004), { where: 'op1r', text: 'l1v_metro+0x4' });        // asm label: up to the next symbol
assert.deepEqual(d(null, 0x01E00078), { where: 'op1r', text: 'op1r core' });            // past helper's size
assert.deepEqual(d(null, 0xFFA03100), { where: 'op1r', text: 'eq_stage+0x10' });         // our code in L1
assert.deepEqual(d('clouds', 0x1C4), { where: 'plugin', text: 'clouds: clouds_render+0xc4' });
assert.deepEqual(d('bogus', 0x10), { where: 'plugin', text: 'bogus: +0x10 (no symbols for this plugin)' });
const r = d(null, 0x01A85C8E);
assert(r.where === 'R246' && r.text.startsWith('near VoiceCtl::on_midi_rx') && r.text.endsWith('+0x4'), r.text);
assert.match(d(null, 0x0191995C + 4).text, /^near .*\[hook_crash\] \+0x4$/);
assert.deepEqual(d(null, 0x01AFF000), { where: 'R246', text: 'unnamed' });
assert.deepEqual(C.decode(null, null, 0x01E00030), { where: 'op1r', text: 'op1r core (no symbol map)' });
assert.deepEqual(C.decode(stock, null, 0x01E00030), { where: 'op1r', text: 'op1r core (no symbol map)' });   // R246-only fallback

const rep = C.report(SCREEN, { ...map, op1r: '63' });
assert.equal(rep.head, 'op1r 64, sp 0x1fe3c40 (symbol map is op1r 63)');
assert.equal(rep.rows.length, 9);
assert.equal(C.report('nothing here', map).rows.length, 0);

const u = new URL(C.issueUrl(SCREEN, C.report(SCREEN, map), 'symbol map for op1r 64'));
assert.equal(u.origin + u.pathname, 'https://github.com/pcppcp/op1r/issues/new');
assert.equal(u.searchParams.get('title'), 'Crash on op1r 64 in dispatcher_render');
const body = u.searchParams.get('body');
assert(body.includes(SCREEN.trim()) && body.includes('clouds: clouds_render+0xc4') && body.includes('symbol map for op1r 64'));
console.log('crash_test ok');
