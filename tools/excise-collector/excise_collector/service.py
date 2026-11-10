"""Single active query and single-use human challenge lifecycle."""
from __future__ import annotations

import base64
import secrets
import re
import time

from .portal import Portal, PortalError, Result
from .store import Store


class Collector:
    def __init__(self, store: Store, portal: Portal):
        self.store, self.portal = store, portal
        self.active = None; self.form = None
        self.portal.cooldown_until = store.get_meta('cooldown_until', 0)
        self.portal.on_cooldown = lambda until: store.set_meta('cooldown_until', until)
        self.store.recover()

    def state(self):
        active = None if self.active is None else {k: v for k, v in self.active.items() if k != 'created'}
        return {'report': self.store.focused_report(), 'overall_report': self.store.report(), 'recent': self.store.recent(),
                'catalogue': self.store.get_meta('catalogue'), 'active': active, 'focus': self.store.get_meta('focus'),
                'portal_requests': self.portal.calls, 'request_budget': self.portal.budget,
                'cooldown_until': self.portal.cooldown_until}

    def discover(self):
        self.pause()
        _, catalogue = self.portal.form()
        self.store.save_catalogue(catalogue)
        return catalogue

    def prepare(self):
        self.pause()
        task = self.store.next_task()
        if task is None: return {'empty': True, 'message': 'No more new queries in this scope. Review unresolved results or extend the queue.'}
        try:
            form, catalogue = self.portal.form()
            valid = any(o['id'] == task['office_id'] and o['era'] == task['era'] for o in catalogue['offices'])
            if not valid: raise PortalError('Queued office is no longer in the current portal list; review it.', outcome='review')
            self.store.save_catalogue(catalogue)
            image, mime = self.portal.challenge(form)
        except Exception:
            self.store.cancel_challenge(task['id'])
            raise
        self.form = form
        self.active = {'id': secrets.token_urlsafe(24), 'task': task, 'created': time.monotonic(),
                       'expires_at': time.time() + 180,
                       'image': 'data:' + mime + ';base64,' + base64.b64encode(image).decode()}
        return self.state()

    def submit(self, challenge_id: str, code: str):
        active, form = self.active, self.form
        if active is None or not secrets.compare_digest(str(challenge_id), active['id']):
            raise ValueError('This security image is no longer current. Prepare a fresh one.')
        if not isinstance(code, str) or not code.strip() or len(code) > 64: raise ValueError('Enter the displayed security code.')
        if time.monotonic() - active['created'] > 180:
            self.pause(); raise ValueError('Security image expired locally after three minutes. Prepare a fresh one.')
        self.active = self.form = None  # Consume before the network call. Never replay.
        task_id = active['task']['id']; attempt_id = self.store.begin(task_id)
        try:
            result = self.portal.submit(form, active['task'], code)
        except PortalError as e:
            result = Result(e.outcome, str(e), http_status=e.http_status or 0)
        except Exception as e:
            # Never include request bodies, tokens, codes, PDF bytes or tracebacks.
            result = Result('review', f'Unexpected collection failure ({type(e).__name__}); inspect before retrying.', http_status=0)
        for secret in (code.strip(), form.token):
            if secret:
                result.message = re.sub(re.escape(secret), '[redacted]', result.message, flags=re.IGNORECASE)
        try:
            self.store.finish(task_id, attempt_id, result)
        except Exception:
            # The portal may have succeeded. Keep the pending attempt recoverable,
            # never re-submit automatically if local storage failed.
            self.store.recover()
            raise
        return {'result': {'outcome': result.outcome, 'message': result.message, 'task_id': task_id}, 'state': self.state()}

    def pause(self):
        if self.active: self.store.cancel_challenge(self.active['task']['id'])
        self.active = self.form = None
