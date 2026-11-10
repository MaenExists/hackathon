#!/usr/bin/env python3
"""Build an offline-installable bundle from checksum-pinned upstream runtimes."""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import shutil
import sqlite3
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.runtime' / 'downloads'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()


def download(source):
    path = CACHE / source['name']
    if path.is_file() and digest(path) == source['sha256']: return path
    temporary = path.with_name(path.name + '.part')
    with urllib.request.urlopen(source['url'], timeout=120) as response, temporary.open('wb') as target:
        shutil.copyfileobj(response, target, length=1024 * 1024)
    if digest(temporary) != source['sha256']:
        raise RuntimeError(f"Upstream checksum verification failed: {source['name']}")
    temporary.replace(path)
    print(f"Verified {source['target']}", flush=True)
    return path


def build(destination: Path, sources: list[dict], data_dir: Path | None):
    destination.mkdir(parents=True, exist_ok=False)
    ignore = shutil.ignore_patterns('__pycache__', '.runtime', '*.pyc')
    for name in ('excise_collector', 'tests'):
        shutil.copytree(ROOT / name, destination / name, ignore=ignore)
    for source in ROOT.iterdir():
        if source.is_file() and source.suffix in ('.py', '.md', '.txt', '.json', '.sh', '.command', '.bat'):
            target = destination / source.name; shutil.copy2(source, target)
            if source.suffix == '.bat': target.write_bytes(target.read_bytes().replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
    runtimes = destination / 'runtimes'; runtimes.mkdir()
    manifest = []
    for source in sources:
        windows = source['target'].startswith('windows-')
        target = runtimes / (source['target'] + ('.zip' if windows else '.tar.gz'))
        original = CACHE / source['name']
        if windows:
            # Embed mode normally excludes the application directory. Add the
            # relative program root without depending on a user-installed Python.
            with zipfile.ZipFile(original) as input_zip, zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as output_zip:
                for item in input_zip.infolist():
                    data = input_zip.read(item.filename)
                    if item.filename.endswith('._pth'):
                        data = b'python314.zip\r\n.\r\n..\\..\r\n'
                    output_zip.writestr(item, data)
        else: shutil.copy2(original, target)
        manifest.append({**source, 'bundled_path': target.relative_to(destination).as_posix(),
                         'bundled_sha256': digest(target), 'embed_path_adjusted': windows})
    (destination / 'runtime-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    output_data = destination / 'raw data'; output_data.mkdir(mode=0o700)
    if data_dir and data_dir.exists():
        database = data_dir / 'collector.sqlite3'
        if database.exists():
            with sqlite3.connect(f'{database.resolve().as_uri()}?mode=ro', uri=True) as src, sqlite3.connect(output_data / 'collector.sqlite3') as dst:
                src.backup(dst)
        for source in data_dir.iterdir():
            if source.name.startswith(('collector.sqlite3', '.collector.lock')): continue
            if source.is_dir(): shutil.copytree(source, output_data / source.name, symlinks=False)
            elif source.is_file(): shutil.copy2(source, output_data / source.name)
        from excise_collector.store import Store
        copied_store = Store(output_data); copied_store.recover(); copied_store.export(); copied_store.close()
    checksums = []
    for path in sorted(destination.rglob('*')):
        if path.is_file(): checksums.append(f'{digest(path)}  {path.relative_to(destination).as_posix()}')
    (destination / 'SHA256SUMS').write_text('\n'.join(checksums) + '\n', encoding='utf-8')
    archive = destination.with_suffix('.zip')
    if archive.exists(): raise FileExistsError(archive)
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as bundle:
        for path in sorted(destination.rglob('*')):
            if path.is_file():
                # Runtime archives are already compressed. Preserve launcher modes
                # in ZIP even when an extracted folder travels on a FAT USB drive.
                compression = zipfile.ZIP_STORED if path.parent == runtimes else zipfile.ZIP_DEFLATED
                bundle.write(path, Path(destination.name) / path.relative_to(destination), compress_type=compression)
    return {'folder': str(destination), 'zip': str(archive), 'zip_sha256': digest(archive),
            'files_verified': len(checksums), 'runtime_targets': [s['target'] for s in sources]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download-only', action='store_true')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--data-dir', type=Path)
    args = parser.parse_args()
    sources = json.loads((ROOT / 'runtime-sources.json').read_text())['sources']
    CACHE.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, sources))
    if args.download_only: return
    if not args.output: parser.error('--output is required unless --download-only is used')
    print(json.dumps(build(args.output.resolve(), sources, args.data_dir), indent=2))


if __name__ == '__main__': main()
