# Portable runtime notices

The collector itself uses only the Python standard library. The portable package redistributes CPython and its bundled dependencies with their original licenses retained inside each runtime archive.

- Windows: Python 3.14.10 embeddable distributions from the Python Software Foundation, https://www.python.org/downloads/release/python-31410/ . Python is distributed under the PSF License Agreement and included third-party license terms. The only distribution adjustment is `python314._pth`, adding the application root as a relative import directory. License files are preserved unchanged.
- Linux/macOS: CPython 3.13.18, Astral python-build-standalone release 20261026, https://github.com/astral-sh/python-build-standalone/releases/tag/20261026 . Archives are redistributed unchanged. Python and dependency license files remain in `python/licenses/` and/or the runtime's included license locations. Upstream build/distribution documentation: https://github.com/astral-sh/python-build-standalone .

`runtime-sources.json` records upstream URLs and authoritative published SHA-256 digests. `runtime-manifest.json` in the generated package also records the actual bundled archive hashes. Neither the collector nor this project is an official Kerala Excise product. Portal content remains attributable to Kerala Excise and is kept separately as original source material, not relicensed by this tool.
