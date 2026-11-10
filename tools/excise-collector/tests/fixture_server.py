"""Local integration-test server; uses only synthetic reports and TEST codes."""
import json
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from excise_collector.store import Store
from excise_collector.service import Collector
from excise_collector.server import make_server
from fixtures import FakePortal, catalogue

with tempfile.TemporaryDirectory(prefix='excise-synthetic-') as directory:
    store = Store(Path(directory)); store.save_catalogue(catalogue())
    store.plan(catalogue(), [2026], '1501', 1, 3)
    collector = Collector(store, FakePortal())
    server = make_server(collector, 0)
    print(json.dumps({'url': f'http://127.0.0.1:{server.server_port}', 'directory': directory}), flush=True)
    try:
        while True: server.handle_request()
    except KeyboardInterrupt: pass
    finally: collector.pause(); server.server_close(); store.close()
