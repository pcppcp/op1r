// Crash screen decoder (crash.html), the same rules as op1r-src tools/op1crash.py (keep the two in step).
// After a crash the OP-1 shows "op1r <version> sp <stack pointer>" and up to 10 code addresses from the crashed stack:
// plugin addresses as <file>+<offset>, the others raw. Symbol maps (op1r-src make_firmware.py / synth_sdk/symmap.py):
// { op1r, image_end, core: [[addr, size, name]], plugins: { file: [[offset, size, name]] }, stock: [[addr, name]] }
export const STOCK = [0x01900000, 0x01B00000], L1 = [0xFFA00000, 0xFFA14000], CORE = [0x01E00000, 0x02000000];
const NEAR = 0x800;        // R246: names are entry points / call sites, not sizes: "near" up to this far past one
const UNSIZED = 0x1000;    // op1r asm labels without a size: up to the next symbol, at most this far
export const ISSUES = 'https://github.com/pcppcp/op1r/issues/new';
const inr = (a, [lo, hi]) => a >= lo && a < hi;
const hex = (a) => '0x' + a.toString(16);

export function parse(text) {                        // -> { version, sp, addrs: [{ tok, file, addr }] }
  const v = /op1r\s+(\d+)/i.exec(text), sp = /\bsp\s+(0x[0-9a-f]+)/i.exec(text);
  const spAt = sp ? sp.index + sp[0].length - sp[1].length : -1, addrs = [];
  for (const m of text.matchAll(/([A-Za-z][\w-]*)\+(0x[0-9a-f]+)|\b(0x[0-9a-f]+)\b/gi)) {
    if (m[1]) addrs.push({ tok: m[0], file: m[1], addr: parseInt(m[2], 16) });
    else if (m.index !== spAt) {
      const a = parseInt(m[3], 16);
      if ((inr(a, STOCK) || inr(a, L1) || inr(a, CORE)) && !(a & 1)) addrs.push({ tok: m[0], file: null, addr: a });
    }
  }
  return { version: v ? v[1] : null, sp: sp ? parseInt(sp[1], 16) : null, addrs };
}

function last(list, a) {                            // index of the last entry with entry[0] <= a, or -1
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] <= a) lo = m + 1; else hi = m; }
  return lo - 1;
}
export function lookup(syms, a) {                   // -> [name, offset] or null
  const i = last(syms, a);
  if (i < 0) return null;
  const [s0, size, name] = syms[i], next = i + 1 < syms.length ? syms[i + 1][0] : s0 + UNSIZED;
  return a - s0 < (size || Math.min(next - s0, UNSIZED)) ? [name, a - s0] : null;
}

export function decode(map, file, a) {              // -> { where: 'plugin' | 'op1r' | 'R246', text }
  map = map || {};
  if (file) {
    const pl = map.plugins || {};
    const syms = pl[file.slice(0, 15)] || Object.entries(pl).find(([k]) => k.startsWith(file))?.[1];
    const hit = syms && lookup(syms, a);
    return { where: 'plugin', text: `${file}: ` + (hit ? `${hit[0]}+${hex(hit[1])}` : `+${hex(a)}` + (syms ? '' : ' (no symbols for this plugin)')) };
  }
  const hit = lookup(map.core || [], a);
  if (hit) return { where: 'op1r', text: `${hit[0]}+${hex(hit[1])}` };
  if (inr(a, CORE)) return { where: 'op1r', text: 'op1r core' + ((map.core || []).length ? '' : ' (no symbol map)') };
  const st = map.stock || [], i = last(st, a), l1 = inr(a, L1) ? 'L1, ' : '';
  if (i >= 0 && a - st[i][0] <= NEAR) return { where: 'R246', text: `${l1}near ${st[i][1]} +${hex(a - st[i][0])}` };
  return { where: 'R246', text: l1 + 'unnamed' };
}

export function report(text, map) {                // -> { parsed, head, rows: [{ tok, where, text }] }
  const p = parse(text);
  const head = `op1r ${p.version || '?'}` + (p.sp !== null ? `, sp ${hex(p.sp)}` : '') +
    (map && map.op1r && map.op1r !== p.version ? ` (symbol map is op1r ${map.op1r})` : '');
  return { parsed: p, head, rows: p.addrs.map((e) => ({ tok: e.tok, ...decode(map, e.file, e.addr) })) };
}

export function issueUrl(screen, rep, note = '') {   // a pre-filled GitHub issue (opened by the user, nothing is sent)
  const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
  const top = rep.rows.find((r) => r.where !== 'R246') || rep.rows[0];
  const title = `Crash on op1r ${rep.parsed.version || '?'}` + (top ? ` in ${top.text.replace(/\+0x[0-9a-f]+$/, '')}` : '');
  const body = ['**What I was doing:**', '', '', '**Crash screen:**', '```', screen.trim(), '```', '',
    '**Decoded** (' + (note || 'symbol map for op1r ' + (rep.parsed.version || '?')) + '):', '```', rep.head,
    ...rep.rows.map((r) => pad(r.tok, 22) + pad(r.where, 7) + r.text), '```'].join('\n');
  return `${ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
