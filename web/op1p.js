// .op1p plugin files (format: synth_sdk/plugload/op1p.h in op1r-src) and the limits the OP-1's plugin loader applies
// at boot (plugload.c, op1p_load.c). A file over a limit is refused there without a message on the page, so the page
// checks before it sends or builds. The OP-1 still does the full check (relocations, imports) itself.
import { crc32 } from './devupd.js';

export const KINDS = ['synth', 'fx', 'seq', 'drum', 'sampler', 'tool'];
export const API = 1;                          // OP1P_API: the plugin API of this op1r
const MAX_IMAGE = 2048 * 1024, TOTAL = 4096 * 1024, MAX_FILES = 96, MAX_FILE_NAME = 40, MAX_MAP = 64;
const MAX = { seq: 8, tool: 4, drum: 4, sampler: 1 };   // OP1_SEQ_MAX, OP1_TOOL_MAX, OP1_DRUMS_MAX, one sampler+
const FILE_NUMBERS = 32;                       // synth / FX numbers 32..63 for files without a free preferred one
const STOCK_SEQS = ['pattern', 'endless', 'tombola', 'finger', 'sketch', 'arpeggio'];
const F_INPUT = 4, F_EXT = 8;

// { name, kind, author, api, mem (image + bss), pref, flags, needs (op1r version, 0 any), err (refused at boot) }
// from a .op1p (trailer -> header -> metadata); null if it is not a plugin file
export function pluginInfo(d) {
  if (d.length < 16 + 76) return null;
  const v = new DataView(d.buffer, d.byteOffset, d.length), at = d.length - 16;
  if (v.getUint32(at, true) !== 0x5431504F) return null;
  const off = v.getUint32(at + 4, true), len = v.getUint32(at + 8, true);
  if (off + 76 > d.length || off + len > at || v.getUint32(off, true) !== 0x5031504F) return null;
  const nm = d.subarray(off + 16, off + 32), str = (b) => new TextDecoder().decode(b);
  const w = (k) => v.getUint32(off + k, true), img = w(32), bss = w(36), flags = w(64);
  const info = { name: str(nm.subarray(0, nm.indexOf(0) < 0 ? 16 : nm.indexOf(0))),
                 kind: KINDS[w(12)] || '?', author: '', api: w(8), mem: img + bss, pref: flags >> 8 & 255, flags,
                 needs: w(12) !== 0 ? 0 : flags & F_INPUT ? 58 : flags & F_EXT ? 60 : 0, err: '' };
  if (crc32(d.subarray(off, off + len)) !== v.getUint32(at + 12, true)) info.err = 'damaged (checksum)';
  else if (w(4) !== 1 || info.api !== API) info.err = `made for plugin API ${info.api}, this op1r has API ${API}`;
  else if (info.kind === '?' || !/^[a-z0-9 _-]{1,15}$/.test(info.name)) info.err = 'bad header (kind / name)';
  else if (img > MAX_IMAGE || bss > MAX_IMAGE)
    info.err = `too large: code ${kb(img)}, memory ${kb(bss)} (the OP-1 loads at most ${kb(MAX_IMAGE)} each)`;
  else if (off & 3 || img < 4 || img & 3 || img > len - 76 || d.length > 2 * TOTAL || w(72) > 32) info.err = 'bad header (sizes)';
  let p = off + 76 + img + 16 * w(68);                                    // after image + relocations
  for (let i = w(72); i > 0 && p < off + len; i--) { const z = d.indexOf(0, p); if (z < 0) return info; p = z + 1; }
  for (const l of str(d.subarray(Math.min(p, off + len), off + len)).split('\n'))
    if (l.startsWith('author=')) info.author = l.slice(7, 60);
  return info;
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

// the plugin files the OP-1 will have: [{ file, name, kind, mem, pref }] (mem undefined: only the file size is
// known, e.g. a file only on the OP-1; size used instead) -> list of problems, [] if the OP-1 loads all of them
export function checkSet(list) {
  const errs = [], of = (k) => list.filter((p) => p.kind === k);
  const unknown = list.filter((p) => p.mem === undefined);
  const mem = list.reduce((n, p) => n + (p.mem === undefined ? p.size || 0 : p.mem), 0);
  if (mem > TOTAL)
    errs.push(`together ${kb(mem)} of plugin memory, the OP-1 loads at most ${kb(TOTAL)}: the rest is refused at boot` +
              (unknown.length ? ` (${unknown.length} files only on the OP-1 counted by file size)` : ''));
  if (list.length > MAX_FILES) errs.push(`${list.length} plugin files, the OP-1 reads at most ${MAX_FILES}`);
  for (const p of list) if (p.file.length > MAX_FILE_NAME) errs.push(`${p.file}: file name longer than ${MAX_FILE_NAME} characters`);
  for (const [k, n] of Object.entries(MAX))
    if (of(k).length > n) errs.push(`${of(k).length} ${k} plugins (${of(k).map((p) => p.name).join(', ')}), the OP-1 loads ${n}`);
  for (const k of ['synth', 'fx', 'seq', 'drum']) {
    const seen = new Map();
    for (const p of of(k)) {
      if (seen.has(p.name)) errs.push(`${seen.get(p.name)} and ${p.file} are both ${k} "${p.name}": the OP-1 loads one`);
      else seen.set(p.name, p.file);
      if (k === 'seq' && STOCK_SEQS.includes(p.name)) errs.push(`${p.file}: sequencer "${p.name}" is a stock one`);
    }
  }
  for (const k of ['synth', 'fx']) {                                     // numbers: own (preferred) 1..31, else 32..63
    const own = new Set();
    let need = 0;
    for (const p of of(k)) if (p.pref > 0 && p.pref < FILE_NUMBERS && !own.has(p.pref)) own.add(p.pref); else need++;
    if (need > FILE_NUMBERS) errs.push(`${need} ${k} plugins need a number of their own, the OP-1 has ${FILE_NUMBERS}`);
  }
  const mapped = list.filter((p) => ['synth', 'fx', 'seq', 'drum', 'sampler'].includes(p.kind)).length;
  if (mapped > MAX_MAP) errs.push(`${mapped} synth / FX / sequencer / drum / sampler plugins, the OP-1 keeps numbers for ${MAX_MAP}`);
  return errs;
}
