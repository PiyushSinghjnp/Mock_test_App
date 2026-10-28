# Live REA Scrape audit — 28 October 2026

## Scope and result

Reviewed the button and iframe extraction in `js/app.js`, injected navigation/login bridge, all routes in `oliveboard-live-re.js`, paper ingestion in `server.js`, exam normalization, scoring/solution consumers, the clone's MCP server, verification scripts, and relevant saved captures. This is a source and isolated-behavior audit, not a fresh authenticated observation of Oliveboard. Existing captures may reflect older or modified content; they are fixtures, not proof of the current upstream website.

No application code, existing captures, papers, or database was changed. Reproduction checks used in-memory filesystem/network replacements or pure functions. They did not log in, submit a test, or contact the original website.

The current flow is: button → proxied iframe → client DOM extraction → POST `/api/ob-browser/scrape` → artifact files under `scraped/`. There is no actual REA call and no application import at the end.

## REA setup

- REA 6.4.0 was available through the npm cache, but its Codex MCP registration was missing.
- Ran the scoped dry-run, then applied Codex setup as requested. Updated `C:\Users\91841\.codex\config.toml`; backup: `C:\Users\91841\.codex\config.toml.rea.backup`. Other client registrations were not repaired. The existing skill matched version 37 and was not replaced.
- Verified an actual stdio MCP handshake through the installed MCP SDK: server `rea`, version `6.4.0`, 170 tools, including `list_browser_targets` and `capture_web_screenshot`.
- The registration uses Node and the public REA launcher under `C:\Users\91841\AppData\Local\npm-cache\_npx\dea9475797100b20\node_modules\rea-agents\scripts\rea.mjs`. Clearing that cache would invalidate the path.
- The active chat has not hot-loaded those tools; reconnect/restart is needed for direct agent-tool access. Installing this registration does not connect the app's scrape button to REA.

## Findings

### 1. High: “REA Verified” does not mean REA ran

`oliveboard-live-re.js:744` manufactures an evidence ID from the clock and writes a short JSON object with a self-assigned provider name. There is no MCP client/transport invocation in the scrape flow. `js/app.js:2820` displays “REA Verified” whenever that ID exists. The separate `mcp-server.js` exposes the clone's database and saved-artifact readers; it does not invoke external REA.

Impact: failed or incomplete extraction is presented as independently verified reverse engineering. Replace these claims with actual tool evidence and explicit coverage, or accurately label DOM-only extraction.

### 2. High: nothing is applied to the clone

`oliveboard-live-re.js:661` receives `ingestCallback`, but never invokes it. `:801` initializes `ingestedTest` to null and never updates it; `:818` saves only in `scraped/`. `server.js:399` and `:412` ingest/watch `papers/`. The frontend refresh at `js/app.js:2830` is consequently unreachable for a successful import.

This appears to be a deliberate earlier isolation change: `scripts/verify_isolated_scraper.js:49–64` expects a null import and no live tests. Reconnecting the callback alone is insufficient because findings 3–9 would corrupt or duplicate imported content. There is also no pipeline to apply captured styles, layouts, or behavior to the clone.

### 3. High: missing answers and explanations are invented

Backend `oliveboard-live-re.js:710–714` substitutes answer A and “Official Oliveboard step-by-step explanation.” when evidence is missing. Frontend `js/app.js:2623–2633` defaults missing solution answer indices to B. The solution count is then the number of accepted questions, even when no answers were captured.

Reproduced with one question and no answer: saved answer A, placeholder explanation, import callback called zero times. These papers must remain incomplete/ungradable until real answer evidence is available.

### 4. High: decoding can truncate valid questions

`oliveboard-live-re.js:527–537` and `js/app.js:2550–2558` assume any string longer than 64 characters might have a 32-character salt at each end. A weak content check accepts the middle of ordinary Base64. Already decoded values are also passed through decoding again on the backend.

Reproduced standard Base64 of:

> This is a long ordinary base64 question with enough characters to exceed sixty four encoded bytes.

Actual backend result:

> base64 question with enough characters to exceed si

Use an explicit source encoding and decode once; retain the raw source and validate the decoded result.

### 5. High: section assignment uses the wrong data model

`js/app.js:2598` reads `secount`, but `:2637–2639` treats it as cumulative boundaries. A saved solution capture (`scraped/live_capture_oliveboard_solution_app_1792765921000.html`) contains four section names with `secount = [25,25,25,25]`. Replaying the current algorithm yields 25 English questions and 75 Professional Knowledge questions, with no Reasoning or Quantitative questions.

The live-test fallback at `js/app.js:2712` independently hardcodes a 40/30/rest split for every exam. It also sorts question IDs numerically rather than preserving demonstrated source ordering. Section names, counts, order, and timings need source-backed mapping.

### 6. High: answer index can override a corrected answer

`oliveboard-live-re.js:812–814` preserves a question's existing `correctIndex` while replacing only `correctAnswer` from a solution. `js/exam-patterns-2026.js:483–484` gives the old index precedence. Reproduced `{correctIndex:1, correctAnswer:'A'}` remaining index 1 (B). Scoring and solution display consume that index (`js/test-engine.js:1809`, `js/solution-engine.js:762`).

Choose one canonical answer representation, validate that it references an existing option, and derive all other representations from it. Unknown must not become index 0 (`js/exam-patterns-2026.js:505`).

### 7. High, latent on import: normalizer overwrites scraped exam settings

`server.js:346` unconditionally applies the fixed exam registry. `js/exam-patterns-2026.js:446` defaults unknown exams to SBI PO; `:528` falls back when sections do not match; `:600–605` replaces timing, marks, and section names.

Pure-function reproduction: a UIIC AO question in General Knowledge, supplied with 90 minutes and +2 marking, becomes SBI PO / English Language / 20 minutes / +1. Preserve observed metadata; any registry fallback must be explicit and separately labeled.

### 8. Medium: partial captures cannot reliably merge into a complete test

`oliveboard-live-re.js:804` uses timestamp-based test IDs; `server.js:358` upserts only on ID. Enabling import as-is would duplicate a test on each click. The normalizer at `js/exam-patterns-2026.js:644–647` generates identity from order rather than preserving source `qid`.

The scraper reads only currently available DOM, accepts even one question (`oliveboard-live-re.js:802`), and equates captured count with total questions. It has no expected-count check, pagination/lazy-load traversal, or merge across live-test and solution captures. Stable source/test/question identities and completion tracking are needed before publication into the catalog.

### 9. Medium: question assets are not collected with the paper

HTML and image paths are copied without resolving them against the source URL or downloading a verified asset set. `js/test-engine.js:1059–1060` and `js/solution-engine.js:277–278` only rewrite certain paths to local folders. Newly encountered images can therefore break when the paper is rendered locally. Capture styles/scripts are likewise not transformed into application changes.

### 10. High: failures are reported as successful captures

`js/app.js:2747` silently returns null on extraction errors. The backend accepts null, writes placeholder HTML, inserts default modal/table entries, and sets all capture flags true (`oliveboard-live-re.js:739–790`). `dashboardCardsCount || 5` changes an actual zero into five, and `uiElementsMatched` is hardcoded to 14 (`:834`).

Reproduced null payload: full DOM, visual snapshot, and REA evidence flags all true, plus one modal, one table, and five cards. Reject absent/invalid captures and distinguish empty pages, unsupported layouts, partial coverage, and upstream errors.

### 11. High: the “screenshot” is a generated summary card

`oliveboard-live-re.js:718–734` draws an SVG containing labels and counts. No pixels of the page are captured. It cannot verify visual fidelity or show the actual dialog/page state. Use a real browser screenshot, and label a summary graphic as a summary.

### 12. High: proxy failure and login state are unreliable

- `oliveboard-live-re.js:1029–1031` converts empty upstream responses and thrown network errors into HTTP 200 success. A simulated outage reproduced `{status:1, success:true}`.
- `js/ob-proxy-bridge.js:252–267` treats any nonempty response except `0` as login success, so the synthetic failure response can trigger a false login redirect.
- `oliveboard-live-re.js:1103`, `:1115`, and `:1147` mark a user logged in merely for navigating/syncing a URL or filling login. Reproduced navigation to an unauthenticated dashboard URL yielding `isLoggedIn:true`.
- AJAX proxy re-encodes parsed request objects as form data regardless of original format, drops upstream status/content type, and follows redirects without collecting intermediate cookies (`:986–1029`). This can alter JSON APIs and hide expired-session redirects.

Preserve upstream request/response semantics and establish auth only from a validated response/session observation.

### 13. High: cookie/session isolation and proxy trust boundaries are broken

`oliveboard-live-re.js:66–78` stores cookies only by name, losing Domain, Path, expiration, and Secure semantics. All stored cookies are sent to arbitrary normalized target URLs (`:564–566`, `:926–935`, `:983–995`). Initial homepage cookies are discarded when `shouldSendCookies` is false (`:582`). This can break login and can disclose cookies if an unrelated target is proxied.

Session, tab state, and cookies are process-global, so different users/browser clients interfere. `index.html:1302` renders remote executable content in an unsandboxed same-origin iframe. Both message listeners (`js/app.js:2246`, `js/ob-proxy-bridge.js:428`) omit origin/source validation; login credentials are sent with target origin `*` (`js/app.js:2163`).

These are concrete design exposures, not evidence that misuse occurred. Use a bounded target policy, correctly scoped cookie storage and per-session state, and isolate remote content from the app's privileged origin.

### 14. Medium: popup/tab behavior changes the site being observed

`js/ob-proxy-bridge.js:113–124` replaces a popup with navigation of the existing iframe and returns that same window. The backend initializes a single tab and has switch/close handlers, but no new-tab operation. A dashboard → test → solution workflow therefore does not retain the separate windows or opener relationships that the UI suggests.

The bridge also replaces login functions, rewrites navigation, and hides modal backdrops. A captured proxied page is an instrumented version of the original and should not be presented as unmodified runtime evidence.

### 15. Medium, latent on batch import: file watcher loses work

`server.js:411–420` uses one debounce timer across all filenames. Two different paper drops within 300 ms cancel the first pending ingestion. Use a per-file queue/debounce or explicit transactional import, with failures surfaced to the user.

## Validation and limits

- Syntax checks passed for `oliveboard-live-re.js`, `js/app.js`, and `js/ob-proxy-bridge.js`; these are behavioral flaws, not parse errors.
- Isolated runtime probes confirmed false success for null captures/network errors, missing-answer fabrication, unused import callback, Base64 truncation, and unauthenticated navigation marking login true.
- Pure mapping/normalizer checks confirmed section collapse, answer-index precedence, and exam metadata replacement.
- Existing verification scripts mostly print results rather than assert behavior. `package.json` has no working test suite, and its build checks omit the live scraper and browser bridge. Their “passed” messages are insufficient evidence of correctness.
- No claim is made that the current authenticated original website was fully scraped or reverse engineered in this audit. Current source layouts, answer formats, lazy-loading behavior, and auth responses still need observation in a real selected session before building reliable adapters.

## Recommended repair order

1. Remove misleading verification and invented content; add capture validation and honest errors.
2. Establish the real REA/browser integration and isolate the browser session from the clone. Preserve screenshots and tool-returned evidence with explicit limits.
3. Repair decoding, source identity, section metadata, answer normalization, and asset capture using captured fixtures.
4. Add stable capture/merge records and completeness checks. Preserve authentic exam metadata rather than silently replacing it.
5. Implement a reviewable apply/import step with atomic updates, deduplication, and rollback; distinguish content import from UI/behavior changes.
6. Verify dashboard → live test → solutions → repeated scrape → import, plus failed login/network, partial capture, unsupported exam, and multi-user cases.

Implementation is deferred until the next step requested by the user.
