"""Synthetic portal responses only; no real case files or security codes."""
import base64
from excise_collector.portal import FormParser, Result

FORM = b'''<form id="frm-cr-download" action="https://eroll.keralaexcise.gov.in/user/crlogin">
<input name="ps_tkn" value="synthetic-token"><input name="crnumber"><input name="year">
<select name="casetype"><option value="NDPS">NDPS</option></select>
<select name="cased"><option value="1">Yes</option><option value="2">No</option></select>
<select name="unit"><option value="">Please Select</option><option value="1001">Old Office Alpha</option><option value="1002">Old Office Beta</option></select>
<select name="units"><option value="">Please Select</option><option value="1501">New Office Alpha</option><option value="1502">New Office Beta</option></select>
<img id="captcha-img" src="https://eroll.keralaexcise.gov.in/public/images/captcha/synthetic.jpg"><input name="captcha">
</form><script>fields: { crnumber: { validators: { stringLength: { min: 1, max: 3 }}}}</script>'''
IMAGE = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0XcAAAAASUVORK5CYII=')


def pdf(text='Synthetic test report'):
    content = f'BT /F1 16 Tf 50 750 Td ({text}) Tj ET'.encode()
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
               b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
               b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'\nendstream']
    data = b'%PDF-1.4\n'; offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data)); data += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    start = len(data); data += b'xref\n0 6\n0000000000 65535 f \n'
    for offset in offsets: data += f'{offset:010d} 00000 n \n'.encode()
    return data + f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()


def form():
    f = FormParser(); f.feed(FORM.decode()); f.validate(); return f


def catalogue(): return form().catalogue(FORM)


class FakePortal:
    def __init__(self):
        self.calls = 0; self.budget = 1000; self.cooldown_until = 0; self.on_cooldown = None
        self.submissions = []; self.next_result = None
    def form(self):
        self.calls += 1; return form(), catalogue()
    def challenge(self, form):
        self.calls += 1; return IMAGE, 'image/png'
    def submit(self, form, task, code):
        self.calls += 1; self.submissions.append((dict(task), code))
        if self.next_result is not None:
            result, self.next_result = self.next_result, None
            if isinstance(result, Exception): raise result
            return result
        if code != 'TEST': return Result('captcha', 'Synthetic security code is incorrect.')
        return Result('downloaded', 'Synthetic report downloaded.', pdf())
