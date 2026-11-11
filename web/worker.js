// Runs the unchanged patch_op1.py in Pyodide (Python + liblzma compiled to WebAssembly), off the UI thread.
// The firmware never leaves the browser: it is passed in as bytes and the result is passed back.
const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';   // tested: output matches the reference sha256
const { loadPyodide } = await import(PYODIDE + 'pyodide.mjs');   // module worker (classic workers unsupported)

const say = (type, data, transfer = []) => postMessage({ type, ...data }, transfer);
let ready;

async function setup() {
  say('log', { text: 'loading Python (first time ~10 MB, then cached) ...' });
  const py = await loadPyodide({ indexURL: PYODIDE });
  await py.loadPackage('lzma').catch(() => {});   // separate package in older Pyodide, built in since 314
  const get = async (p) => {
    const r = await fetch('../' + p, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`cannot load ${p} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  };
  py.FS.mkdirTree('/op1r/data/files');
  py.FS.writeFile('/op1r/patch_op1.py', await get('patch_op1.py'));
  const manBytes = await get('data/manifest.json');
  py.FS.writeFile('/op1r/data/manifest.json', manBytes);
  const man = JSON.parse(new TextDecoder().decode(manBytes));
  const blobs = new Set();
  for (const f of man.patched_files) for (const o of f.ops) if (o.blob) blobs.add(o.blob);
  for (const f of man.added_files) if (f.blob) blobs.add(f.blob);
  for (const b of blobs) py.FS.writeFile('/op1r/data/' + b, await get('data/' + b));
  py.FS.mkdirTree('/op1r/data/plugins');
  for (const p of man.plugins || []) py.FS.writeFile('/op1r/data/plugins/' + p.file, await get('data/plugins/' + p.file));
  py.runPython("import sys; sys.path.insert(0, '/op1r'); import patch_op1 as P; MAN = P.load_manifest()");
  return py;
}

onmessage = async (e) => {
  try {
    ready = ready || setup().catch((err) => { ready = null; throw err; });   // a failed start is tried again
    const py = await ready;
    py.FS.writeFile('/in.op1', new Uint8Array(e.data.op1));
    py.globals.set('PLUGINS', py.toPy(e.data.plugins));
    py.globals.set('log', (t) => say('log', { text: t }));
    // fail() in patch_op1.py calls sys.exit('ERROR: ...') -> SystemExit, reported below
    const res = py.runPython(`
op1 = open('/in.op1', 'rb').read()
h = P.sha256(op1)
if h != MAN['original']['sha256']:
    raise SystemExit('This is not the original OP-1 firmware ' + MAN['original']['name'] +
                     ' (sha256 ' + h[:16] + '...). Download it from teenage.engineering and try again.')
log('input OK: ' + MAN['original']['name'])
out, tar_bytes = P.patch(op1, MAN, log=log, plugins=list(PLUGINS))
open('/out.op1', 'wb').write(out)
import io, tarfile                                   # unpacked files for the SysEx update (devupd.js)
FILES = []
with tarfile.open(fileobj=io.BytesIO(tar_bytes)) as t:
    for m in t.getmembers():
        if m.isfile(): FILES.append((m.name, t.extractfile(m).read()))
h = P.sha256(out)
(h, h == MAN['result']['sha256'])
`).toJs();
    const out = py.FS.readFile('/out.op1');
    const files = py.globals.get('FILES').toJs().map(([p, d]) => [p, d.slice()]);
    py.runPython('del FILES');
    say('done', { out, files, sha: res[0], exact: res[1], plugins: e.data.plugins }, [out.buffer, ...files.map(([, d]) => d.buffer)]);
  } catch (err) {
    const m = String(err.message || err).match(/SystemExit: (.*)/s);
    say('error', { text: m ? m[1].trim() : String(err) });
  }
};
