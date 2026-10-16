#!/usr/bin/env python3
"""OP-1 (R246) custom firmware patcher.

Takes the original Teenage Engineering OP-1 firmware update file (op1_246.op1), checks that it is the
expected image, applies the prebuilt patch from data/ (custom synth engines + screens, tape FX, optional
OP-Z controller mode, ...) and writes an installable .op1 whose checksum is verified against the
reference build.

    python3 patch_op1.py op1_246.op1                    # -> op1_246-custom.op1
    python3 patch_op1.py op1_246.op1 -o my.op1
    python3 patch_op1.py --info                         # show what the patch contains
    python3 patch_op1.py op1_246.op1 --plugins supersaw,clouds   # only these synths / FX (default: all)
    python3 patch_op1.py op1_246.op1 --plugins none              # firmware only (manage engines over USB later)

Synth engines and FX are plugin files (/yaffs2/plugins/<name>.op1p, loaded by the firmware at boot). --plugins picks
which ones go into the update; sounds that use a missing one play the stock iter / filter. The firmware part is always
verified against the reference build (which contains all plugins), each plugin file against its checksum.

Only the Python standard library is needed (Python >= 3.8). Pipeline:
  .op1 = CRC32 (LE) + LZMA "alone" stream of a tar archive (see docs/01).
  unpack -> per file: verify SHA-256, apply byte edits / insertions, verify SHA-256; add new files
  -> tar (original member order + metadata, deterministic) -> LZMA (op1repacker settings) -> CRC32
  -> verify SHA-256 of the result.
"""
import argparse, binascii, copy, hashlib, io, json, lzma, os, struct, sys, tarfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
# LZMA settings of op1repacker (known to install: the OP-1 needs < 15 MB and limited decoder RAM)
LZMA_FILTERS = [{'id': lzma.FILTER_LZMA1, 'preset': 9, 'lc': 3, 'lp': 1, 'pb': 2, 'dict_size': 2 ** 23}]


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def fail(msg):
    sys.exit('ERROR: ' + msg)


def unpack(op1):
    """.op1 bytes -> (tar bytes, list of (TarInfo, data or None))"""
    if len(op1) < 8:
        fail('input too small to be an OP-1 firmware file')
    crc = struct.unpack('<L', op1[:4])[0]
    if crc != binascii.crc32(op1[4:]):
        fail('CRC-32 of the input does not match its header: file is damaged')
    raw = lzma.decompress(op1[4:], format=lzma.FORMAT_ALONE)
    members = []
    with tarfile.open(fileobj=io.BytesIO(raw)) as t:
        for m in t.getmembers():
            members.append((m, t.extractfile(m).read() if m.isfile() else None))
    return raw, members


def pack_tar(members):
    """deterministic tar: given member order and metadata (GNU format like the original)"""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w', format=tarfile.GNU_FORMAT) as t:
        for info, data in members:
            info = copy.copy(info)
            if data is not None:
                info.size = len(data)
                t.addfile(info, io.BytesIO(data))
            else:
                t.addfile(info)
    return buf.getvalue()


def pack_op1(tar_bytes):
    comp = lzma.compress(tar_bytes, format=lzma.FORMAT_ALONE, filters=LZMA_FILTERS)
    return struct.pack('<L', binascii.crc32(comp)) + comp


def apply_ops(name, data, ops):
    buf = bytearray(data)
    for op in ops:
        off = op['offset']
        if op['op'] == 'replace':
            old, new = bytes.fromhex(op['old']), bytes.fromhex(op['new'])
            if bytes(buf[off:off + len(old)]) != old:
                fail(f'{name}: unexpected bytes at {off:#x}')
            buf[off:off + len(old)] = new
        elif op['op'] == 'insert':
            blob = open(os.path.join(DATA, op['blob']), 'rb').read()
            if sha256(blob) != op['sha256']:
                fail(f'{name}: patch data {op["blob"]} is damaged')
            buf[off:off] = blob
        elif op['op'] == 'truncate':
            del buf[off:]
        else:
            fail(f'{name}: unknown patch operation {op["op"]}')
    return bytes(buf)


def load_manifest():
    path = os.path.join(DATA, 'manifest.json')
    if not os.path.exists(path):
        fail(f'{path} missing - incomplete checkout?')
    return json.load(open(path))


def plugin_members(members, man, names, log=print):
    """tar members (dir + files) for the named plugin files (data/plugins/, checked against the manifest)"""
    cat = {p['name']: p for p in man.get('plugins', [])}
    bad = [n for n in names if n not in cat]
    if bad:
        fail('unknown synth / FX ' + ', '.join(bad) + ' (available: ' + ', '.join(cat) + ')')
    if not names:
        return []
    by_name = {m.name: m for m, _ in members}
    d = copy.copy(by_name[man['plugin_dir_template']]); d.name = 'plugins'
    out = [(d, None)]
    for n in sorted(names, key=lambda n: cat[n]['file']):
        p = cat[n]
        data = open(os.path.join(DATA, 'plugins', p['file']), 'rb').read()
        if sha256(data) != p['sha256']:
            fail(f'plugin {n}: patch data is damaged')
        info = copy.copy(by_name[man['plugin_file_template']]); info.name = 'plugins/' + p['file']
        out.append((info, data))
        log(f'  plugin  {p["file"]}')
    return out


def patch(op1, man, log=print, verify=True, plugins=None):
    """original .op1 bytes -> (patched .op1 bytes, tar bytes); verify=False only for build_patch.py.
    plugins: names of the plugin files to include (None: all = the reference build)"""
    log('unpacking ...')
    _, members = unpack(op1)
    by_name = {m.name: i for i, (m, _) in enumerate(members)}

    for f in man['patched_files']:
        i = by_name.get(f['path'])
        if i is None:
            fail(f'{f["path"]} not found in the firmware')
        info, data = members[i]
        if sha256(data) != f['orig_sha256']:
            fail(f'{f["path"]}: content differs from the expected original')
        new = apply_ops(f['path'], data, f['ops'])
        if sha256(new) != f['result_sha256']:
            fail(f'{f["path"]}: patched content does not match the reference')
        members[i] = (info, new)
        log(f'  patched {f["path"]} ({len(f["ops"])} edits)')

    for f in man['added_files']:
        if f['path'] in by_name:
            fail(f'{f["path"]} already exists in the firmware')
        if 'copy_of' in f:                                      # duplicate of a stock file (not shipped)
            data = members[by_name[f['copy_of']]][1]
        else:
            data = open(os.path.join(DATA, f['blob']), 'rb').read()
        if sha256(data) != f['sha256']:
            fail(f'{f["path"]}: patch data / source file is damaged')
        tmpl = members[by_name[f['template']]][0]               # metadata of a sibling stock file
        info = copy.copy(tmpl)
        info.name = f['path']
        members.append((info, data))
        log(f'  added   {f["path"]}')

    every = [p['name'] for p in man.get('plugins', [])]
    plugins = every if plugins is None else list(plugins)
    if verify:                                                  # the reference: firmware + every plugin file
        ref = pack_tar(members + plugin_members(members, man, every, log=lambda t: None))
        if sha256(ref) != man['result']['tar_sha256']:
            fail('the repacked archive does not match the reference')
    members = members + plugin_members(members, man, plugins, log)
    log('packing tar ...')
    tar_bytes = pack_tar(members)
    log('compressing (LZMA, takes a while) ...')
    t0 = time.time()
    out = pack_op1(tar_bytes)
    log(f'  {len(out):,} bytes in {time.time() - t0:.0f} s')
    return out, tar_bytes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('firmware', nargs='?', help='original OP-1 firmware file (op1_246.op1)')
    ap.add_argument('-o', '--output', help='output file (default: <input>-custom.op1)')
    ap.add_argument('--info', action='store_true', help='show the patch contents and exit')
    ap.add_argument('--accept-recompressed', action='store_true',
                    help='keep the output if only the LZMA compression differs from the reference '
                         '(content verified identical, e.g. different liblzma version)')
    ap.add_argument('--plugins', default='all', metavar='NAMES',
                    help='synths / FX to include: comma-separated names, "all" (default) or "none" (see --info)')
    a = ap.parse_args()
    man = load_manifest()

    if a.info or not a.firmware:
        print(f'{man["title"]}\n')
        for line in man.get('description', []):
            print('  ' + line)
        print(f'\ninput  : {man["original"]["name"]}  sha256 {man["original"]["sha256"]}')
        print(f'output : sha256 {man["result"]["sha256"]}')
        print(f'patched: ' + ', '.join(f['path'] for f in man['patched_files']))
        print(f'added  : ' + ', '.join(f['path'] for f in man['added_files']))
        for k in ('synth', 'fx', 'seq', 'drum', 'sampler'):
            ns = [p['name'] for p in man.get('plugins', []) if p['kind'] == k]
            print(f'{k + " plugins":15s}: ' + ', '.join(ns) + '  (choose with --plugins)')
        if not a.firmware and not a.info:
            print('\nusage: python3 patch_op1.py op1_246.op1 [-o output.op1]')
        return

    op1 = open(a.firmware, 'rb').read()
    h = sha256(op1)
    if h != man['original']['sha256']:
        fail(f'{a.firmware} is not the expected original firmware {man["original"]["name"]}\n'
             f'  expected sha256 {man["original"]["sha256"]}\n  got      sha256 {h}')
    print(f'input OK: {man["original"]["name"]} (sha256 {h[:16]}...)')

    every = [p['name'] for p in man.get('plugins', [])]
    sel = every if a.plugins == 'all' else [] if a.plugins == 'none' else \
        [n.strip() for n in a.plugins.split(',') if n.strip()]
    out, _ = patch(op1, man, plugins=sel)
    dst = a.output or os.path.splitext(a.firmware)[0] + '-custom.op1'
    h = sha256(out)
    if sorted(sel) != sorted(every):
        open(dst, 'wb').write(out)
        print(f'\nOK: {dst}\n  sha256 {h}\n  firmware verified against the reference build; plugins: '
              + (', '.join(sel) or 'none'))
        return
    if h == man['result']['sha256']:
        open(dst, 'wb').write(out)
        print(f'\nOK: {dst}\n  sha256 {h}  (matches the reference build)')
        return
    # content (tar) was verified; only the compressor output differs
    msg = (f'output sha256 {h} differs from the reference {man["result"]["sha256"]}.\n'
           f'The firmware content is verified identical (tar sha256 matches); only the LZMA compression\n'
           f'differs - your Python uses a different liblzma version.')
    if a.accept_recompressed:
        open(dst, 'wb').write(out)
        print(f'\nWARNING: {msg}\nwritten anyway (--accept-recompressed): {dst}')
        return
    fail(msg + '\nRe-run with --accept-recompressed to write it anyway.')


if __name__ == '__main__':
    main()
