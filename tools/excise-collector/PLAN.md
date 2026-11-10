# Excise report collector implementation plan

Scope: an independent, local acquisition tool for the forecasting project. Original public NDPS occurrence reports for 2025 and 2026 go into the repository's ignored `raw data` folder. No records enter training or the website automatically. `project.md` remains unchanged.

## Verified portal contract

- Public form: https://eroll.keralaexcise.gov.in/crreport
- Case type NDPS; CR number is a numeric input with a three-character validator (advertised range 1–999, not a confirmed maximum registration number).
- Before 1 June 2025 uses `cased=1`, `unit`; later registrations use `cased=2`, `units`. There are 226 older and 222 newer office options at discovery, no wildcard office.
- 2025 needs both catalogues; 2026 uses the newer catalogue. Office identifiers must remain separate across the transition, including similarly named offices.
- Form submission is POST `/user/crlogin`, with session cookies, CSRF `ps_tkn`, and a security code. Successful JavaScript reads JSON `status`, `msg`, and base64 PDF `cr`; failures can rotate CSRF and CAPTCHA.
- CAPTCHA must be entered by a human, freshly for every submitted query. No recognition, solver service, reuse, endpoint guessing, or bypass.

## Implementation slices

1. **Discovery and plan:** inspect robots and the actual public form; validate the form contract; persist only token-free catalogue/source metadata. Generate virtual office/year streams instead of materializing hundreds of thousands of tasks. Default 1–999, NDPS, both requested years. Optional office/year/number bounds for practical collection.
2. **Normal portal session:** cookie-aware HTTP, same-origin allowlist, bounded responses, timeouts, request budget, serial rate limiting, cooldowns on throttling. Prepare the actual form and image for a human; submit once, never retry a POST automatically.
3. **Durable collection:** SQLite checkpoints, query-level attempts, conservative response classification, immutable hash-addressed PDFs with metadata, restart recovery, checksum verification, CSV/JSONL manifests and explicit search coverage. A missing report never ends a number series or establishes zero cases.
4. **Local workbench:** a dependency-free localhost interface for scope selection, current case, security-code entry, downloads and progress. Keyboard-friendly repeated entry. No security codes or session tokens persisted. Strict local origins and no arbitrary filesystem serving.
5. **Validation and delivery:** fixtures for success, corruption, gaps, CAPTCHA/CSRF failure, rate limiting, unknown results, recovery, collisions, scope extension, and real local HTTP integration. Browser test the local interface. Live-test public discovery; actual report retrieval awaits a human security code. Document the exact boundary of what was verified.

## Stopping and completeness

No consecutive-miss heuristic is sufficient: records can be unpublished, delayed, sensitive, or non-contiguous. Exhaust the selected bounded range; mark untested numbers and unresolved attempts explicitly. Reaching 999 means only the current public form range was checked. At the discovery counts the statewide default is 669,330 potential lookups. Changing site limits or receiving an official index calls for a new source review. Keep the current partial year visibly partial.

## Workbench design

A document-intake workbench: left-aligned scope rail beside one focused security-code task, with a compact download register below. Palette: ink `#101318`, slate `#1a2029`, pale text `#e8edf5`, muted text `#a7b2c2`, blue `#729fe8`, amber `#f4c77a`. System sans for controls; fixed-width only for CR references and hashes. No external assets or animated decoration. At phone width the task precedes the register and scope remains collapsible. The distinctive element is the active CR reference and its source office, rather than generic metric cards. Review: this suits repeated document collection and the project's dark analyst workspace; avoid copying its main app or adding a separate application stack.
