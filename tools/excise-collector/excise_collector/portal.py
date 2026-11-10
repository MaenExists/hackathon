"""Observed public form contract. No CAPTCHA recognition or bypass."""
from __future__ import annotations

import base64
import hashlib
import html
import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Callable

ORIGIN = 'https://eroll.keralaexcise.gov.in'
FORM_URL = ORIGIN + '/crreport'
SUBMIT_URL = ORIGIN + '/user/crlogin'
MAX_RESPONSE = 48 * 1024 * 1024
USER_AGENT = 'CorridorResearchCollector/1.0 (human-assisted public NDPS report acquisition)'


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


class PortalError(Exception):
    def __init__(self, message: str, *, outcome: str = 'retry', http_status: int | None = None,
                 retry_after: float = 0):
        super().__init__(message)
        self.outcome, self.http_status, self.retry_after = outcome, http_status, retry_after


class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts: list[str] = []
    def handle_data(self, data):
        self.parts.append(data)


def plain(value) -> str:
    p = Text(); p.feed(str(value or ''))
    return re.sub(r'\s+', ' ', html.unescape(' '.join(p.parts))).strip()[:2000]


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_form = False
        self.action = ''; self.token = ''; self.image = ''
        self.fields: set[str] = set()
        self.selects: dict[str, list[dict[str, str]]] = {}
        self.current_select = None; self.current_option = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'form':
            self.in_form = a.get('id') == 'frm-cr-download'
            if self.in_form: self.action = a.get('action', '')
        if not self.in_form: return
        if tag in ('input', 'select') and a.get('name'):
            self.fields.add(a['name'])
        if tag == 'input' and a.get('name') == 'ps_tkn': self.token = a.get('value', '')
        if tag == 'img' and a.get('id') == 'captcha-img': self.image = a.get('src', '')
        if tag == 'select':
            self.current_select = a.get('name')
            self.selects[self.current_select] = []
        if tag == 'option' and self.current_select:
            self.current_option = {'id': a.get('value', ''), 'name': ''}
            self.selects[self.current_select].append(self.current_option)

    def handle_data(self, data):
        if self.current_option is not None: self.current_option['name'] += data

    def handle_endtag(self, tag):
        if tag == 'form': self.in_form = False
        if tag == 'select': self.current_select = None
        if tag == 'option': self.current_option = None

    def validate(self):
        if urllib.parse.urljoin(FORM_URL, self.action) != SUBMIT_URL:
            raise PortalError('Portal submission URL changed; review the form before collecting.', outcome='review')
        required = {'ps_tkn', 'crnumber', 'year', 'casetype', 'cased', 'unit', 'units', 'captcha'}
        if not required <= self.fields or not self.token or not self.image:
            raise PortalError('Portal fields changed or session form is unavailable.', outcome='review')
        if 'NDPS' not in {o['id'] for o in self.selects.get('casetype', [])}:
            raise PortalError('NDPS is missing from the portal case types.', outcome='review')
        for field in ('unit', 'units'):
            options = [o for o in self.selects.get(field, []) if o['id']]
            if not options or len({o['id'] for o in options}) != len(options):
                raise PortalError('Office catalogue is empty or contains duplicate identifiers.', outcome='review')
            if any(not o['id'].isdigit() for o in options):
                raise PortalError('Unexpected office identifiers; inspect the changed catalogue.', outcome='review')
        if not {'1', '2'} <= {o['id'] for o in self.selects.get('cased', [])}:
            raise PortalError('Registration transition options changed.', outcome='review')

    def catalogue(self, source: bytes) -> dict:
        offices = []
        for era, field in [('before', 'unit'), ('after', 'units')]:
            for option in self.selects[field]:
                if option['id']:
                    offices.append({'era': era, 'field': field, 'id': option['id'],
                                    'name': re.sub(r'\s+', ' ', option['name']).strip()})
        # Detect the actual public validator. Do not silently assume an unbounded range.
        source_text = source.decode('utf-8', errors='replace')
        match = re.search(r'crnumber\s*:\s*\{.*?stringLength\s*:\s*\{\s*min\s*:\s*1\s*,\s*max\s*:\s*(\d+)', source_text, re.S)
        if not match or int(match.group(1)) != 3:
            raise PortalError('CR-number validator changed; review supported bounds.', outcome='review')
        return {'schema_version': 1, 'source_url': FORM_URL, 'discovered_at': now(),
                'source_sha256': hashlib.sha256(source).hexdigest(), 'case_type': 'NDPS',
                'transition_date': '2025-06-01', 'public_form_cr_min': 1, 'public_form_cr_max': 999,
                'bounds_basis': 'Observed client-side three-character numeric CR validator; not a confirmed registration maximum.',
                'offices': offices}


@dataclass
class Result:
    outcome: str
    message: str
    pdf: bytes | None = None
    http_status: int = 200


def validate_pdf(data: bytes) -> None:
    if not data.startswith(b'%PDF-') or b'%%EOF' not in data[-2048:]:
        raise ValueError('Response does not have a PDF header and final EOF marker.')
    if len(data) > 32 * 1024 * 1024:
        raise ValueError('PDF exceeds the 32 MiB document limit.')


def classify(body: bytes) -> Result:
    try:
        response = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return Result('review', 'Portal returned non-JSON data. No case absence was recorded.')
    if not isinstance(response, dict): return Result('review', 'Unexpected portal response shape.')
    message = plain(response.get('msg') or response.get('message') or response.get('error') or response.get('errors'))
    if response.get('status') is True:
        try:
            encoded = response['cr']
            if not isinstance(encoded, str): raise ValueError('PDF data must be a string.')
            pdf = base64.b64decode(re.sub(r'\s', '', encoded), validate=True)
            validate_pdf(pdf)
        except (KeyError, ValueError, TypeError) as e:
            return Result('review', f'Portal reported success but supplied invalid PDF data: {e}')
        return Result('downloaded', message or 'PDF received.', pdf)
    if response.get('status') is not False:
        return Result('review', message or 'Portal status field is missing or changed.')
    lowered = message.casefold()
    if any(s in lowered for s in ('captcha', 'security code', 'security text', 'verification code')):
        return Result('captcha', message)
    if any(s in lowered for s in ('csrf', 'token', 'session expired', 'request not allowed')):
        return Result('retry', message)
    if any(s in lowered for s in ('too many', 'rate limit', 'try again later', 'temporarily unavailable')):
        return Result('retry', message)
    # Conservative matches, not a generic "error means missing" rule. Real messages
    # remain unverified until an operator completes a live challenge.
    unavailable = (r'\bno (?:records?|data|reports?|crs?|cases?) (?:was |were )?found\b',
                   r'\bno (?:data|reports?|records?) available\b',
                   r'\b(?:cr|case|report|record)(?: number)? (?:is |was )?not found\b',
                   r'\bnot (?:yet )?(?:published|uploaded)\b', r'\bnot available for download\b')
    if any(re.search(pattern, lowered) for pattern in unavailable):
        return Result('unavailable', message)
    return Result('review', message or ('Portal returned status=false without an error message. Response fields: '
                                      + ', '.join(sorted(str(k) for k in response))[:500]
                                      + '. No case absence was recorded.'))


class Portal:
    def __init__(self, interval: float = 2.0, budget: int = 1000,
                 on_cooldown: Callable[[float], None] | None = None):
        if interval < 2 or budget < 1: raise ValueError('Use an interval of at least two seconds and a positive request budget.')
        self.interval, self.budget = interval, budget
        self.calls = 0; self.last_request = 0.0; self.cooldown_until = 0.0
        self.on_cooldown = on_cooldown or (lambda _: None)
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies), NoRedirect())
        self.robot = None; self.robots_checked = False

    def _get(self, url: str, data: bytes | None = None, *, image: bool = False) -> tuple[bytes, str]:
        parsed = urllib.parse.urlsplit(url)
        if (parsed.scheme, parsed.netloc) != ('https', 'eroll.keralaexcise.gov.in') or parsed.fragment:
            raise PortalError('Refusing a request outside the public portal.', outcome='review')
        if parsed.path not in ('/robots.txt', '/crreport', '/user/crlogin') and not (
                image and re.fullmatch(r'/public/images/captcha/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png)', parsed.path)):
            raise PortalError('Unexpected portal endpoint; review the source contract.', outcome='review')
        if self.robot and not self.robot.can_fetch(USER_AGENT, url):
            raise PortalError('robots.txt disallows this path. Collection is stopped.', outcome='review')
        if time.time() < self.cooldown_until:
            raise PortalError('Portal cooldown is active; wait before retrying.', retry_after=self.cooldown_until - time.time())
        if self.calls >= self.budget:
            raise PortalError('This run reached its portal request budget. Restart to continue from the checkpoint.')
        time.sleep(max(0, self.interval - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic(); self.calls += 1
        headers = {'User-Agent': USER_AGENT, 'Referer': FORM_URL, 'Accept': 'application/json' if data else '*/*'}
        if data is not None:
            headers.update({'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                            'X-Requested-With': 'XMLHttpRequest', 'Origin': ORIGIN})
        request = urllib.request.Request(url, data=data, headers=headers)
        try:
            with self.opener.open(request, timeout=40) as r:
                payload = r.read(MAX_RESPONSE + 1)
                if len(payload) > MAX_RESPONSE: raise PortalError('Portal response exceeded the size limit.', outcome='review')
                return payload, r.headers.get_content_type()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                raw_delay = e.headers.get('Retry-After', '')
                try: delay = float(raw_delay)
                except ValueError:
                    try: delay = parsedate_to_datetime(raw_delay).timestamp() - time.time()
                    except (ValueError, TypeError, OverflowError): delay = 60.0
                delay = max(60, delay)
                self.cooldown_until = time.time() + delay; self.on_cooldown(self.cooldown_until)
                raise PortalError(f'Portal HTTP {e.code}; collection paused for at least {int(delay)} seconds.',
                                  http_status=e.code, retry_after=delay) from None
            if e.code == 404 and parsed.path == '/robots.txt': raise
            raise PortalError(f'Portal HTTP {e.code}. No case absence was recorded.', outcome='review', http_status=e.code) from None
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            raise PortalError(f'Portal connection failed ({type(e).__name__}). Retry explicitly; no absence was recorded.') from None

    def check_robots(self):
        if self.robots_checked: return
        try:
            body, _ = self._get(ORIGIN + '/robots.txt')
            robot = urllib.robotparser.RobotFileParser(); robot.parse(body.decode('utf-8', errors='replace').splitlines())
            self.robot = robot; self.robots_status = 'fetched'
            self.interval = max(self.interval, robot.crawl_delay(USER_AGENT) or 0)
        except urllib.error.HTTPError as e:
            if e.code != 404: raise
            self.robots_status = '404 (no robots file; not an authorization statement)'
        self.robots_checked = True

    def form(self) -> tuple[FormParser, dict]:
        self.check_robots()
        body, content_type = self._get(FORM_URL)
        if content_type != 'text/html': raise PortalError('Portal form is no longer HTML.', outcome='review')
        form = FormParser(); form.feed(body.decode('utf-8', errors='replace')); form.validate()
        catalogue = form.catalogue(body); catalogue['robots_status'] = self.robots_status
        return form, catalogue

    def challenge(self, form: FormParser) -> tuple[bytes, str]:
        image_url = urllib.parse.urljoin(FORM_URL, form.image)
        body, content_type = self._get(image_url, image=True)
        if content_type not in ('image/jpeg', 'image/png') or len(body) > 512 * 1024:
            raise PortalError('Unexpected security image response.', outcome='review')
        return body, content_type

    def submit(self, form: FormParser, task: dict, code: str) -> Result:
        if not code.strip() or len(code) > 64: raise ValueError('Enter the displayed security code.')
        before = task['era'] == 'before'
        # Match the normal browser serialization, including the hidden other select.
        fields = {'ps_tkn': form.token, 'crnumber': str(task['cr_number']), 'year': str(task['year']),
                  'casetype': 'NDPS', 'cased': '1' if before else '2',
                  'unit': task['office_id'] if before else '',
                  'units': '' if before else task['office_id'], 'captcha': code.strip()}
        body, _ = self._get(SUBMIT_URL, urllib.parse.urlencode(fields).encode())
        return classify(body)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Expired sessions and anti-bot redirects require human review, not crawling.
        return None
