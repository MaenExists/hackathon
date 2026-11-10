import base64
import hashlib
import io
import json
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from excise_collector.portal import FORM_URL, FormParser, Portal, PortalError, Result, classify
from excise_collector.service import Collector
from excise_collector.store import Store
from fixtures import FORM, FakePortal, catalogue, form, pdf


class ContractTests(unittest.TestCase):
    def test_catalogue_separates_transition_identifiers_and_redacts_secrets(self):
        c = catalogue()
        self.assertEqual(c['public_form_cr_max'], 999)
        self.assertEqual({o['era'] for o in c['offices']}, {'before', 'after'})
        self.assertNotIn('synthetic-token', json.dumps(c))
        self.assertNotIn('synthetic.jpg', json.dumps(c))

    def test_form_change_fails_closed(self):
        for original, replacement in [(b'name="captcha"', b'name="changed"'), (b'/user/crlogin', b'/other-endpoint')]:
            with self.subTest(original=original), self.assertRaises(PortalError):
                f = FormParser(); f.feed(FORM.replace(original, replacement).decode()); f.validate()
        with self.assertRaises(PortalError): form().catalogue(FORM.replace(b'max: 3', b'max: 4'))

    def test_success_requires_real_pdf_framing(self):
        self.assertEqual(classify(json.dumps({'status': True, 'cr': base64.b64encode(pdf()).decode()}).encode()).pdf, pdf())
        for data in [b'not PDF', b'%PDF-1.4\ntruncated']:
            self.assertEqual(classify(json.dumps({'status': True, 'cr': base64.b64encode(data).decode()}).encode()).outcome, 'review')
        self.assertEqual(classify(b'{"status":true,"cr":"!!!!"}').outcome, 'review')

    def test_errors_are_conservative(self):
        for message, expected in [('Invalid captcha', 'captcha'), ('Security code mismatch', 'captcha'),
            ('CSRF token expired', 'retry'), ('Try again later', 'retry'), ('No records found', 'unavailable'),
            ('CR not found', 'unavailable'), ('Report not yet published', 'unavailable'),
            ('No Data Available. status', 'unavailable'),
            ('An error occurred', 'review'), ('Database connection failed', 'review')]:
            with self.subTest(message=message):
                self.assertEqual(classify(json.dumps({'status': False, 'msg': message}).encode()).outcome, expected)
        for value in [b'<html>blocked</html>', b'null', b'[]', b'{"status":"true"}']:
            self.assertEqual(classify(value).outcome, 'review')
        # Observed live portal wording can occur outside the msg field.
        self.assertEqual(classify(b'{"status":false,"error":"No Data Available. status","msg":""}').outcome, 'unavailable')

    def test_form_posts_correct_era_fields_and_token_once(self):
        p = Portal(); requests = []
        def capture(url, data=None, **kw):
            requests.append((url, urllib.parse.parse_qs(data.decode(), keep_blank_values=True)))
            return b'{"status":false,"msg":"No records found"}', 'application/json'
        p._get = capture
        for era in ['before', 'after']:
            p.submit(form(), {'era': era, 'cr_number': 7, 'year': 2025, 'office_id': '1001'}, 'human-code')
            fields = requests[-1][1]
            self.assertEqual(fields['unit'], ['1001' if era == 'before' else ''])
            self.assertEqual(fields['units'], ['1001' if era == 'after' else ''])
            self.assertEqual(fields['ps_tkn'], ['synthetic-token'])
            self.assertEqual(fields['casetype'], ['NDPS'])
        self.assertEqual(len(requests), 2)

    def test_endpoint_allowlist_and_interval(self):
        p = Portal()
        for url in ['https://example.com/crreport', 'http://eroll.keralaexcise.gov.in/crreport', FORM_URL + '/other']:
            with self.assertRaises(PortalError): p._get(url)
        with self.assertRaises(ValueError): Portal(interval=.1)
        p.calls = p.budget
        with self.assertRaises(PortalError): p._get(FORM_URL)

    def test_throttle_persists_retry_after_and_no_post_retry(self):
        p = Portal(); cooldown = []; p.on_cooldown = cooldown.append
        error = urllib.error.HTTPError(FORM_URL, 429, 'limited', {'Retry-After': '120'}, io.BytesIO())
        with patch.object(p.opener, 'open', side_effect=error) as op:
            with self.assertRaises(PortalError) as caught: p._get(FORM_URL, b'test=1')
            self.assertEqual(op.call_count, 1)
        self.assertEqual(caught.exception.http_status, 429)
        self.assertEqual(len(cooldown), 1)
        self.assertGreater(cooldown[0], time.time() + 100)
        with self.assertRaises(PortalError): p._get(FORM_URL)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.root = Path(self.tmp.name)
        self.s = Store(self.root); self.s.save_catalogue(catalogue())
    def tearDown(self): self.s.close(); self.tmp.cleanup()
    def settle(self, task, result):
        a = self.s.begin(task['id']); self.s.finish(task['id'], a, result)

    def test_stream_plan_uses_both_2025_catalogues_and_only_new_2026(self):
        result = self.s.plan(catalogue())
        self.assertEqual(result['selected_streams'], 6)
        self.assertEqual(self.s.report()['planned_lookups'], 5994)
        self.assertEqual(self.s.db.execute('SELECT COUNT(*) FROM tasks').fetchone()[0], 0)
        self.assertEqual(self.s.db.execute("SELECT COUNT(*) FROM streams WHERE year=2026 AND era='before'").fetchone()[0], 0)

    def test_scoped_bounds_and_no_gap_stopping(self):
        self.s.plan(catalogue(), [2026], '1501', 1, 3)
        first = self.s.next_task(); self.assertEqual(first['cr_number'], 1)
        self.settle(first, Result('unavailable', 'No records found'))
        second = self.s.next_task(); self.assertEqual(second['cr_number'], 2)
        self.settle(second, Result('unavailable', 'No records found'))
        third = self.s.next_task(); self.assertEqual(third['cr_number'], 3)
        self.settle(third, Result('downloaded', 'OK', pdf()))
        self.assertIsNone(self.s.next_task())
        self.assertTrue(self.s.report()['selected_range_checked'])
        self.assertFalse(self.s.report()['complete_case_universe'])

    def test_replanning_extends_scope_without_duplicate_results(self):
        self.s.plan(catalogue(), [2026], '1501', 2, 2)
        self.settle(self.s.next_task(), Result('unavailable', 'not published'))
        self.s.plan(catalogue(), [2026], '1501', 1, 3)
        self.settle(self.s.next_task(), Result('unavailable', 'not published'))
        self.assertEqual(self.s.next_task()['cr_number'], 3)
        self.assertEqual(self.s.report()['planned_lookups'], 3)
        self.assertEqual(self.s.report()['checked_lookups'], 2)

    def test_focusing_a_subset_does_not_skip_untouched_lower_numbers(self):
        self.s.plan(catalogue(), [2026], start=1, end=999)
        self.s.plan(catalogue(), [2026], '1502', 50, 51)
        self.assertEqual(self.s.focused_report()['planned_lookups'], 2)
        task = self.s.next_task()
        self.assertEqual((task['office_id'], task['cr_number']), ('1502', 50))
        self.settle(task, Result('unavailable', 'not published'))
        self.assertEqual(self.s.focused_report()['remaining_lookups'], 1)
        self.s.plan(catalogue(), [2026], '1502', 1, 51)
        self.assertEqual(self.s.next_task()['cr_number'], 1)
        self.assertEqual(self.s.report()['planned_lookups'], 1998)

    def test_catalogue_archives_do_not_duplicate_per_image_or_token(self):
        before = len(list((self.root / 'discovery').glob('*.json')))
        changed = catalogue(); changed['source_sha256'] = 'changed-form-token-hash'
        self.s.save_catalogue(changed)
        self.assertEqual(len(list((self.root / 'discovery').glob('*.json'))), before)

    def test_low_numbers_across_offices_before_higher_numbers(self):
        self.s.plan(catalogue(), [2026], start=1, end=2)
        t1 = self.s.next_task(); self.settle(t1, Result('unavailable', 'not published'))
        t2 = self.s.next_task(); self.assertEqual(t2['cr_number'], 1)
        self.assertNotEqual(t1['office_id'], t2['office_id'])

    def test_range_office_priority_keeps_other_offices_in_the_queue(self):
        c = catalogue()
        next(o for o in c['offices'] if o['id'] == '1502')['name'] = 'Excise Range Office Beta'
        self.s.plan(c, [2026], start=1, end=1)
        first = self.s.next_task(); self.assertEqual(first['office_id'], '1502')
        self.settle(first, Result('unavailable', 'not published'))
        self.assertEqual(self.s.next_task()['office_id'], '1501')

    def test_invalid_scopes_do_not_change_queue(self):
        for kwargs in [dict(years=[2024]), dict(office='does-not-exist'), dict(start=0), dict(end=1000), dict(years=[2026], era='before')]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError): self.s.plan(catalogue(), **kwargs)
        self.assertEqual(self.s.report()['planned_lookups'], 0)

    def test_byte_dedup_preserves_both_query_provenances(self):
        self.s.plan(catalogue(), [2026], '1501', 1, 2)
        for _ in range(2): self.settle(self.s.next_task(), Result('downloaded', 'OK', pdf()))
        self.assertEqual(self.s.report()['unique_pdf_documents'], 1)
        self.assertEqual(self.s.report()['statuses']['downloaded'], 2)
        manifest = [json.loads(x) for x in (self.root / 'manifest.jsonl').read_text().splitlines()]
        self.assertEqual(len(manifest), 2)
        self.assertEqual({x['cr_number'] for x in manifest}, {1, 2})
        self.assertEqual(len(list((self.root / 'records').rglob('*.json'))), 2)
        self.assertFalse(self.s.verify()['errors'])
        metadata = json.loads(next((self.root / 'records').rglob('*.json')).read_text())
        self.assertIsNone(metadata['publication_date'])
        self.assertFalse(metadata['verified_case_identity'])
        self.assertNotIn('human-code', (self.root / 'collector.sqlite3').read_bytes().decode(errors='ignore'))

    def test_review_is_unresolved_and_retry_can_revisit_a_checked_query(self):
        self.s.plan(catalogue(), [2026], '1501', 1, 2)
        one = self.s.next_task(); self.settle(one, Result('review', 'Unknown response'))
        two = self.s.next_task(); self.settle(two, Result('unavailable', 'not published'))
        self.assertIsNone(self.s.next_task()); self.assertEqual(self.s.report()['remaining_lookups'], 1)
        self.s.retry(one['id']); self.assertEqual(self.s.next_task()['id'], one['id'])

    def test_restart_recovers_inflight_and_awaiting_without_marking_absence(self):
        self.s.plan(catalogue(), [2026], '1501', 1, 1)
        one = self.s.next_task(); self.s.begin(one['id']); self.s.recover()
        self.assertEqual(self.s.task(one['id'])['status'], 'retry')
        self.assertEqual(self.s.next_task()['id'], one['id'])
        self.assertEqual(self.s.report()['checked_lookups'], 0)
        self.assertEqual(self.s.db.execute('SELECT outcome FROM attempts').fetchone()[0], 'interrupted')

    def test_pdf_corruption_detected_and_recollection_queued(self):
        self.s.plan(catalogue(), [2026], '1501', 1, 1)
        one = self.s.next_task(); self.settle(one, Result('downloaded', 'OK', pdf()))
        path = next((self.root / 'documents').rglob('*.pdf')); path.write_bytes(b'corrupt')
        self.assertEqual(len(self.s.verify()['errors']), 1)
        self.assertTrue(self.s.verify(repair=True)['repair_queued'])
        self.assertEqual(self.s.task(one['id'])['status'], 'retry')
        self.assertEqual(self.s.report()['checked_lookups'], 0)
        # Recollection must actually recover, not repeatedly fail on the bad bytes.
        retry = self.s.next_task(); self.settle(retry, Result('downloaded', 'OK', pdf()))
        self.assertFalse(self.s.verify()['errors'])


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.s = Store(Path(self.tmp.name)); self.s.save_catalogue(catalogue())
        self.s.plan(catalogue(), [2026], '1501', 1, 2)
        self.portal = FakePortal(); self.c = Collector(self.s, self.portal)
    def tearDown(self): self.s.close(); self.tmp.cleanup()

    def test_each_human_challenge_is_single_use_and_not_persisted(self):
        state = self.c.prepare(); challenge = state['active']['id']
        self.assertEqual(len(self.portal.submissions), 0)
        result = self.c.submit(challenge, 'TEST'); self.assertEqual(result['result']['outcome'], 'downloaded')
        with self.assertRaises(ValueError): self.c.submit(challenge, 'TEST')
        self.assertEqual(len(self.portal.submissions), 1)
        self.assertIsNone(self.c.state()['active'])
        self.s.db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        self.assertNotIn(challenge.encode(), (self.s.root / 'collector.sqlite3').read_bytes())
        self.assertNotIn(b'synthetic-token', (self.s.root / 'collector.sqlite3').read_bytes())

    def test_wrong_code_does_not_advance_cr_and_requires_fresh_challenge(self):
        first = self.c.prepare()['active']; self.c.submit(first['id'], 'WRONG')
        second = self.c.prepare()['active']
        self.assertEqual(first['task']['cr_number'], second['task']['cr_number'])
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual(self.s.report()['checked_lookups'], 0)

    def test_refresh_invalidates_previous_code_and_pause_keeps_task(self):
        first = self.c.prepare()['active']; second = self.c.prepare()['active']
        with self.assertRaises(ValueError): self.c.submit(first['id'], 'TEST')
        self.c.pause(); self.assertEqual(self.s.task(second['task']['id'])['status'], 'retry')
        self.assertEqual(len(self.portal.submissions), 0)

    def test_expired_image_does_not_send_post(self):
        active = self.c.prepare()['active']; self.c.active['created'] -= 181
        with self.assertRaises(ValueError): self.c.submit(active['id'], 'TEST')
        self.assertEqual(len(self.portal.submissions), 0)

    def test_ambiguous_network_error_never_reposts_or_counts_missing(self):
        active = self.c.prepare()['active']; self.portal.next_result = PortalError('connection failed')
        result = self.c.submit(active['id'], 'TEST')
        self.assertEqual(result['result']['outcome'], 'retry')
        self.assertEqual(len(self.portal.submissions), 1)
        self.assertEqual(self.s.report()['checked_lookups'], 0)

    def test_echoed_code_and_token_are_redacted_before_persistence(self):
        active = self.c.prepare()['active']
        self.portal.next_result = Result('captcha', 'Code SECRET and token synthetic-token were rejected.')
        reply = self.c.submit(active['id'], 'SECRET')
        self.assertNotIn('SECRET', reply['result']['message'])
        self.assertNotIn('synthetic-token', reply['result']['message'])
        self.assertIn('[redacted]', reply['result']['message'])


if __name__ == '__main__': unittest.main()
