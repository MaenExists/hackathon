from __future__ import annotations

import argparse
import json
import signal
import sys
import threading
import webbrowser
from pathlib import Path

from .portal import Portal, PortalError
from .server import make_server
from .service import Collector
from .store import Store
from .locking import FileLock

PROGRAM_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PROGRAM_ROOT.parent.parent
DEFAULT_ROOT = (PROJECT_ROOT if PROGRAM_ROOT.parent.name == 'tools' and (PROJECT_ROOT / 'project.md').is_file() else PROGRAM_ROOT) / 'raw data'


def main():
    parser = argparse.ArgumentParser(description='Resumable, human-assisted Kerala Excise NDPS PDF collector. No CAPTCHA bypass.')
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_ROOT, help='Private output folder (default: project/raw data).')
    parser.add_argument('--interval', type=float, default=2, help='Minimum seconds between portal requests; at least 2.')
    parser.add_argument('--request-budget', type=int, default=1000, help='Maximum portal HTTP requests per invocation.')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('discover', help='Read the public form and save the token-free office catalogue.')
    plan = sub.add_parser('plan', help='Add a bounded office/year scope to the durable queue.')
    plan.add_argument('--years', type=int, nargs='+', default=[2025, 2026], choices=[2025, 2026])
    plan.add_argument('--office', default='', help='Office name fragment, ID, or era:ID. Empty selects all offices.')
    plan.add_argument('--era', default='all', choices=['all', 'before', 'after'])
    plan.add_argument('--start-cr', type=int, default=1)
    plan.add_argument('--max-cr', type=int, default=999)
    sub.add_parser('status', help='Summarize checked numbers, unresolved work and document counts.')
    sub.add_parser('export', help='Rebuild report.json, search_coverage.csv and manifest.jsonl.')
    verify = sub.add_parser('verify', help='Check every saved PDF against its recorded hash and size.')
    verify.add_argument('--repair', action='store_true', help='Queue affected queries for manual recollection; preserve corrupt bytes in quarantine.')
    serve = sub.add_parser('serve', help='Start the local security-code entry and download workbench.')
    serve.add_argument('--port', type=int, default=8765)
    serve.add_argument('--open-browser', action='store_true')
    serve.add_argument('--initialize', action='store_true', help='Discover offices and create the default queue only if absent.')
    args = parser.parse_args()
    store = Store(args.data_dir)
    lock = None
    try:
        if args.command != 'status' and not (args.command == 'verify' and not args.repair):
            try: lock = FileLock(store.root / '.collector.lock')
            except BlockingIOError: parser.exit(1, 'Another collector is using this folder. Stop it before changing the queue.\n')
        if args.command == 'discover':
            _, catalogue = Portal(args.interval, args.request_budget).form()
            store.save_catalogue(catalogue)
            summary = {'catalogue': str(store.root / 'catalogue.json'), 'offices': {era: sum(o['era'] == era for o in catalogue['offices']) for era in ('before', 'after')},
                       'public_form_cr_max': catalogue['public_form_cr_max'], 'case_searches_submitted': 0}
        elif args.command == 'plan':
            catalogue = store.get_meta('catalogue')
            if not catalogue: raise ValueError('Run discover first.')
            summary = store.plan(catalogue, args.years, args.office, args.start_cr, args.max_cr, args.era)
        elif args.command == 'status': summary = store.report()
        elif args.command == 'export':
            store.export(); summary = {'exported_to': str(store.root)}
        elif args.command == 'verify':
            summary = store.verify(args.repair)
            print(json.dumps(summary, indent=2, ensure_ascii=False))
            if summary['errors']: raise SystemExit(2)
            return
        elif args.command == 'serve':
            portal = Portal(args.interval, args.request_budget)
            if args.initialize:
                catalogue = store.get_meta('catalogue')
                if catalogue is None:
                    try:
                        _, catalogue = portal.form(); store.save_catalogue(catalogue)
                    except PortalError as e:
                        print(f'Office discovery pending: {e}. Use Refresh office catalogue when connected.', flush=True)
                if catalogue and not store.report()['office_year_streams']: store.plan(catalogue)
            collector = Collector(store, portal)
            server = make_server(collector, args.port)
            url = f'http://127.0.0.1:{server.server_port}'
            print(f'Collector: {url}', flush=True)
            print(f'Output: {store.root}\nEach submission needs a freshly entered human security code. Ctrl+C to stop.', flush=True)
            if args.open_browser:
                opener = threading.Timer(.5, webbrowser.open, args=(url,)); opener.daemon = True; opener.start()
            def stop(_signum, _frame): raise KeyboardInterrupt
            signal.signal(signal.SIGTERM, stop)
            try:
                while True: server.handle_request()
            except KeyboardInterrupt: pass
            finally:
                collector.pause(); store.export(); server.server_close()
            return
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    except (ValueError, PortalError, OSError) as e:
        parser.exit(1, f'{e}\n')
    finally:
        store.close()
        if lock: lock.close()


if __name__ == '__main__': main()
