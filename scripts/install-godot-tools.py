#!/usr/bin/env python3
"""Install pinned Godot tools locally, verifying official SHA-512 checksums."""
import hashlib
import os
import pathlib
import shutil
import subprocess
import urllib.request
import zipfile

VERSION = "4.6.3"
ROOT = pathlib.Path(os.environ.get("IRONFRONT_GODOT_DIR", "/tmp/ironfront-godot"))
BASE = f"https://github.com/godotengine/godot-builds/releases/download/{VERSION}-stable"
DOWNLOADS = ROOT / "downloads"
DOWNLOADS.mkdir(parents=True, exist_ok=True)
for part in ["bin", "data", "cache", "config"]:
    (ROOT / part).mkdir(exist_ok=True)


def download(url, target):
    temporary = target.with_suffix(target.suffix + ".part")
    with urllib.request.urlopen(url, timeout=120) as response, temporary.open("wb") as output:
        shutil.copyfileobj(response, output)
    temporary.replace(target)


manifest = DOWNLOADS / "SHA512-SUMS.txt"
if not manifest.exists():
    download(f"{BASE}/SHA512-SUMS.txt", manifest)
checksums = {}
for line in manifest.read_text().splitlines():
    fields = line.split()
    if len(fields) == 2:
        checksums[fields[1].lstrip("*")] = fields[0]


def artifact(name, target):
    if not target.exists():
        print(f"Downloading {name}", flush=True)
        download(f"{BASE}/{name}", target)
    digest = hashlib.sha512()
    with target.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != checksums[name]:
        raise RuntimeError(f"SHA-512 mismatch: {target}. Remove this file before retrying.")
    return target


binary = ROOT / "bin/godot"
installed = shutil.which("godot")
environment = dict(os.environ, XDG_CACHE_HOME=str(ROOT / "cache"))
if installed and subprocess.check_output([installed, "--version"], env=environment, text=True).startswith(VERSION + "."):
    if not binary.exists():
        binary.symlink_to(installed)
elif not binary.exists():
    name = f"Godot_v{VERSION}-stable_linux.x86_64.zip"
    archive = artifact(name, DOWNLOADS / "editor.zip")
    with zipfile.ZipFile(archive) as source:
        binary.write_bytes(source.read(f"Godot_v{VERSION}-stable_linux.x86_64"))
    binary.chmod(0o755)

archive = artifact(f"Godot_v{VERSION}-stable_export_templates.tpz", DOWNLOADS / "templates.tpz")
templates = ROOT / f"data/godot/export_templates/{VERSION}.stable"
templates.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as source:
    for name in ["windows_release_x86_64.exe", "windows_debug_x86_64.exe", "linux_release.x86_64", "linux_debug.x86_64", "version.txt"]:
        target = templates / name
        target.write_bytes(source.read("templates/" + name))
        if "linux" in name:
            target.chmod(0o755)
print(f"Godot {VERSION} and desktop export templates ready in {ROOT}")
