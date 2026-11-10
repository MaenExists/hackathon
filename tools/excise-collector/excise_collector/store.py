"""Durable bounded search coverage and immutable original document storage."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import sqlite3
import tempfile
import time
from pathlib import Path

from .portal import FORM_URL, SUBMIT_URL, Result, now, validate_pdf


def atomic(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data); f.flush(); os.fsync(f.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def json_bytes(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


class Store:
    def __init__(self, root: Path):
        self._last_export = 0.0
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(self.root / 'collector.sqlite3', timeout=15)
        os.chmod(self.root / 'collector.sqlite3', 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS streams(
          id TEXT PRIMARY KEY, year INTEGER NOT NULL, era TEXT NOT NULL,
          office_id TEXT NOT NULL, office_name TEXT NOT NULL,
          start_cr INTEGER NOT NULL, end_cr INTEGER NOT NULL, next_cr INTEGER NOT NULL,
          planned_at TEXT NOT NULL, catalogue_sha256 TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks(
          id INTEGER PRIMARY KEY, stream_id TEXT NOT NULL REFERENCES streams(id),
          cr_number INTEGER NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL,
          message TEXT NOT NULL DEFAULT '', UNIQUE(stream_id,cr_number));
        CREATE TABLE IF NOT EXISTS attempts(
          id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id),
          started_at TEXT NOT NULL, finished_at TEXT, outcome TEXT NOT NULL,
          message TEXT NOT NULL DEFAULT '', http_status INTEGER);
        CREATE TABLE IF NOT EXISTS documents(
          sha256 TEXT PRIMARY KEY, path TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS downloads(
          id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id),
          attempt_id INTEGER NOT NULL UNIQUE REFERENCES attempts(id),
          sha256 TEXT NOT NULL REFERENCES documents(sha256), retrieved_at TEXT NOT NULL,
          metadata_path TEXT NOT NULL UNIQUE);
        CREATE INDEX IF NOT EXISTS task_status ON tasks(status,id);
        CREATE INDEX IF NOT EXISTS attempt_task ON attempts(task_id,id);
        ''')

    def close(self): self.db.close()

    def get_meta(self, key, default=None):
        row = self.db.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else default

    def set_meta(self, key, value):
        with self.db:
            self.db.execute('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                            (key, json.dumps(value)))

    def save_catalogue(self, catalogue: dict):
        previous = self.get_meta('catalogue')
        if previous:
            # IDs that disappeared are never silently removed from an existing plan.
            old = {(o['era'], o['id']) for o in previous['offices']}
            new = {(o['era'], o['id']) for o in catalogue['offices']}
            catalogue['office_changes'] = {'added': [list(x) for x in sorted(new - old)],
                                            'removed': [list(x) for x in sorted(old - new)]}
        self.set_meta('catalogue', catalogue)
        atomic(self.root / 'catalogue.json', json_bytes(catalogue))
        # Tokens/images change on every form load. Archive semantic catalogue
        # changes only, rather than duplicating hundreds of KB per case search.
        signature = hashlib.sha256(json_bytes({k: catalogue[k] for k in
            ('offices', 'case_type', 'transition_date', 'public_form_cr_min', 'public_form_cr_max')})).hexdigest()
        archive = self.root / 'discovery' / (signature + '.json')
        if not archive.exists(): atomic(archive, json_bytes(catalogue))

    def plan(self, catalogue: dict, years=(2025, 2026), office: str = '', start=1, end=999, era='all') -> dict:
        if not years or any(y not in (2025, 2026) for y in years): raise ValueError('Select 2025 and/or 2026.')
        if not 1 <= start <= end <= catalogue['public_form_cr_max']: raise ValueError('Use CR bounds between 1 and the observed public form maximum (999).')
        if era not in ('all', 'before', 'after'): raise ValueError('Invalid registration period.')
        matches = []
        for year in sorted(set(years)):
            for o in catalogue['offices']:
                if year == 2026 and o['era'] == 'before': continue
                if era != 'all' and o['era'] != era: continue
                if office and office.casefold() not in o['name'].casefold() and office not in (o['id'], f"{o['era']}:{o['id']}"): continue
                matches.append((year, o))
        if not matches: raise ValueError('No offices match this scope. Use an office name fragment or the listed identifier.')
        with self.db:
            for year, office_info in matches:
                stream_id = f"{year}:{office_info['era']}:{office_info['id']}"
                self.db.execute('''INSERT INTO streams VALUES(?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET office_name=excluded.office_name,
                start_cr=MIN(streams.start_cr,excluded.start_cr),
                end_cr=MAX(streams.end_cr,excluded.end_cr),
                next_cr=MIN(streams.next_cr,excluded.next_cr)''',
                (stream_id, year, office_info['era'], office_info['id'], office_info['name'], start, end, start,
                 now(), catalogue['source_sha256']))
        self.set_meta('focus', {'stream_ids': [f"{y}:{o['era']}:{o['id']}" for y, o in matches],
                                'start_cr': start, 'end_cr': end, 'office': office,
                                'years': sorted(set(years)), 'era': era})
        self.export()
        return {'selected_streams': len(matches), 'selected_lookups': len(matches) * (end - start + 1),
                'note': 'Scope is now active. Earlier scopes and their results remain saved.'}

    def recover(self):
        with self.db:
            self.db.execute("UPDATE tasks SET status='retry',message='Interrupted before a durable result; retry with a new security code.',updated_at=? WHERE status IN ('awaiting_code','submitting')", (now(),))
            self.db.execute("UPDATE attempts SET outcome='interrupted',finished_at=?,message='Collector restarted before completion.' WHERE outcome='submitting'", (now(),))

    def task(self, task_id: int) -> dict:
        row = self.db.execute('''SELECT t.*,s.year,s.era,s.office_id,s.office_name,s.catalogue_sha256
        FROM tasks t JOIN streams s ON s.id=t.stream_id WHERE t.id=?''', (task_id,)).fetchone()
        if not row: raise ValueError('Unknown query.')
        return dict(row)

    def next_task(self) -> dict | None:
        focus = self.get_meta('focus')
        scope, args = self._scope(focus)
        low, high = (focus['start_cr'], focus['end_cr']) if focus else (1, 999)
        with self.db:
            # Explicit retries retain the exact query. No absence is inferred from failure.
            retry = self.db.execute(f'''SELECT t.id FROM tasks t JOIN streams s ON s.id=t.stream_id
                WHERE t.status IN ('retry','awaiting_code') AND {scope}
                AND t.cr_number BETWEEN ? AND ? ORDER BY t.id LIMIT 1''', (*args, low, high)).fetchone()
            if retry:
                self.db.execute("UPDATE tasks SET status='awaiting_code',updated_at=? WHERE id=?", (now(), retry['id']))
                return self.task(retry['id'])
            # Enumerate the bounded public number range virtually. This also
            # supports narrowing or switching scope without skipping untouched
            # lower numbers or materializing a huge task table.
            stream = self.db.execute(f'''WITH RECURSIVE numbers(n) AS (
                SELECT ? UNION ALL SELECT n+1 FROM numbers WHERE n<?)
                SELECT s.*,n AS candidate FROM numbers JOIN streams s
                ON n BETWEEN s.start_cr AND s.end_cr
                LEFT JOIN tasks t ON t.stream_id=s.id AND t.cr_number=n
                WHERE t.id IS NULL AND {scope}
                ORDER BY n,s.year DESC,
                CASE WHEN UPPER(s.office_name) LIKE '%RANGE%' THEN 0 ELSE 1 END,
                s.era DESC,s.office_id LIMIT 1''', (low, high, *args)).fetchone()
            if not stream: return None
            cur = self.db.execute("INSERT INTO tasks(stream_id,cr_number,status,updated_at) VALUES(?,?,'awaiting_code',?)",
                                  (stream['id'], stream['candidate'], now()))
            return self.task(cur.lastrowid)

    @staticmethod
    def _scope(focus):
        if focus is None: return '1=1', ()
        ids = focus['stream_ids']
        if not ids: return '0=1', ()
        return 's.id IN (' + ','.join('?' for _ in ids) + ')', tuple(ids)

    def focused_report(self):
        report = self.report(); focus = self.get_meta('focus')
        if focus is None: return report
        scope, args = self._scope(focus); low, high = focus['start_cr'], focus['end_cr']
        planned = self.db.execute(f'''SELECT COALESCE(SUM(MIN(s.end_cr,?)-MAX(s.start_cr,?)+1),0),COUNT(*)
            FROM streams s WHERE {scope} AND s.start_cr<=? AND s.end_cr>=?''', (high, low, *args, high, low)).fetchone()
        counts = {r['status']: r['n'] for r in self.db.execute(f'''SELECT t.status,COUNT(*) n FROM tasks t
            JOIN streams s ON s.id=t.stream_id WHERE {scope} AND t.cr_number BETWEEN ? AND ? GROUP BY t.status''', (*args, low, high))}
        checked = counts.get('downloaded', 0) + counts.get('unavailable', 0)
        report.update(planned_lookups=planned[0], office_year_streams=planned[1], statuses=counts,
                      checked_lookups=checked, remaining_lookups=planned[0]-checked,
                      selected_range_checked=bool(planned[0] and checked == planned[0]))
        return report

    def begin(self, task_id: int) -> int:
        with self.db:
            cur = self.db.execute("UPDATE tasks SET status='submitting',updated_at=? WHERE id=? AND status='awaiting_code'", (now(), task_id))
            if cur.rowcount != 1: raise ValueError('This query is no longer awaiting a security code.')
            cur = self.db.execute("INSERT INTO attempts(task_id,started_at,outcome) VALUES(?,?,'submitting')", (task_id, now()))
            return cur.lastrowid

    def finish(self, task_id: int, attempt_id: int, result: Result):
        if result.outcome not in ('downloaded', 'unavailable', 'captcha', 'retry', 'review'):
            raise ValueError('Unknown result status.')
        task = self.task(task_id); stamp = now(); document = None
        if result.outcome == 'downloaded':
            if result.pdf is None: raise ValueError('PDF result has no bytes.')
            validate_pdf(result.pdf)
            digest = hashlib.sha256(result.pdf).hexdigest()
            pdf_path = Path('documents') / digest[:2] / (digest + '.pdf')
            destination = self.root / pdf_path
            if destination.exists():
                if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                    raise ValueError('Existing document checksum differs; run verify before continuing.')
            else: atomic(destination, result.pdf)
            meta_path = Path('records') / str(task['year']) / task['era'] / task['office_id'] / f"NDPS-{task['cr_number']:03d}-{attempt_id}-{digest[:12]}.json"
            metadata = {'schema_version': 1, 'case_type': 'NDPS', 'year': task['year'],
                        'registration_period': task['era'], 'office_id': task['office_id'],
                        'office_name': task['office_name'], 'cr_number': task['cr_number'],
                        'source_url': FORM_URL, 'submission_url': SUBMIT_URL,
                        'retrieved_at': stamp, 'first_seen_by_collector_at': stamp,
                        'retrieval_method': 'public_form_human_security_code',
                        'publication_date': None, 'event_date': None,
                        'catalogue_source_sha256': task['catalogue_sha256'],
                        'sha256': digest, 'bytes': len(result.pdf), 'pdf_path': pdf_path.as_posix(),
                        'verified_case_identity': False,
                        'notes': 'Original portal bytes. Query parameters are provenance, not independently parsed PDF facts. Retrieval date is not the original publication date.'}
            atomic(self.root / meta_path, json_bytes(metadata))
            document = (digest, pdf_path.as_posix(), len(result.pdf), meta_path.as_posix())
        status = 'retry' if result.outcome in ('captcha', 'retry') else result.outcome
        with self.db:
            cur = self.db.execute('''UPDATE attempts SET finished_at=?,outcome=?,message=?,http_status=?
                WHERE id=? AND task_id=? AND outcome='submitting' ''',
                (stamp, result.outcome, result.message[:2000], result.http_status, attempt_id, task_id))
            if cur.rowcount != 1: raise ValueError('This attempt was already settled or belongs to another query.')
            if document:
                digest, path, size, meta_path = document
                self.db.execute('INSERT OR IGNORE INTO documents VALUES(?,?,?,?)', (digest, path, size, stamp))
                self.db.execute('INSERT INTO downloads(task_id,attempt_id,sha256,retrieved_at,metadata_path) VALUES(?,?,?,?,?)',
                                (task_id, attempt_id, digest, stamp, meta_path))
            self.db.execute('UPDATE tasks SET status=?,message=?,updated_at=? WHERE id=?',
                            (status, result.message[:2000], stamp, task_id))
            if status in ('downloaded', 'unavailable', 'review'):
                self.db.execute('UPDATE streams SET next_cr=MAX(next_cr,?) WHERE id=?', (task['cr_number'] + 1, task['stream_id']))
        if time.monotonic() - self._last_export >= 30:
            self.export()
        elif document:
            row = self.db.execute('''SELECT d.*,t.cr_number,s.year,s.era,s.office_id,s.office_name,doc.path,doc.bytes
                FROM downloads d JOIN tasks t ON t.id=d.task_id JOIN streams s ON s.id=t.stream_id
                JOIN documents doc ON doc.sha256=d.sha256 WHERE d.attempt_id=?''', (attempt_id,)).fetchone()
            with (self.root / 'manifest.jsonl').open('ab') as manifest:
                manifest.write((json.dumps(dict(row), ensure_ascii=False) + '\n').encode())
                manifest.flush(); os.fsync(manifest.fileno())

    def retry(self, task_id: int):
        task = self.task(task_id)
        if task['status'] in ('awaiting_code', 'submitting'): raise ValueError('A search is already active for this query.')
        with self.db:
            self.db.execute("UPDATE tasks SET status='retry',updated_at=? WHERE id=?", (now(), task_id))

    def cancel_challenge(self, task_id: int):
        with self.db:
            self.db.execute("UPDATE tasks SET status='retry',updated_at=? WHERE id=? AND status='awaiting_code'", (now(), task_id))

    def report(self) -> dict:
        planned = self.db.execute('SELECT COALESCE(SUM(end_cr-start_cr+1),0),COUNT(*) FROM streams').fetchone()
        counts = {r['status']: r['n'] for r in self.db.execute('SELECT status,COUNT(*) n FROM tasks GROUP BY status')}
        checked = counts.get('downloaded', 0) + counts.get('unavailable', 0)
        attempts = self.db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0]
        unique_docs = self.db.execute('SELECT COUNT(*) FROM documents').fetchone()[0]
        return {'as_of': now(), 'source_url': FORM_URL, 'case_type': 'NDPS', 'raw_data_folder': str(self.root),
                'planned_lookups': planned[0], 'office_year_streams': planned[1], 'checked_lookups': checked,
                'remaining_lookups': planned[0] - checked, 'statuses': counts, 'attempts': attempts,
                'unique_pdf_documents': unique_docs, 'selected_range_checked': bool(planned[0] and checked == planned[0]),
                'complete_case_universe': False,
                'limitations': ['Unavailable does not establish a nonexistent case or zero activity.',
                               'Number ranges and office lists describe only the observed public form.',
                               'Registration office is not necessarily the event location.',
                               '2026 is a partial year; sensitive or unpublished reports may be absent.',
                               'No source publication date or PDF case identity has been independently verified.']}

    def recent(self, limit=30) -> list[dict]:
        return [dict(r) for r in self.db.execute('''SELECT t.id,t.cr_number,t.status,t.message,t.updated_at,
          s.year,s.era,s.office_id,s.office_name,
          (SELECT sha256 FROM downloads WHERE task_id=t.id ORDER BY id DESC LIMIT 1) sha256
          FROM tasks t JOIN streams s ON s.id=t.stream_id ORDER BY t.updated_at DESC,t.id DESC LIMIT ?''', (limit,))]

    def coverage(self) -> list[dict]:
        return [dict(r) for r in self.db.execute('''SELECT s.id,s.year,s.era,s.office_id,s.office_name,
            s.start_cr,s.end_cr,s.end_cr-s.start_cr+1 planned,
            SUM(CASE WHEN t.status='downloaded' THEN 1 ELSE 0 END) downloaded,
            SUM(CASE WHEN t.status='unavailable' THEN 1 ELSE 0 END) unavailable,
            SUM(CASE WHEN t.status='review' THEN 1 ELSE 0 END) review,
            SUM(CASE WHEN t.status IN ('retry','awaiting_code','submitting') THEN 1 ELSE 0 END) retry
            FROM streams s LEFT JOIN tasks t ON t.stream_id=s.id GROUP BY s.id ORDER BY s.year,s.era,s.office_id''')]

    def export(self):
        self._last_export = time.monotonic()
        atomic(self.root / 'report.json', json_bytes(self.report()))
        buf = io.StringIO(); fields = ['id', 'year', 'era', 'office_id', 'office_name', 'start_cr', 'end_cr', 'planned', 'downloaded', 'unavailable', 'review', 'retry']
        writer = csv.DictWriter(buf, fieldnames=fields); writer.writeheader(); writer.writerows(self.coverage())
        atomic(self.root / 'search_coverage.csv', buf.getvalue().encode())
        # This is a document manifest, not a canonical-case or training export.
        with tempfile.TemporaryFile(mode='w+b') as out:
            for r in self.db.execute('''SELECT d.*,t.cr_number,s.year,s.era,s.office_id,s.office_name,doc.path,doc.bytes
                 FROM downloads d JOIN tasks t ON t.id=d.task_id JOIN streams s ON s.id=t.stream_id
                 JOIN documents doc ON doc.sha256=d.sha256 ORDER BY d.id'''):
                out.write((json.dumps(dict(r), ensure_ascii=False) + '\n').encode())
            out.seek(0); atomic(self.root / 'manifest.jsonl', out.read())

    def verify(self, repair=False) -> dict:
        errors = []; checked = 0
        for doc in self.db.execute('SELECT * FROM documents').fetchall():
            checked += 1; path = self.root / doc['path']
            try:
                data = path.read_bytes(); validate_pdf(data)
                if len(data) != doc['bytes'] or hashlib.sha256(data).hexdigest() != doc['sha256']:
                    raise ValueError('Checksum or size mismatch.')
            except (OSError, ValueError) as e:
                errors.append({'sha256': doc['sha256'], 'error': str(e)})
                if repair:
                    if path.exists():
                        # Keep the bad bytes as evidence, freeing the expected
                        # hash path for a subsequently verified recollection.
                        quarantine = self.root / 'quarantine' / (doc['sha256'] + '-' + now().replace(':', '').replace('+', '_') + '.pdf')
                        quarantine.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                        os.replace(path, quarantine)
                    with self.db:
                        self.db.execute("UPDATE tasks SET status='retry',message='Document verification failed; recollect.',updated_at=? WHERE id IN (SELECT task_id FROM downloads WHERE sha256=?)", (now(), doc['sha256']))
        if repair: self.export()
        return {'checked_documents': checked, 'errors': errors, 'repair_queued': bool(repair and errors)}
