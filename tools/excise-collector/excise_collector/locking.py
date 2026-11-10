"""One writer per output directory on Windows, macOS and Linux."""
import os
from pathlib import Path


class FileLock:
    def __init__(self, path: Path):
        self.file = path.open('a+b')
        try:
            if path.stat().st_size == 0:
                self.file.write(b'\0'); self.file.flush()
            self.file.seek(0)
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as e:
            self.file.close()
            raise BlockingIOError('Another collector is using this output folder.') from e

    def close(self):
        if self.file.closed: return
        try:
            if os.name == 'nt':
                import msvcrt
                self.file.seek(0); msvcrt.locking(self.file.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(self.file, fcntl.LOCK_UN)
        finally: self.file.close()
