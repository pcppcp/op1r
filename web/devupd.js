// Firmware update over USB MIDI SysEx (op1r devupd protocol, see tools/op1push.py in op1r-src), for the browser.
// The OP-1 stages the files while it runs and asks before anything is applied: T1 restart + apply, T2 cancel.
// Only a physical T1 press confirms (MIDI key events are ignored while the prompt is shown).
const HDR = [0xF0, 0x00, 0x20, 0x76, 0x7D];
export const HELLO = 1, BEGIN = 2, DATA = 3, END = 4, COMMIT = 5, ABORT = 6, STAT = 7, IDENT = 8, DELETE = 9, LIST = 10, CRC = 11;
const MAX_DATA = 192, WINDOW = 8, TIMEOUT = 2000;
const ST = { 0: 'ok', 1: 'format', 2: 'state', 3: 'path', 4: 'size', 5: 'offset', 6: 'crc', 7: 'io', 8: 'full',
             9: 'wait key', 10: 'no file' };

export function pack7(b) {
  const out = [];
  for (let i = 0; i < b.length; i += 7) {
    const g = b.subarray(i, i + 7);
    let hi = 0; g.forEach((x, k) => { hi |= (x >> 7) << k; });
    out.push(hi); g.forEach((x) => out.push(x & 0x7F));
  }
  return out;
}
export function unpack7(b) {
  const out = [];
  for (let i = 0; i < b.length;) {
    const hi = b[i++];
    for (let k = 0; k < 7 && i < b.length; k++, i++) out.push(b[i] | ((hi >> k) & 1) << 7);
  }
  return Uint8Array.from(out);
}
export function build(cmd, seq, payload = new Uint8Array()) {
  const m = [...HDR, cmd, seq & 0x7F, (seq >> 7) & 0x7F, ...pack7(payload), 0xF7];
  if (m.length > 256) throw new Error('message too long');
  return Uint8Array.from(m);
}
export function parseReply(m) {
  if (m.length < 10 || HDR.some((x, i) => m[i] !== x) || m[m.length - 1] !== 0xF7 || !(m[5] & 0x40)) return null;
  const pl = unpack7(m.subarray(8, m.length - 1));
  return { cmd: m[5] & 0x3F, seq: m[6] | m[7] << 7, st: pl[0], pl: pl.subarray(1) };
}
export function pathOk(p) {
  const low = p.toLowerCase();
  return /^[A-Za-z0-9_.\-/]+$/.test(p) && p.length < 96 && !p.startsWith('/') && !p.endsWith('/') &&
    !/te-boot|te_boot|teboot/.test(low) && !p.includes('..') && !p.includes('//') &&
    (p === 'OP1_vdk.ldr' || p.startsWith('content/') || pluginPath(p));
}
// plugin files (synth engines / FX loaded at boot, protocol 3 can list and delete them)
export const pluginPath = (p) => /^plugins\/[A-Za-z0-9_.\-]+\.op1p$/.test(p);   // (the name before .op1p: at least one character)
// the user's sampler slots, settings / patches and tape clips: never sent
export const userData = (p) => /^content\/(audio\/(drum|synth)\/|op1\.db$|tape\.db$)/.test(p);
// boot text in an OP1_vdk.ldr ("op1r <n> [build time]"), null if none (as op1push.ldr_ident)
export function ldrIdent(data) {
  const s = new TextDecoder('latin1').decode(data);
  const m = s.match(/\n{17} *(op1r [ -~]*)/);
  return m ? m[1] : null;
}
const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };
const rd32 = (b) => new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
const enc = (s) => new TextEncoder().encode(s + '\0');
export function crc32(d, prev = 0) {                 // prev: a CRC to continue (as zlib)
  let c = ~prev;
  for (let i = 0; i < d.length; i++) { c ^= d[i]; for (let k = 0; k < 8; k++) c = c >>> 1 ^ (0xEDB88320 & -(c & 1)); }
  return ~c >>> 0;
}

class Link {                                        // one MIDI output + input pair
  constructor(out, inp) {
    this.out = out; this.inp = inp; this.seq = 0; this.q = []; this.wait = null;
    this.attach();
  }
  attach() {                                        // (re)take the input: only one handler per port
    this.inp.onmidimessage = (e) => { const r = parseReply(e.data); if (r) { this.q.push(r); if (this.wait) this.wait(); } };
  }
  close() { this.inp.onmidimessage = null; }
  send(cmd, pl) { this.seq = (this.seq + 1) & 0x3FFF; this.out.send(build(cmd, this.seq, pl)); return this.seq; }
  recv(ms) {
    if (this.q.length) return Promise.resolve(this.q.shift());
    return new Promise((res) => {
      const t = setTimeout(() => { this.wait = null; res(null); }, ms);
      this.wait = () => { clearTimeout(t); this.wait = null; res(this.q.shift()); };
    });
  }
  async ask(cmd, pl = new Uint8Array(), tries = 8, ms = TIMEOUT) {
    for (let i = 0; i < tries; i++) {
      const seq = this.send(cmd, pl);
      for (let r; (r = await this.recv(ms));) if (r.cmd === cmd && r.seq === seq) return r;
    }
    throw new Error(`the OP-1 does not answer (command ${cmd})`);
  }
}

// -> { link, proto, ident } of the first OP-1 that answers HELLO, or null
export async function find(midi) {
  const outs = [...midi.outputs.values()], ins = [...midi.inputs.values()];
  const op1 = (p) => /op-?1/i.test(p.name || '');
  for (const out of outs.filter(op1)) {
    for (const inp of ins.filter(op1)) {
      const link = new Link(out, inp);
      try {
        const r = await link.ask(HELLO, undefined, 2, 600);
        const proto = rd32(r.pl);
        const ident = proto >= 2 ? new TextDecoder().decode((await link.ask(IDENT)).pl) : '';
        return { link, proto, ident };
      } catch { link.close(); }
    }
  }
  return null;
}

// plugin files on the OP-1 (protocol 3): [{ file, size }]
export async function list(dev) {
  if (dev.proto < 3) throw new Error('this OP-1 firmware cannot list plugin files (update the firmware first)');
  const L = dev.link, out = [];
  L.attach(); L.q = [];
  for (let i = 0; ; i++) {
    const r = await L.ask(LIST, Uint8Array.from([i & 255, i >> 8]));
    if (r.st) break;
    out.push({ file: new TextDecoder().decode(r.pl.subarray(4)), size: rd32(r.pl) });
  }
  return out;
}

// files: [[path, Uint8Array]]; only those that differ on the device are sent (STAT sizes, IDENT for the LDR; protocol
// 4: a file of the same size also by its CRC-32, asked with CRC in steps of up to 32 KB). Before protocol 4 a changed
// file of the same size looks equal: opt.upgrade (the OP-1 runs another op1r than these files) sends every plugin
// file. opt.force sends every file. log(text).
// Resolves 'applied' when the OP-1 confirmed (it then restarts and applies), 'restarting' when the confirmation got
// lost but the OP-1 stopped answering after T1 (most likely applying); rejects on refusal / cancel.
async function sameCrc(L, p, d) {                   // protocol 4: the device's CRC-32 of p, continued per reply
  let off = 0, crc = 0;
  while (off < d.length) {
    const r = await L.ask(CRC, cat(enc(p), u32(off), u32(crc)));
    if (r.st) return false;                           // changed while read (E_IO / E_OFFSET): send it
    const nxt = new DataView(r.pl.buffer, r.pl.byteOffset + 4, 4).getUint32(0, true);
    if (nxt <= off) return false;                     // (no progress: send it)
    crc = rd32(r.pl); off = nxt;
  }
  return crc === crc32(d);
}
export async function push(dev, files, log, deletes = [], opt = {}) {   // deletes: plugin paths (protocol 3)
  const L = dev.link;
  L.attach(); L.q = [];
  log('asking the OP-1 which files it has ...');
  files = files.filter(([p]) => pathOk(p) && !userData(p));
  if (dev.proto >= 2 && !opt.force) {
    const keep = [];
    for (const [p, d] of files) {
      let same;
      if (p === 'OP1_vdk.ldr') same = ldrIdent(d) === dev.ident;
      else if (opt.upgrade && dev.proto < 4 && pluginPath(p)) same = false;   // same size is no proof (op1r 57: 7 such plugins)
      else {
        const r = await L.ask(STAT, enc(p));
        same = r.st === 0 && rd32(r.pl) === d.length;
        if (same && dev.proto >= 4) same = await sameCrc(L, p, d);
      }
      if (!same) { keep.push([p, d]); log(`  differs: ${p}`); }
    }
    const db = files.find(([p]) => p === 'content/op1_factory.db');   // engine / FX rows: often the same size
    if (dev.proto < 4 && keep.some(([p]) => p === 'OP1_vdk.ldr') && db && !keep.includes(db)) { keep.push(db); log(`  with the firmware: ${db[0]}`); }
    log(`${keep.length} of ${files.length} files differ on the OP-1`);
    files = keep;
  }
  deletes = deletes.filter(pluginPath);
  if (deletes.length && dev.proto < 3) throw new Error('this OP-1 firmware cannot delete plugin files (update the firmware first)');
  if (!files.length && !deletes.length) { log('nothing to send: the OP-1 already has all of it (tick "send every file" to send anyway)'); return 'nothing'; }
  await L.ask(ABORT);
  const total = files.reduce((n, [, d]) => n + d.length, 0), t0 = performance.now();
  let done = 0;
  for (const [p, d] of files) {
    const b = await L.ask(BEGIN, cat(u32(d.length), u32(crc32(d)), enc(p)));
    if (b.st) throw new Error(`${p}: refused (${ST[b.st] || b.st})`);
    let acked = 0, nxt = 0, inflight = new Map(), last = 0;
    while (acked < d.length) {                                   // pipelined DATA, resync on gaps / losses
      while (nxt < d.length && inflight.size < WINDOW) {
        const n = Math.min(MAX_DATA, d.length - nxt);
        inflight.set(L.send(DATA, cat(u32(nxt), d.subarray(nxt, nxt + n))), nxt); nxt += n;
      }
      const r = await L.recv(TIMEOUT);
      if (!r) { inflight.clear(); nxt = acked; continue; }
      if (r.cmd !== DATA || !inflight.has(r.seq)) continue;
      inflight.delete(r.seq);
      if (r.st !== 0 && r.st !== 5) throw new Error(`${p}: data refused (${ST[r.st] || r.st})`);
      const w = rd32(r.pl);
      if (r.st === 5) { inflight.clear(); nxt = w; }
      acked = Math.max(acked, w);
      if (acked - last >= 262144 || acked === d.length) {
        last = acked;
        log(`  ${p}: ${Math.round((done + acked) / total * 100)} %  (${((done + acked) / (performance.now() - t0)).toFixed(1)} kB/s)`);
      }
    }
    done += d.length;
    const e = await L.ask(END);
    if (e.st) throw new Error(`${p}: ${ST[e.st] || e.st}`);
  }
  for (const p of deletes) {
    const r = await L.ask(DELETE, enc(p));
    if (r.st) throw new Error(`${p}: delete refused (${ST[r.st] || r.st})`);
    log(`  delete: ${p}`);
  }
  log('confirm on the OP-1: T1 restart and apply, T2 cancel');
  const sent = `sent ${files.length} files (${(total / 1e6).toFixed(2)} MB)` + (deletes.length ? `, ${deletes.length} deletes` : '');
  for (let asked = false; ;) {
    let r = null;
    try { r = await L.ask(COMMIT, undefined, asked ? 2 : 8); }        // after the prompt: the OK may be lost (short
    catch (e) { if (!asked) throw e; log('no reply: checking whether the OP-1 is restarting ...'); }   // then the HELLO check below)
    if (r && r.st === 0) break;
    // A COMMIT asked again after a lost OK reply gets "state" (the session is gone: the OP-1 restarts), and so does
    // one after T2. Tell them apart by whether the OP-1 still answers.
    if (asked && (!r || r.st === 2)) {
      if (await answers(L)) throw new Error('cancelled on the OP-1');
      log(`${sent}. The OP-1 no longer answers: it is most likely restarting and applying the update. ` +
          'Do not switch it off; connect again in a minute and check its version.', 'warn');
      return 'restarting';
    }
    if (r.st !== 9) throw new Error(`commit refused (${ST[r.st] || r.st})`);
    asked = true;
    await new Promise((res) => setTimeout(res, 300));
  }
  log(`${sent}; the OP-1 restarts and applies the update.`);
  return 'applied';
}
// still running (answers HELLO over ~3 s) rather than restarting
async function answers(L) {
  await new Promise((res) => setTimeout(res, 1500));
  for (let i = 0; i < 3; i++) {
    try { await L.ask(HELLO, undefined, 2, 600); } catch { return false; }
    await new Promise((res) => setTimeout(res, 500));
  }
  return true;
}
