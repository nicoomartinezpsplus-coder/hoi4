"""Reproduce the bundled CShapes 2.0 historical snapshot from a pinned source."""
import hashlib
import json
import lzma
from pathlib import Path
import subprocess
import tempfile
import urllib.request

COMMIT = '54840534d9a82cfd01caf1021f85933e701e8318'
SHA256 = '196c6d9d881cf944e176e4ce5bfc61074d21792de7152cb0a9e035e56b0297c8'
URL = f'https://raw.githubusercontent.com/cran/cshapes/{COMMIT}/inst/extdata/cshapes_2_gw.topojson.xz'
ROOT = Path(__file__).resolve().parent.parent
with urllib.request.urlopen(URL, timeout=60) as response:
    artifact = response.read()
if hashlib.sha256(artifact).hexdigest() != SHA256:
    raise RuntimeError('CShapes SHA-256 verification failed; refusing to use this artifact.')
topology = json.loads(lzma.decompress(artifact))
geometries = [g for g in topology['objects']['cshapes_2_gw']['geometries']
              if g['properties']['start'] <= '1936-01-01' <= g['properties']['end']]
snapshot = {'type': topology['type'], 'arcs': topology['arcs'],
            'objects': {'countries': {'type': 'GeometryCollection', 'geometries': geometries}}}
with tempfile.TemporaryDirectory(prefix='ironfront-map-') as folder:
    path = Path(folder) / 'snapshot.topojson'
    path.write_text(json.dumps(snapshot), encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'scripts/prepare-map.mjs'), str(path)], cwd=ROOT, check=True)
    subprocess.run(['node', str(ROOT / 'scripts/prepare-provinces.mjs')], cwd=ROOT, check=True)
