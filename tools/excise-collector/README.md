# Kerala Excise report collector

A standalone local tool for acquiring published **NDPS occurrence-report PDFs for 2025–2026** from [Kerala Excise E-Roll](https://eroll.keralaexcise.gov.in/crreport). It does not require the main website, Node.js, an account, an AI model, or Python packages. Source execution requires Python 3.10+. The USB distribution includes Python runtimes.

The portal requires a human security code for every submitted query. This tool does not solve, reuse or bypass it. **Open the workbench, type a code, press Enter; the report is saved if available and the next image appears with the input focused.** A wrong code automatically prepares a fresh image for the same query. Unfamiliar errors and network/rate-limit failures pause for review or explicit retry, rather than inventing missing cases.

## Run from this repository

```sh
python tools/excise-collector/collect.py discover
python tools/excise-collector/collect.py plan
python tools/excise-collector/collect.py serve --open-browser
```

The workbench is printed in the terminal, normally `http://127.0.0.1:8765`. Keep that terminal open. Output defaults to the project's **`raw data/`** folder and is ignored by Git. No records are added to training or the web application automatically.

Opening the page prepares a challenge automatically when work is queued. The default plan covers both years and all relevant offices. To collect a smaller scope, enter an office name fragment or an `era:office_id` identifier from the suggestions, choose the year(s) and CR bounds, and press Enter in the scope form or use **Use these parameters and start**. That becomes the active scope; prior scopes and results remain saved. On phones expand Collection scope to change it.

Use Pause before leaving. Reloading an unpaused page resumes the existing challenge or prepares a fresh one if expired; it never repeats a previous submission. Close the terminal or press Ctrl+C to stop. Restarting recovers unfinished queries. An explicitly paused tab stays paused across reloads.

## Portable USB copy

Copy the **whole `ExciseCollector` folder** onto a writable local folder on the other computer. Alternatively copy and extract `ExciseCollector.zip`; this preserves Unix executable permissions when supported. Do not copy only a launcher. No installer or administrator access is needed on supported systems.

| Computer | Start |
| --- | --- |
| Windows 10/11, x64/x86/ARM64 | Double-click `Start-Windows.bat` |
| macOS, Intel or Apple Silicon | Open `Start-macOS.command`, or run `sh Start-macOS.command` in Terminal |
| Linux, x86_64 or ARM64 with glibc | Run `sh Start-Linux.sh` from the copied folder |

First launch extracts the matching bundled Python into `.runtime/`; subsequent launches reuse it. A browser opens automatically on a free local port. All PDFs, checkpoints and manifests go into **`raw data` inside that copied folder**, regardless of the current working directory. Stop the program before moving or copying an active collection. Each computer's copy runs independently; copying a stopped folder transfers its progress.

The seven bundled runtimes cover these common architectures, not every historical operating system. The embedded Windows runtime requires Windows 10 or newer. macOS requires a version supported by the bundled CPython distribution (Intel macOS 10.15+; Apple Silicon macOS 11+). Linux bundles require glibc; musl/Alpine and unsupported architectures can use a separately installed Python 3.10+ with `python3 start.py`. Corporate application restrictions and normal macOS security checks still apply. Internet is needed to reach the portal, even though installation is offline.

Do not run from a read-only directory or an unreliable network share. The launchers do not change system configuration. On a FAT USB filesystem the `.sh`/`.command` files may lack an executable bit; running them with `sh` works, or extract the ZIP onto the local disk.

## What is saved

```text
raw data/
  collector.sqlite3           authoritative query/attempt checkpoints
  catalogue.json              current token-free portal office catalogue
  discovery/                  semantic catalogue snapshots
  documents/<hash-prefix>/<sha256>.pdf
  records/<year>/<before|after>/<office-id>/NDPS-<CR>-<attempt>-<hash>.json
  manifest.jsonl              downloaded-document index, relative file paths
  search_coverage.csv          checked numbers and unresolved searches by office/year
  report.json                 collection totals and limitations
  quarantine/                 damaged files preserved by verify --repair, if needed
```

Original PDF bytes remain unchanged. SHA-256 deduplicates identical files while retaining each query's separate metadata. Query parameters are not independently verified facts extracted from the PDF. Metadata retains source URL, office system/ID/name, year, CR number, retrieval timestamp, checksum, size, and explicit unknown event/publication dates. **Retrieval time is not historical publication time.** Names and other report contents are not extracted into indexes.

Each successful PDF and its metadata are committed immediately; the document manifest is updated immediately. Full summary/coverage snapshots refresh at most once per 30 seconds during collection and on normal shutdown, or explicitly with `export`. The live interface queries SQLite directly. SQLite is authoritative if interrupted while an index is being written.

```sh
python tools/excise-collector/collect.py status
python tools/excise-collector/collect.py verify
python tools/excise-collector/collect.py export
# Preserve damaged files in quarantine and queue affected cases for recollection:
python tools/excise-collector/collect.py verify --repair
```

Outside this repository run `python collect.py ...` from the program folder. Use `--data-dir "/path/to/raw data"` **before** the command to override output. An unbundled, copied program defaults to a sibling `raw data` folder.

## Scope and stopping

The observed form supports three-character numeric CRs, hence the default **1–999** range. This is a public form limit, **not a confirmed last registered case number**. There is no discovered public last-case index or bulk-export link. The portal advertises records since 2020; the requested collection deliberately selects only 2025–2026, without asserting that earlier records never exist.

At 10 November 2026 discovery, there were 226 older and 222 newer office entries. Cases before 1 June 2025 use the older system; later cases use the newer one. The 2025 plan includes both; 2026 includes the newer system. Similar names in different systems are not silently merged. A complete bounded statewide sweep would require **669,330 potential human-assisted searches**. Select an office first for practical collection; a provider export/index is the practical route to comprehensive bulk acquisition.

A series of unavailable numbers does not stop an office's search. Unknown errors, CAPTCHA failures, throttling and missing/unpublished reports are distinct. Review items remain unresolved until retried. `selected_range_checked` means only that every selected number received a recognized result at collection time; `complete_case_universe` is always false. Unavailable reports never create zero-case training labels or complete reporting weeks. Sensitive reports and delayed publication may be absent; 2026 is partial. Registration office is not necessarily seizure location.

## Network behavior

Requests are serial, at least two seconds apart, with cookie/CSRF session handling, timeouts, response-size limits, robots checks and a default 1,000-request budget per run. HTTP 429/5xx triggers a durable cooldown of at least 60 seconds, respecting longer Retry-After values. There are no automatic POST retries. Every POST requires a new explicit human code entry; security codes and session tokens are not saved. The local workbench accepts only same-origin loopback actions and serves only indexed PDFs as attachments.

If the site returns an unfamiliar error, the query is marked Needs review and automation pauses. Its known error message or response field names are retained without tokens. Retry in the register uses a fresh challenge. Do not change unknown responses into unavailable results merely to progress the queue.

## Verification

```sh
python -m unittest discover -s tools/excise-collector/tests -v
# Browser integration, using this workspace's existing Playwright:
node tools/excise-collector/tests/workbench.spec.cjs
```

All 30 backend tests and the browser loop checks pass. Tests use synthetic PDFs, images and codes. Live public discovery, image fetching, wrong-code recovery and three real PDF downloads (CR 1–3/2026, Thiruvananthapuram Range Office) were also verified with human-entered codes. The downloaded files pass checksum and PDF-parser checks. See [RESEARCH.md](RESEARCH.md) for the observed contract and live-test findings, and [PLAN.md](PLAN.md) for the implementation plan. This verifies retrieval, not complete statewide coverage.

## Rebuild the portable release

```sh
python tools/excise-collector/build_portable.py --output "/new/path/ExciseCollector" --data-dir "raw data"
```

This downloads the exact runtime archives pinned in `runtime-sources.json`, checks authoritative upstream SHA-256 values, copies source and a consistent SQLite backup, and creates a folder, ZIP, `runtime-manifest.json` and `SHA256SUMS`. It refuses to overwrite an existing destination. The Windows archive's `._pth` is adjusted to include the relative application directory; both upstream and modified archive checksums are recorded. Runtimes and runtime caches are excluded from Git. Retained Python/dependency licenses are inside the runtime archives; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
