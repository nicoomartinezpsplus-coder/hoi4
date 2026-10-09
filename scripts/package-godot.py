#!/usr/bin/env python3
"""Package desktop builds, license texts, source links and SHA-256 checksums."""
import hashlib
import argparse
import pathlib
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "downloads"
OUTPUT.mkdir(exist_ok=True)
NOTICE = """IRONFRONT · 1936 — Godot Edition 2.0.0

Windows: extract this archive, then double-click IRONFRONT.exe.
Linux: extract, chmod +x IRONFRONT.x86_64, then run ./IRONFRONT.x86_64.
No browser, npm, Node.js or editor is required for these desktop builds.
Space pauses time; 1-5 selects speed; F5 saves; F9 loads.

КАК ЗАПУСТИТЬ В WINDOWS
Распакуйте архив и дважды нажмите IRONFRONT.exe.
Пробел — пауза; 1–5 — скорость; F5 — сохранить, F9 — загрузить.
Выберите войска слева, объявите войну в дипломатии и нажмите на город.
Начинайте с соседних областей. Захват города не передаёт всю страну.
Автоматическое сохранение каждые 10 секунд.

Source and instructions: https://github.com/nicoomartinezpsplus-coder/hoi4
Native source: godot/; open godot/project.godot in Godot 4.6.3 or newer.
Game/source: GPL-3.0. Map: CShapes 2.0, Nils B. Weidmann, Guy Schvitz,
Luc Girardin; GW snapshot 1936-01-01, derived under GPL-3.0.
City region boundaries are generated gameplay regions, not historical provinces.
Godot engine: MIT, see licenses/Godot-LICENSE.txt and Godot-COPYRIGHT.txt.
Manrope and Barlow Condensed: SIL OFL, see licenses/.
These builds are unsigned. No assets or code from Hearts of Iron IV are used.
"""

checksums = []
parser = argparse.ArgumentParser()
parser.add_argument("--platform", choices=["Windows", "Linux", "all"], default="all")
selected_platform = parser.parse_args().platform
for platform, filename in [("Windows", "windows/IRONFRONT.exe"), ("Linux", "linux/IRONFRONT.x86_64")]:
    if selected_platform not in ["all", platform]:
        continue
    binary = ROOT / "godot/builds" / filename
    if not binary.exists():
        continue
    archive = OUTPUT / f"IRONFRONT-Godot-{platform}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as target:
        target.write(binary, binary.name)
        target.writestr("START-HERE.txt", NOTICE)
        target.write(ROOT / "LICENSE", "LICENSE")
        for license_file in (ROOT / "godot/licenses").glob("*.txt"):
            target.write(license_file, "licenses/" + license_file.name)
        for name in ["Manrope-OFL.txt", "Barlow-OFL.txt"]:
            target.write(ROOT / "godot/fonts" / name, "licenses/" + name)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksums.append(f"{digest}  {archive.name}")
    print(f"{archive.name}: {archive.stat().st_size / 1024**2:.1f} MiB")
(OUTPUT / "SHA256SUMS.txt").write_text("\n".join(checksums) + "\n")
