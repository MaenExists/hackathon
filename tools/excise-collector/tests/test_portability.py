import json
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from excise_collector.locking import FileLock

ROOT = Path(__file__).resolve().parents[1]


class PortabilityTests(unittest.TestCase):
    def test_relocated_program_uses_sibling_data_from_an_unrelated_cwd(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder); copied = base / 'Another computer with spaces' / 'Collector'
            copied.mkdir(parents=True)
            shutil.copy2(ROOT / 'collect.py', copied / 'collect.py')
            shutil.copytree(ROOT / 'excise_collector', copied / 'excise_collector', ignore=shutil.ignore_patterns('__pycache__'))
            result = subprocess.run([sys.executable, str(copied / 'collect.py'), 'status'], cwd=base, check=True, capture_output=True, text=True)
            report = json.loads(result.stdout)
            self.assertEqual(Path(report['raw_data_folder']), copied / 'raw data')
            self.assertTrue((copied / 'raw data' / 'collector.sqlite3').is_file())
            self.assertFalse((base / 'raw data').exists())

    def test_second_writer_cannot_lock_folder(self):
        with tempfile.TemporaryDirectory() as folder:
            lock_path = Path(folder) / 'lock'
            held = FileLock(lock_path)
            try:
                code = "from pathlib import Path;from excise_collector.locking import FileLock;FileLock(Path(__import__('sys').argv[1]))"
                result = subprocess.run([sys.executable, '-c', code, str(lock_path)], cwd=ROOT, capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('BlockingIOError', result.stderr)
            finally: held.close()
            reopened = FileLock(lock_path); reopened.close()

    def test_windows_lock_branch_uses_a_single_byte_and_unlocks(self):
        calls = []
        fake = types.SimpleNamespace(LK_NBLCK=2, LK_UNLCK=0, locking=lambda fd, mode, length: calls.append((mode, length)))
        with tempfile.TemporaryDirectory() as folder:
            lock_path = Path(folder) / 'lock'
            with patch.dict(sys.modules, {'msvcrt': fake}), patch('excise_collector.locking.os.name', 'nt'):
                lock = FileLock(lock_path); lock.close()
            self.assertEqual(calls, [(2, 1), (0, 1)])
            self.assertEqual(lock_path.read_bytes(), b'\0')


if __name__ == '__main__': unittest.main()
