#!/usr/bin/env python3
"""Maintainer tool: build patcher/data/ from the original firmware and the custom firmware tree.

    synth_sdk/make_firmware.py --opz --release          # builds ../op1_246_custom/ (unpacked tree)
    patcher/build_patch.py op1_246.op1 op1_246_custom   # -> patcher/data/ + reference image

Compares every file of the original image with the custom tree and records only the differences:
  - changed files: byte edits (+ one insertion, e.g. the new code block in OP1_vdk.ldr)
  - new files (our SVG screens): stored whole
No file of the original firmware is copied into data/ (edits keep only the few replaced original bytes
as a sanity check; new files identical to a stock file, e.g. fxgeneric.svg = iter.svg, are recorded as
"copy_of" and recreated from the user's image). Then runs the patcher once to produce the reference image and records its checksums
in data/manifest.json. Deleted files are not supported.
"""
import argparse, hashlib, json, os, posixpath, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import patch_op1 as P                                      # noqa: E402

GAP = 8                                                    # merge edits closer than this


def aligned_diff(a, b, base=0):
    """replace ops turning a into b (same length region), offsets + base"""
    ops, i, n = [], 0, min(len(a), len(b))
    while i < n:
        if a[i] == b[i]:
            i += 1
            continue
        j = i
        while j < n:
            if a[j] != b[j]:
                j += 1
                continue
            k = j
            while k < n and k - j < GAP and a[k] == b[k]:
                k += 1
            if k - j >= GAP or k == n:
                break
            j = k
        ops.append({'op': 'replace', 'offset': base + i, 'old': a[i:j].hex(), 'new': b[i:j].hex()})
        i = j
    return ops


def file_ops(name, a, b, blobdir):
    """ops turning a into b: aligned edits, one insertion if b is longer, truncation if shorter"""
    if len(b) > len(a):
        cs = 0                                             # common suffix -> insertion point
        while cs < len(a) and a[len(a) - 1 - cs] == b[len(b) - 1 - cs]:
            cs += 1
        k = len(a) - cs
        L = len(b) - len(a)
        ops = aligned_diff(a[:k], b[:k])
        blob = name.replace('/', '_') + '.insert.bin'
        open(os.path.join(blobdir, blob), 'wb').write(b[k:k + L])
        ops.append({'op': 'insert', 'offset': k, 'blob': blob, 'sha256': P.sha256(b[k:k + L]), 'size': L})
        return ops
    ops = aligned_diff(a, b)
    if len(b) < len(a):
        ops.append({'op': 'truncate', 'offset': len(b)})
    return ops


def plugin_info(data):
    """(name, kind, metadata dict) from a .op1p file (trailer -> header; metadata after the import names, op1p.h)"""
    import struct
    tm, off, ln, _ = struct.unpack_from('<4I', data, len(data) - 16)
    assert tm == 0x5431504F, 'not a plugin file'
    mg, _, _, kind, name = struct.unpack_from('<4I16s', data, off)
    assert mg == 0x5031504F, 'not a plugin file'
    image, n_rel, n_imp = struct.unpack_from('<I', data, off + 32)[0], *struct.unpack_from('<2I', data, off + 68)
    p = off + 76 + image + 16 * n_rel
    for _ in range(n_imp):
        p = data.index(b'\0', p) + 1
    meta = dict(l.split('=', 1) for l in data[p:off + ln].decode().splitlines() if '=' in l)
    return name.split(b'\0')[0].decode(), ('synth', 'fx', 'seq', 'drum', 'sampler')[kind], meta


def ldr_ident(ldr):
    """boot text of the release ("op1r <n>"): the web updater compares it with the OP-1's IDENT"""
    import re
    m = re.search(rb'\n{17} *(op1r [ -~]*)', ldr)
    return m.group(1).decode() if m else ''


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('original', help='original firmware .op1 (op1_246.op1)')
    ap.add_argument('custom', help='unpacked custom firmware tree (op1_246_custom)')
    ap.add_argument('--reference', help='write the reference image here (default: <custom>-patched.op1)')
    ap.add_argument('--title', default='OP-1 R246 custom firmware (synth SDK)')
    a = ap.parse_args()

    op1 = open(a.original, 'rb').read()
    _, members = P.unpack(op1)
    orig = {m.name: d for m, d in members if m.isfile()}
    dirs = {m.name for m, _ in members if m.isdir()}

    shutil.rmtree(P.DATA, ignore_errors=True)
    blobdir = P.DATA
    os.makedirs(os.path.join(blobdir, 'files'))
    patched, added, plugins = [], [], []
    os.makedirs(os.path.join(blobdir, 'plugins'))
    import re                                                     # local builds stamp the boot text with the time
    ldr = open(os.path.join(a.custom, 'OP1_vdk.ldr'), 'rb').read()
    if re.search(rb'op1r \d+ \d{4}-\d\d-\d\d \d\d:\d\d', ldr):
        sys.exit('ERROR: the custom tree is a local build (build time on the boot screen); '
                 'rebuild with make_firmware.py --opz --release')
    for root, _, files in os.walk(a.custom):
        for fn in sorted(files):
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, a.custom).replace(os.sep, '/')
            if fn.startswith('.'):
                continue
            data = open(full, 'rb').read()
            if rel.startswith('plugins/'):                 # plugin files: our code + SVG, shipped whole, selectable
                name, kind, meta = plugin_info(data)
                shutil.copy(full, os.path.join(blobdir, 'plugins', fn))
                plugins.append({'name': name, 'kind': kind, 'author': meta.get('author', ''), 'file': fn,
                                'size': len(data), 'sha256': P.sha256(data)})
                print(f'plugin  {rel} ({kind} {name})')
                continue
            if rel in orig:
                if data != orig[rel]:
                    ops = file_ops(rel, orig[rel], data, blobdir)
                    patched.append({'path': rel, 'orig_sha256': P.sha256(orig[rel]),
                                    'result_sha256': P.sha256(data), 'ops': ops})
                    print(f'patched {rel}: {len(ops)} ops')
            else:
                parent = posixpath.dirname(rel)
                if parent not in dirs:
                    sys.exit(f'{rel}: new directory {parent} not supported')
                sib = sorted(n for n in orig if posixpath.dirname(n) == parent)
                if not sib:
                    sys.exit(f'{rel}: no stock sibling file for metadata')
                same = sorted(n for n, d in orig.items() if d == data)
                if same:                                   # copy of a stock file: do not ship it
                    added.append({'path': rel, 'copy_of': same[0], 'sha256': P.sha256(data), 'template': sib[0]})
                    print(f'added   {rel} (copy of {same[0]})')
                    continue
                blob = 'files/' + rel.replace('/', '_')
                open(os.path.join(blobdir, blob), 'wb').write(data)
                added.append({'path': rel, 'blob': blob, 'sha256': P.sha256(data), 'template': sib[0]})
                print(f'added   {rel}')
    gone = [n for n in orig if not os.path.exists(os.path.join(a.custom, n))]
    if gone:
        sys.exit('deleted files are not supported: ' + ', '.join(gone))
    patched.sort(key=lambda f: f['path']); added.sort(key=lambda f: f['path'])

    man = {'title': a.title,
           'description': ['op1r 2: custom synth engines with own screens (supersaw, fmbell, granular), iter lab screen,',
                           'tape echo + clouds granular FX with own screens, quad LFO (4 LFOs, voice/free),\n'
                           '  euclid sequencer (6 slots), OP-Z controller mode (SysEx F0 00 20 76 00 01 03 F7).',
                           'Built with synth_sdk/make_firmware.py; see docs/.'],
           'original': {'name': os.path.basename(a.original), 'sha256': P.sha256(op1)},
           'patched_files': patched, 'added_files': added,
           'plugins': sorted(plugins, key=lambda p: (('synth', 'fx', 'seq', 'drum', 'sampler').index(p['kind']), p['file'])),
           'plugin_dir_template': 'content', 'plugin_file_template': 'content/op1_factory.db',
           'result': {'tar_sha256': '', 'sha256': ''}}

    # reference: run the real patch pipeline once (per-file checks active, result not known yet)
    out, tar_bytes = P.patch(op1, man, verify=False)
    man['result'] = {'tar_sha256': P.sha256(tar_bytes), 'sha256': P.sha256(out), 'size': len(out),
                     'ident': ldr_ident(ldr)}
    json.dump(man, open(os.path.join(P.DATA, 'manifest.json'), 'w'), indent=1)

    ref = a.reference or os.path.normpath(a.custom) + '-patched.op1'
    open(ref, 'wb').write(out)
    # sanity: the reference unpacks to exactly the custom tree
    _, chk = P.unpack(out)
    for m, d in chk:
        if m.isfile() and d != open(os.path.join(a.custom, m.name), 'rb').read():
            sys.exit(f'reference differs from the custom tree in {m.name}')
    print(f'\nreference image {ref}\n  sha256 {man["result"]["sha256"]}\n  tar    {man["result"]["tar_sha256"]}')
    size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(P.DATA) for f in fs)
    print(f'patcher/data: {size:,} bytes')


if __name__ == '__main__':
    main()
