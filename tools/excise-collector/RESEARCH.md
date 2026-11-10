# Portal research and validation

Inspected 10 November 2026. Main project context: `project.md`, `ml/docs/DATA_COLLECTION.md`, `ml/docs/HEATMAP_DATA_PLAN.md` and `ml/docs/PILOT_ACQUISITION_PLAN.md`. This acquisition tool is independent of the model and website; the project context remains unchanged.

## Public sources

- [Actual public form](https://eroll.keralaexcise.gov.in/crreport), its embedded JavaScript, validation rules and office options.
- [E-Roll home](https://eroll.keralaexcise.gov.in/); the employee sign-in area is separate and was not accessed.
- `https://eroll.keralaexcise.gov.in/robots.txt` returned 404 during initial discovery. No robots file is not a statement of bulk access authorization. The client rechecks on each new process and honors disallows and crawl delay if provided.
- Published support contact on the public form: **ecoffice.exc@kerala.gov.in**, **0471-2335568**, **9400069400**. No messages were sent or credentials requested. A provider-produced export or approved API, plus a last-case index and coverage definitions, would remove the impractical per-search human-code requirement.

The browser connector was unavailable. Research fell back to direct retrieval of the public form, the web tool and local Playwright for the workbench. No security code was machine-read or solved.

## Observed request/response contract

The HTML form `frm-cr-download` submits via AJAX to `POST /user/crlogin`. Normal form fields are:

| Field | Value |
| --- | --- |
| `ps_tkn` | Current hidden CSRF token from the same cookie-aware session |
| `crnumber` | Numeric crime number, validator length 1–3 |
| `year` | Four-digit year; date picker currently permits 2020–2026 |
| `casetype` | `NDPS` for this collector; ABKARI is outside requested scope |
| `cased` | `1` for before 1 June 2025, `2` for later |
| `unit` | Older office ID when `cased=1`, otherwise empty |
| `units` | Newer office ID when `cased=2`, otherwise empty |
| `captcha` | Fresh human-entered security code for the displayed image |

Office fields are shown/hidden by the page's change handler. The current HTML contains 226 nonempty `unit` options and 222 nonempty `units` options, with no wildcard/all-office option. Distinct IDs cannot be inferred to identify the same registration universe from names alone.

The page's success handler expects `response.status == true`, takes `response.cr` as a base64 PDF and triggers a download. Its error handler shows `response.msg`, replaces the CSRF token from `response.csrf`, and requests a fresh CAPTCHA. The collector obtains a fresh form and image for every human entry, including after success, to avoid stale cookies/tokens and code reuse. It does not inspect or exploit server-side validation behavior.

The live HTML's year text mentions records since January 2020. Only 2025–2026 are collected because that is the requested scope; the user's report that earlier years had no useful data has not been independently established.

## Numbering and search strategy

There is no observed definitive last-CR field/list endpoint. The three-character client validator bounds normal searches to 1–999. Searching both 2025 systems and the 2026 newer system spans `(226 + 222 + 222) × 999 = 669,330` combinations. No guessed requests beyond the observed form range or undocumented bulk endpoints are used.

The durable plan stores office/year streams virtually. Low numbers across the current selected scope are prioritized, and scope can be narrowed without losing prior results. Every untested number remains untested; consecutive misses do not establish an end. This avoids silent omissions from sparse publication or numbering gaps. Query coverage is distinct from agency reporting completeness and from the canonical case universe required for model training.

## Validation record

- Live form discovery and security-image acquisition succeeded with the actual public portal and cookie-aware client. No case POST is made by discovery or image acquisition.
- Initial human-triggered submissions returned HTTP 200 with an unfamiliar error outside the normal `msg` field. They were retained as Needs review, not silently marked unavailable. Follow-up diagnostics established the actual wording `No Data Available. status`. The decoder now recognizes that wording as unavailable, reads `message`, `error` and `errors` as diagnostic alternatives, and includes field names when no error text is present. Earlier unresolved attempts remain in the audit history.
- Subsequent human-assisted live testing recovered from the actual `Wrong Security Code` response and downloaded three original PDFs successfully: CR 1, 2 and 3 of 2026, newer office ID 1486 (Thiruvananthapuram Range Office). Actual success message: `Data Received`. Automatic next-image preparation and Enter-only progression worked across these downloads. Saved bytes were checked against their SHA-256/size and parsed with Poppler `pdfinfo`; report contents were not extracted into project indexes.
- Backend tests exercise actual SQLite/filesystem and local HTTP with synthetic portal responses: immutable document storage, byte deduplication, manifests, scope changes, gaps, invalid/corrupt PDF bytes, CAPTCHA and session failures, retry/cooldown behavior, interrupted work, stale challenge rejection and local request boundaries.
- Playwright exercises the real workbench against a synthetic portal adapter: automatic first image, code + Enter, saved file on disk, automatically focused next image, wrong-code recovery, reload without resubmitting, scope changes and mobile overflow.
- The bundled Linux CPython runtime runs the backend tests successfully. Additional portable-copy relocation checks are performed before delivery. Windows/macOS archives and embedded search paths can be validated on Linux; actual execution on those operating systems is not claimed without a host test.

Live validation status must be updated if later real human-assisted submissions establish more of the response contract. Test PDFs never go into the real raw-data folder or USB case collection.
