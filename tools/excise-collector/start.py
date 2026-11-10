#!/usr/bin/env python3
"""Launch the copied collector, keeping all output beside this program."""
import sys
from pathlib import Path

if sys.version_info < (3, 10):
    raise SystemExit('Python 3.10 or newer is required. Use the included launcher for your computer.')

from excise_collector.cli import main

if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    sys.argv = [str(root / 'collect.py'), '--data-dir', str(root / 'raw data'), 'serve', '--port', '0', '--open-browser', '--initialize']
    main()
