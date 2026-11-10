#!/bin/sh
set -eu
COLLECTOR_ROOT=$(CDPATH= cd -P "$(dirname "$0")" && pwd)
cd "$COLLECTOR_ROOT"
case "$(uname -s)" in
  Linux) COLLECTOR_OS=linux ;;
  Darwin) COLLECTOR_OS=macos ;;
  *) echo 'Use the Windows launcher on Windows.'; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) COLLECTOR_ARCH=x64 ;;
  aarch64|arm64) COLLECTOR_ARCH=arm64 ;;
  *) echo 'No bundled runtime for this architecture. Run python3 start.py with Python 3.10+.'; exit 1 ;;
esac
COLLECTOR_TARGET="$COLLECTOR_OS-$COLLECTOR_ARCH"
COLLECTOR_RUNTIME="$COLLECTOR_ROOT/.runtime/$COLLECTOR_TARGET"
COLLECTOR_ARCHIVE="$COLLECTOR_ROOT/runtimes/$COLLECTOR_TARGET.tar.gz"
if [ -f "$COLLECTOR_ARCHIVE" ]; then
  if [ ! -f "$COLLECTOR_RUNTIME/.ready" ]; then
    mkdir -p "$COLLECTOR_RUNTIME"
    echo 'Preparing the bundled Python runtime. This only happens once.'
    tar -xzf "$COLLECTOR_ARCHIVE" -C "$COLLECTOR_RUNTIME"
    touch "$COLLECTOR_RUNTIME/.ready"
  fi
  exec "$COLLECTOR_RUNTIME/python/bin/python3" "$COLLECTOR_ROOT/start.py"
fi
if command -v python3 >/dev/null 2>&1; then exec python3 "$COLLECTOR_ROOT/start.py"; fi
echo 'Use the complete portable copy, which includes runtimes, or install Python 3.10+.'
exit 1
