import http.client
import json
import subprocess
import sys
import unittest
from pathlib import Path


class HTTPIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.process = subprocess.Popen([sys.executable, str(Path(__file__).with_name('fixture_server.py'))], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        line = cls.process.stdout.readline()
        if not line: raise RuntimeError(cls.process.stderr.read())
        cls.fixture = json.loads(line); cls.port = int(cls.fixture['url'].rsplit(':', 1)[1]); cls.origin = cls.fixture['url']
    @classmethod
    def tearDownClass(cls):
        cls.process.terminate(); cls.process.communicate(timeout=10)

    def request(self, path, data=None, headers=None, cookie=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=10)
        h = {'Content-Type': 'application/json'}
        if data is not None: h['Origin'] = self.origin
        if cookie: h['Cookie'] = cookie
        if headers: h.update(headers)
        connection.request('GET' if data is None else 'POST', path, body=None if data is None else json.dumps(data), headers=h)
        response = connection.getresponse(); body = response.read(); status = response.status; response_headers = dict(response.getheaders()); connection.close()
        return status, response_headers, body

    def login_cookie(self):
        status, headers, _ = self.request('/')
        self.assertEqual(status, 200)
        return headers['Set-Cookie'].split(';')[0]

    def test_cross_origin_requests_rejected_and_no_arbitrary_file_serving(self):
        cookie = self.login_cookie()
        self.assertEqual(self.request('/api/state')[0], 403)
        self.assertEqual(self.request('/api/next', {}, cookie=cookie, headers={'Origin': 'https://attacker.example'})[0], 403)
        self.assertEqual(self.request('/', headers={'Host': 'attacker.example'})[0], 403)
        self.assertEqual(self.request('/../../project.md', cookie=cookie)[0], 404)
        self.assertEqual(self.request('/api/next', {}, cookie=cookie, headers={'Content-Type': 'text/plain'})[0], 415)

    def test_real_http_human_entry_save_manifest_and_replay_rejection(self):
        cookie = self.login_cookie()
        status, _, body = self.request('/api/next', {}, cookie=cookie)
        self.assertEqual(status, 200)
        active = json.loads(body)['active']
        status, _, body = self.request('/api/submit', {'id': active['id'], 'code': 'TEST'}, cookie=cookie)
        self.assertEqual(status, 200); reply = json.loads(body)
        self.assertEqual(reply['result']['outcome'], 'downloaded')
        digest = reply['state']['recent'][0]['sha256']
        status, headers, pdf = self.request('/files/' + digest + '.pdf', cookie=cookie)
        self.assertEqual(status, 200); self.assertTrue(pdf.startswith(b'%PDF-'))
        self.assertTrue(headers['Content-Disposition'].startswith('attachment;'))
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(self.request('/api/submit', {'id': active['id'], 'code': 'TEST'}, cookie=cookie)[0], 400)
        manifest = Path(self.fixture['directory']) / 'manifest.jsonl'
        self.assertEqual(len(manifest.read_text().splitlines()), 1)
        # The action contains no externally supplied URL or path.
        self.assertEqual(self.request('/api/plan', {'years':[2024]}, cookie=cookie)[0], 400)


if __name__ == '__main__': unittest.main()
