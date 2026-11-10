"""Loopback-only workbench. No generic file server or third-party resources."""
from __future__ import annotations

import json
import secrets
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from .portal import PortalError
from .service import Collector

ASSETS = Path(__file__).parent / 'assets'


def make_server(collector: Collector, port=8765):
    secret = secrets.token_urlsafe(32)

    class Handler(BaseHTTPRequestHandler):
        server_version = 'LocalCollector/1.0'

        def log_message(self, format, *args):
            pass  # Local filenames, case parameters and cookies do not enter access logs.

        @property
        def origin(self): return f'http://127.0.0.1:{self.server.server_port}'

        def send(self, body, status=200, mime='application/json; charset=utf-8', *, cookie=False, download=None):
            if not isinstance(body, bytes): body = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
            if cookie: self.send_header('Set-Cookie', f'collector={secret}; HttpOnly; SameSite=Strict; Path=/')
            if download: self.send_header('Content-Disposition', f'attachment; filename="{download}"')
            self.end_headers()
            try: self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError): pass

        def allowed_host(self):
            return self.headers.get('Host') == f'127.0.0.1:{self.server.server_port}'

        def authorized(self):
            try:
                cookie = SimpleCookie(); cookie.load(self.headers.get('Cookie', ''))
                token = cookie['collector'].value if 'collector' in cookie else ''
                return secrets.compare_digest(token, secret)
            except Exception: return False

        def do_GET(self):
            if not self.allowed_host(): return self.send({'error': 'Use the printed loopback URL.'}, 403)
            path = urlsplit(self.path).path
            if path == '/':
                # Only a top-level same-site visit can initialize the local cookie.
                if self.headers.get('Sec-Fetch-Site') not in (None, 'none', 'same-origin', 'same-site'):
                    return self.send({'error': 'Cross-site request rejected.'}, 403)
                return self.send((ASSETS / 'index.html').read_bytes(), mime='text/html; charset=utf-8', cookie=True)
            if not self.authorized(): return self.send({'error': 'Open the local collector page first.'}, 403)
            if path in ('/app.js', '/style.css'):
                return self.send((ASSETS / path[1:]).read_bytes(), mime='text/javascript; charset=utf-8' if path.endswith('.js') else 'text/css; charset=utf-8')
            if path == '/api/state': return self.send(collector.state())
            if path.startswith('/files/'):
                digest = path.removeprefix('/files/').removesuffix('.pdf')
                if len(digest) == 64 and all(c in '0123456789abcdef' for c in digest):
                    row = collector.store.db.execute('SELECT path FROM documents WHERE sha256=?', (digest,)).fetchone()
                    if row:
                        try: return self.send((collector.store.root / row['path']).read_bytes(), mime='application/pdf', download=f'NDPS-{digest[:12]}.pdf')
                        except OSError: return self.send({'error': 'Stored PDF is missing; run verify.'}, 404)
            return self.send({'error': 'Not found.'}, 404)

        def do_POST(self):
            if not self.allowed_host() or not self.authorized() or self.headers.get('Origin') != self.origin:
                return self.send({'error': 'Only the local collector page may perform actions.'}, 403)
            if self.headers.get_content_type() != 'application/json':
                return self.send({'error': 'Use JSON requests.'}, 415)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 8192: raise ValueError('Invalid request size.')
                body = json.loads(self.rfile.read(length))
                if not isinstance(body, dict): raise ValueError('Expected a JSON object.')
                path = urlsplit(self.path).path
                if path == '/api/discover': return self.send({'catalogue': collector.discover()})
                if path == '/api/next': return self.send(collector.prepare())
                if path == '/api/pause':
                    collector.pause(); return self.send(collector.state())
                if path == '/api/submit': return self.send(collector.submit(body.get('id', ''), body.get('code', '')))
                if path == '/api/retry':
                    collector.pause(); collector.store.retry(int(body['task_id'])); return self.send(collector.state())
                if path == '/api/plan':
                    if collector.active: raise ValueError('Pause the active query before changing scope.')
                    catalogue = collector.store.get_meta('catalogue')
                    if not catalogue: raise ValueError('Discover the office catalogue first.')
                    years = body.get('years', [2025, 2026])
                    if not isinstance(years, list): raise ValueError('Years must be a list.')
                    result = collector.store.plan(catalogue, years=years, office=str(body.get('office', '')),
                                                  start=int(body.get('start', 1)), end=int(body.get('end', 999)),
                                                  era=body.get('era', 'all'))
                    return self.send(result)
                return self.send({'error': 'Not found.'}, 404)
            except PortalError as e:
                return self.send({'error': str(e), 'outcome': e.outcome, 'retry_after': e.retry_after}, 503 if e.retry_after else 409)
            except (ValueError, KeyError, TypeError, OverflowError) as e:
                return self.send({'error': str(e)}, 400)
            except Exception as e:
                # Request contents and case material never appear in browser errors.
                return self.send({'error': f'Local operation failed ({type(e).__name__}). Progress is checkpointed; check disk space and restart if needed.'}, 500)

    # Serial HTTP handling also serializes the upstream session and SQLite usage.
    server = HTTPServer(('127.0.0.1', port), Handler)
    server.timeout = 1
    return server
