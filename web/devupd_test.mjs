// node devupd_test.mjs: devupd.js framing against tools/op1push.py vectors + a push to a simulated OP-1
import * as DU from './devupd.js';
import assert from 'node:assert';
// vectors from tools/op1push.py: build(DATA, 300, bytes(i * 23 & 255 for i in range(12))).hex(), crc32(b'123456789')
assert.equal(DU.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
const v = DU.build(DU.DATA, 300, Uint8Array.from({ length: 12 }, (_, i) => i * 23));
assert.equal(Buffer.from(v).toString('hex'), process.argv[2] || 'f00020767d032c024000172e455c730a1f21384f667df7');
for (let n = 0; n < 40; n++) { const b = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n) & 255); assert.deepEqual(DU.unpack7(Uint8Array.from(DU.pack7(b))), b); }
assert(DU.userData('content/audio/drum/drum_1.raw') && DU.userData('content/tape.db') && !DU.userData('content/op1_factory.db') && !DU.userData('content/op1.dbx'));
assert(DU.pathOk('content/display/a.svg') && DU.pathOk('OP1_vdk.ldr') && !DU.pathOk('te-boot.ldr') && !DU.pathOk('content/../x'));
assert(DU.pathOk('plugins/bell.op1p') && !DU.pathOk('plugins/a/b.op1p') && !DU.pathOk('plugins/x.svg') && !DU.pluginPath('plugins/.op1p'));
const ldr = new Uint8Array(200); ldr.set(new TextEncoder().encode('\n'.repeat(17) + '    op1r 32 2026-10-15 09:00\0'), 50);
assert.equal(DU.ldrIdent(ldr), 'op1r 32 2026-10-15 09:00');

// simulated OP-1: has a.svg (same size), b.svg (other size), no c.svg, runs "op1r 31"; drops every 7th DATA once
const have = { 'content/a.svg': 10, 'content/b.svg': 5, 'plugins/x.op1p': 3, 'plugins/y.op1p': 4 }, staged = {}, dropped = new Set(), deleted = [];
let proto = 2, ncrc = 0; const content = {};      // content: the device's bytes (protocol 4 CRC)
let open = null, wr = 0, buf = [], commits = 0, ndata = 0, onmsg;
const reply = (m, st, pl = []) => onmsg({ data: DU.build(m[5] | 0x40, m[6] | m[7] << 7, Uint8Array.from([st, ...pl])) });
const u32 = (x) => [x & 255, x >> 8 & 255, x >> 16 & 255, x >>> 24];
const out = { name: 'OP-1 MIDI', send(m) {
  m = Uint8Array.from(m); const pl = DU.unpack7(m.subarray(8, m.length - 1)), cmd = m[5];
  const str = (b) => new TextDecoder().decode(b.subarray(0, b.indexOf(0)));
  setTimeout(() => {
    if (cmd === DU.HELLO) return reply(m, 0, u32(proto));
    if (cmd === DU.LIST) { const ps = Object.keys(have).filter((k) => k.startsWith('plugins/')), i = pl[0] | pl[1] << 8;
      return i < ps.length ? reply(m, 0, [...u32(have[ps[i]]), ...new TextEncoder().encode(ps[i].slice(8))]) : reply(m, 10); }
    if (cmd === DU.DELETE) { deleted.push(str(pl)); return reply(m, 0); }
    if (cmd === DU.IDENT) return reply(m, 0, [...new TextEncoder().encode('op1r 31')]);
    if (cmd === DU.CRC) { const k = pl.indexOf(0), p = str(pl), c = content[p]; ncrc++;
      if (c === undefined || proto < 4) return reply(m, proto < 4 ? 1 : 10);
      const dv = new DataView(pl.buffer, pl.byteOffset + k + 1, 8), off = dv.getUint32(0, true), crc = dv.getUint32(4, true);
      if (off > c.length) return reply(m, 5);
      const end = Math.min(c.length, off + 32768);
      return reply(m, 0, [...u32(DU.crc32(c.subarray(off, end), crc)), ...u32(end)]); }
    if (cmd === DU.STAT) { const s = have[str(pl)]; return s === undefined ? reply(m, 10) : reply(m, 0, u32(s)); }
    if (cmd === DU.ABORT) return reply(m, 0);
    if (cmd === DU.BEGIN) { open = str(pl.subarray(8)); wr = 0; buf = []; return reply(m, 0); }
    if (cmd === DU.DATA) {
      if (++ndata % 7 === 0 && !dropped.has(ndata)) { dropped.add(ndata); return; }   // lost message
      const off = pl[0] | pl[1] << 8 | pl[2] << 16 | pl[3] << 24;
      if (off !== wr) return reply(m, 5, u32(wr));
      buf.push(...pl.subarray(4)); wr += pl.length - 4; return reply(m, 0, u32(wr));
    }
    if (cmd === DU.END) { staged[open] = Uint8Array.from(buf); return reply(m, 0); }
    if (cmd === DU.COMMIT) return reply(m, ++commits < 3 ? 9 : 0);
  }, 1);
} };
const inp = { name: 'OP-1 MIDI', set onmidimessage(f) { onmsg = f; } };
const midi = { outputs: new Map([[1, out]]), inputs: new Map([[1, inp]]) };
const dev = await DU.find(midi);
assert(dev && dev.proto === 2 && dev.ident === 'op1r 31');
const big = Uint8Array.from({ length: 5000 }, (_, i) => i * 7);
await DU.push(dev, [['content/a.svg', new Uint8Array(10)], ['content/b.svg', new Uint8Array(6)], ['content/c.svg', big],
                    ['OP1_vdk.ldr', ldr], ['te-boot.ldr', new Uint8Array(4)]], () => {});
assert.deepEqual(Object.keys(staged).sort(), ['OP1_vdk.ldr', 'content/b.svg', 'content/c.svg']);
assert.deepEqual(staged['content/c.svg'], big); assert.deepEqual(staged['OP1_vdk.ldr'], ldr);
assert.equal(commits, 3);
// protocol 3: list + engines-only update (no firmware): x.op1p same size (skipped), z.op1p new, y.op1p deleted
proto = 3; commits = 0; for (const k in staged) delete staged[k];
const dev3 = await DU.find(midi);
assert.equal(dev3.proto, 3);
assert.deepEqual(await DU.list(dev3), [{ file: 'x.op1p', size: 3 }, { file: 'y.op1p', size: 4 }]);
await DU.push(dev3, [['plugins/x.op1p', new Uint8Array(3)], ['plugins/z.op1p', big]], () => {}, ['plugins/y.op1p', 'content/op1.db']);
assert.deepEqual(Object.keys(staged), ['plugins/z.op1p']); assert.deepEqual(deleted, ['plugins/y.op1p']);
proto = 2; const dev2 = await DU.find(midi);
await assert.rejects(DU.list(dev2)); await assert.rejects(DU.push(dev2, [], () => {}, ['plugins/y.op1p']));
// crc32 continued in pieces = in one go
const hb = Uint8Array.from({ length: 70000 }, (_, i) => i * 13 + (i >> 8));
assert.equal(DU.crc32(hb.subarray(40000), DU.crc32(hb.subarray(0, 40000))), DU.crc32(hb));
// protocol 4: a same-size file is compared by CRC (in 32 KB steps): equal -> skipped, one byte other -> sent
proto = 4; commits = 0; ncrc = 0; for (const k in staged) delete staged[k];
have['content/d.db'] = hb.length; content['content/d.db'] = hb; have['content/a.svg'] = 10; content['content/a.svg'] = new Uint8Array(10);
const dev4 = await DU.find(midi);
assert.equal(dev4.proto, 4);
const hb2 = hb.slice(); hb2[50000] ^= 1;
await DU.push(dev4, [['content/a.svg', new Uint8Array(10)], ['content/d.db', hb2], ['content/b.svg', new Uint8Array(6)]], () => {});
assert.deepEqual(Object.keys(staged).sort(), ['content/b.svg', 'content/d.db']);
assert.equal(ncrc, 1 + 3);                                        // a.svg one step, d.db three (70000 B); b.svg: size
commits = 0; for (const k in staged) delete staged[k];
assert.equal(await DU.push(dev4, [['content/a.svg', new Uint8Array(10)], ['content/d.db', hb]], () => {}), 'nothing');
console.log('devupd.js: ok');
