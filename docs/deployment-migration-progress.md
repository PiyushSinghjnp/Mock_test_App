# SQLite to Neon / Render migration checkpoint

Last updated: 2026-11-07 (PostgreSQL runtime and first 10-candidate run)

## Completed locally

- Audited the Express + `node:sqlite` app, MCP server, Vite config, package scripts, existing auth/upload tests, and SQLite runtime. The API performs synchronous SQLite work directly in route handlers across `server.js`; MCP also opens SQLite directly.
- Used SQLite's online backup API against the live WAL database. Restorable snapshot: `backups/database-2026-11-07T08-45-51-318Z.sqlite`; inventory sidecar is adjacent. Backup `PRAGMA integrity_check` returned `ok`. Original database, WAL, and SHM files were not altered. `backups/` is gitignored.
- Snapshot inventory: `users` 4, `tests` 5, `test_attempts` 0, `paused_attempts` 1, `quiz_questions` 17, `candidate_quiz_history` 16, `admin_audit_log` 2. Inventory includes column definitions, PK/FK metadata, indexes, sequences, and candidate fields without password hashes.
- Schema columns (full types, nullability, defaults, PK/FK details are in the inventory sidecar):
  - `users`: id, username, name, email, avatar, roll_no, target_exam, created_at, password_hash, coins, streak_days, last_quiz_date. PK `id`, unique `username`.
  - `tests`: id, exam_id, exam_name, type, title, subtitle, marks, questions_count, duration_minutes, marks_per_correct, negative_marks, is_free, sections_summary_json, test_data_json, created_at. PK `id`.
  - `test_attempts`: id, user_id, test_id, test_title, total_questions, score, max_score, correct_count, wrong_count, unanswered_count, accuracy, percentile, estimated_air, time_spent_seconds, section_breakdown_json, responses_json, started_at, completed_at. PK `id`; FKs to users/tests with cascade delete.
  - `paused_attempts`: user_id, test_id, current_section_index, current_question_index, last_question_number, section_remaining_seconds, remaining_seconds, completed_sections_json, responses_json, bookmarked_json, updated_at. Composite PK `(user_id,test_id)`.
  - `quiz_questions`: id, subject, question_text, passage_html, image_urls_json, options_json, correct_answer, explanation_html, marks, negative_marks, created_at. PK `id`.
  - `candidate_quiz_history`: id, user_id, subject, question_id, attempted_at. Integer PK, unique `(user_id,question_id)`.
  - `admin_audit_log`: id, action, test_id, details_json, created_at. Integer PK.
- Installed `pg`; added pooled access and transaction helpers in `db/postgres.js`, and initial schema migration in `db/migrations/001_initial_schema.sql`.
- Added an idempotent snapshot importer in `scripts/migrate-postgres.js` (also exposed as `scripts/migrate-sqlite-to-postgres.js`). It uses `ON CONFLICT DO NOTHING`, preserves existing PostgreSQL values, resets identity sequences, and checks source rows by primary key before reporting exact matches/conflicts.
- Updated `.env.example`, package scripts, and a Node 22 version pin.
- Added credential-safe Neon diagnostics (`npm run db:check`, `npm run db:inspect`) that load the project `.env`, validate pooled/direct endpoint shape, run `SELECT 1` on both, and inspect the destination without printing URLs or candidate data.
- Disabled the unauthenticated MCP server and HTTP/SSE MCP routes in production while its candidate authorization is unimplemented.
- Investigated and applied the smallest safe dependency fix: transitive `body-parser` update within Express's allowed range. `npm audit --omit=dev` now reports 0 vulnerabilities.

## Verification run

- `node scripts/backup-sqlite.js`: passed; backup integrity `ok`; row counts above.
- `npm.cmd install pg --save`: completed. The transitive high severity `body-parser` advisory was subsequently resolved (see below).
- `node scripts/check-neon-connectivity.js` loaded the project `.env` without printing values, detected a pooled `DATABASE_URL` and direct `DATABASE_DIRECT_URL`, and returned `SELECT 1` successfully through both.
- Applied `001_initial_schema.sql` on the existing empty Neon schema using the direct endpoint. No tables or data existed beforehand; only additive tables/indexes and the migration ledger were created.
- Applied additive `002_auth_and_attempt_guards.sql`: session table stores only SHA-256 hashes of opaque session and CSRF tokens; also adds login throttling state, paused-state revision, and unique per-candidate submission idempotency key.
- Added `db/auth.js` primitives for opaque hashed sessions, CSRF token hashes, secure HTTP-only cookie settings, and constant-time CSRF comparison. These are schema/helper groundwork and are **not yet wired into the runtime routes**.
- Created a fresh online SQLite backup `backups/database-2026-11-07T09-20-26-005Z.sqlite`; integrity check returned `ok`.
- Imported that snapshot through the pooled endpoint. Report: `backups/migration-report-1794043317278.json`. All source rows matched exactly by primary key and every column; counts are users 4/4, tests 5/5, test_attempts 0/0, paused_attempts 1/1, admin_audit_log 2/2, quiz_questions 17/17, candidate_quiz_history 16/16. No conflicts/mismatches; foreign keys resolved; identity sequences reset; JSON strings were valid and preserved. The original SQLite DB remains intact.
- Re-ran the same import. Report `backups/migration-report-1794043727097.json` again showed exact counts and zero conflicts/mismatches, confirming idempotent repeat behavior.
- Neon integration suite passed against the configured database using 10 simultaneous pooled reads and synthetic rows inside a rolled-back transaction. It verified hashed session token storage, stale paused-attempt revision rejection, submission idempotency, pool bound, and rollback cleanup. No synthetic data persisted.
- Production MCP disabling has a regression test. `npm test`: 21 passed, 2 credential-gated integration tests skipped by default. The two PostgreSQL tests were run separately against Neon and passed. `npm run build` passed.
- `npm audit --omit=dev` first found high severity `body-parser` GHSA-27r3-jxmh-p828 via Express (`body-parser` 2.3.0). `npm update body-parser` resolved within the existing dependency range; npm reported zero vulnerabilities. A subsequent sandboxed audit call could not reach the registry, so the zero-vulnerability result is from the successful update audit.
- A read-only check of the SQLite snapshot found 3 of 4 candidate hashes match the shared legacy demo password. Production now refuses that password, does not assign it to unhashed users or seed demo profiles, and exposes an admin-token-only password provisioning endpoint with a 12-character minimum. Candidates using those legacy credentials need private passwords provisioned before cutover. No hashes or usernames were printed.

## Free-tier constraints checked

- Current Render documentation lists 512 MB RAM and 750 free instance hours per workspace per month. Free services can sleep, restart, and have ephemeral filesystems; Render says Free services are intended for previews/hobby use, not production. Included bandwidth is workspace-dependent and shown in its dashboard. [Render Free docs](https://render.com/docs/free)
- Current Neon Free docs list 100 CU-hours/project/month, 1 GB database storage/project, 5 GB public transfer/project/month, and compute scale-to-zero after five idle minutes. Hitting a quota can suspend compute/writes until reset or plan change. [Neon Free plan limits](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md)
- Requested 70 CU-hours, 700 MB storage, and 3.5 GB transfer values remain conservative warning thresholds, not provider caps. The user-provided 3.5 GB Render transfer threshold must be compared to the actual workspace dashboard allowance.

## Deployment status and remaining work

**Runtime conversion now in progress and PostgreSQL backed.** Production `server.js` branches into `server-postgres.js` before importing SQLite. The PostgreSQL server uses the pooled `pg` module, secure opaque cookie sessions with CSRF validation, candidate-scoped private routes, protected answer keys, authoritative test scoring, transactional idempotent submission and quiz rewards, revision-gated paused-attempt saves, quiz history/isolation, admin upload/save routes, `/health`, and built frontend assets. The SQLite server remains the development path. MCP development access now uses PostgreSQL; HTTP/SSE and stdio MCP remain disabled in production.

Frontend changes add 30-second dirty-state autosaves, immediate save on section timeout and explicit pause, browser local-storage recovery, revision numbers, retries with backoff, and an in-test save status. Render configuration is present in `render.yaml`; it uses `npm ci && npm run build`, `npm start`, `/health`, and the free service plan. Runtime image uploads are disabled because Render's filesystem is ephemeral. The SQLite backup and imported data were not changed.

### Latest verification

- Latest `npm test`: 25 passed, 3 credential-gated PostgreSQL/load tests skipped by default.
- Latest `npm run build`: passed; Vite generated `dist/index.html`, `dist/admin.html` and static assets.
- `npm run db:check` with permitted network access: pooled and direct endpoints both returned `SELECT 1`; secrets and URLs were not printed.
- `npm run db:inspect`: confirmed migrations 001 and 002 and the original imported table counts (users 4, tests 5, attempts 0, paused 1, quiz questions 17, quiz history 16, audit 2).
- Credential-gated `npm test` with `RUN_POSTGRES_INTEGRATION=1`: 24 passed, including pooled concurrency, session hashing, stale-revision rejection, unique submission keys, and transaction rollback.
- Latest `RUN_POSTGRES_LOAD=1 node --test tests/postgres-runtime-load.test.js`: **10 synthetic independent candidates** registered, logged in, loaded catalog/papers, autosaved, refreshed across an HTTP server restart, submitted concurrently, retried submissions, loaded results/analytics, and attempted cross-candidate reads. The fixture is a daily quiz and verifies the 50-coin reward is issued once and not duplicated on retry. Test passed: 92 measured requests, 0 failures, 10 finalized attempts, 0 duplicate attempts/rewards, stale revision retained revision 2, answers stayed hidden until submission, cross-candidate reads returned 404, and unauthenticated attempt access returned 401. Peak Node RSS was 117.3 MB; pg pool maximum/observed total was 5. Endpoint p50/p95: catalog 1.05s/1.11s, paper loading 1.07s/1.09s, paused saves 1.05s/1.14s, submissions/retries 2.18s/3.85s, result detail 0.55s/0.56s. Concurrent registration was slower (7.65s/8.16s) due scrypt plus shared Neon latency. Ordinary warm request p95 remains above the suggested 1 second target for autosave and submission under this synthetic 10-user workload. This verifies correctness and bounded memory, but the performance target is not met and results do not guarantee all Render/Neon free-tier conditions.
- Load-test records used unique synthetic IDs and were removed in test cleanup. Existing candidate/test records were untouched.
- Final read-only Neon inventory after cleanup confirmed original source counts again: users 4, tests 5, attempts 0, paused attempts 1, audit log 2, quiz questions 17, quiz history 16. The load harness cleanup removes registration-created users by their synthetic usernames, not by the generated database ID.
- MCP read verification called development `list_mock_tests` through the live shared PostgreSQL adapter; it returned all five existing tests without mutation.
- Production-mode local smoke test used ephemeral random session/admin secrets and the configured pooled Neon URL: `/health`, `/`, and `/admin` returned 200; MCP manifest returned 404. No database writes were made.

### Remaining before deployment

- The verified timer workload does not meet the suggested sub-second warm p95 threshold for autosaves/submissions. Profiling shows Neon query/network time dominates and JSON serialization is below 1 ms; the local test runner is geographically distant from the configured US East database. Render is configured for Ohio, but production latency remains unverified.
- Legacy password format is compatible with the existing salted scrypt hashes. Shared demo password `password123` remains rejected in production; provision private credentials for the affected migrated accounts before cutover.
- Server-authoritative timers are implemented in additive migration `003_authoritative_exam_timers.sql`; the timer workload now verifies deadline enforcement, pause/resume, refresh recovery, client timer tampering, sectional expiry, total expiry, and concurrent tabs. Browser countdown remains display-only and is corrected from server responses.
- Full Vite static output must be reviewed against any private files added to public asset source directories before publishing.
- No Render deployment has occurred. Add `DATABASE_URL` (pooled URL), and generated `SESSION_SECRET`/`OLIVEBOARD_ADMIN_TOKEN` through Render's environment setup; the direct URL is not required at runtime.
- `render.yaml` selects Ohio near Neon `us-east-2`; Render does not allow changing service region after creation, so confirm this before creating the service.
- Keep schema/data migration a deliberate command; never run imports or migrations as web-service startup. Do not deploy until legacy candidate passwords have been provisioned and the remaining review is complete.

## Final pre-deployment optimization checkpoint — 2026-11-07

### Completed

- Applied additive migration 003 to the existing Neon branch. It creates only `active_test_sessions` and its partial deadline index. It does not change existing application records. `npm run db:inspect -- --summary` shows migrations 001–003 and unchanged original counts: users 4, tests 5, attempts 0, paused attempts 1, admin audit 2, quiz questions 17, quiz history 16.
- Timer rows are candidate/test scoped and store total and section deadlines, active/paused/expired/submitted state, current section, completed sections, revision, and a server-generated idempotency key. Server uses `clock_timestamp()` deadlines; client-reported remaining seconds are ignored. Explicit pause freezes stored remaining time; resume establishes new trusted deadlines. Disconnects and refreshes consume wall-clock time unless the candidate explicitly pauses.
- Autosave, pause, section transition, and submission serialize through a row lock on that candidate's timer. Late sectional saves are rejected, forced forward transitions cannot reopen completed sections, and a fully expired test finalizes only from the last database-saved responses. Concurrent retries return the same attempt and cannot issue rewards twice.
- Frontend keeps the existing local countdown/navigation, starts/resumes through the server session, and synchronizes from server timing on autosave and transitions. Local storage is used for answer recovery only; it cannot extend the timer.
- Repeated session starts originally serialized on an exclusive lock on the shared test row. Changed that read lock to `FOR SHARE`; ten-candidate startup p95 fell from 14.4s to 4.73s in the synthetic test. Query-level, transaction, pool checkout, JSON serialization, and total HTTP timings are now exposed in `Server-Timing` without logging SQL or sensitive data.
- Render `/health` is liveness-only so periodic checks do not wake Neon compute. `/ready` runs `SELECT 1` for explicit readiness verification. Render uses Node 22.16, Ohio, Free, `npm ci && npm run build`, `npm start`, `/health`, and generated secret environment variables. Runtime file uploads remain disabled; MCP remains disabled in production.
- `docs/render-deployment.md` now has a beginner-oriented GitHub, Render, password provisioning, smoke-test, monitoring, and rollback checklist.

### Final verification results

- `npm.cmd test`: 28 passed, 3 credential-gated tests skipped, 0 failed. (The separate Neon integration suite was run directly.)
- `npm.cmd run build`: passed.
- `npm.cmd run db:check`: pooled and direct URLs were recognized without printing values; `SELECT 1` succeeded through both. Read-only inspection showed the correct existing Neon branch and original table counts.
- `npm.cmd run db:migrate`: applied only 003; a later inspection confirmed the migration ledger and unchanged imported data counts. The SQLite import was not rerun.
- `RUN_POSTGRES_INTEGRATION=1 node --test tests/postgres.integration.test.js`: the rollback/idempotency test passed. The concurrent-read test had one transient `ENOTFOUND` DNS failure in this run; it had passed in earlier Neon verification. Do not treat this particular invocation as fully green.
- Final corrected `RUN_POSTGRES_LOAD=1 node --test tests/postgres-runtime-load.test.js` passed with 10 independent synthetic accounts, 121 requests, zero request failures, 10 finalized attempts, no duplicate submissions/rewards, and no cross-candidate reads. It covered refresh across server restart, repeated tab starts, ignored forged client time, saved answer recovery, pause/resume with a frozen timer, sectional expiry/rejection/forward transition, full-time expiry from the saved snapshot, ten concurrent candidate submissions, and a same-candidate double-click race at first submission. Peak RSS 117.6 MB; pool cap/peak 5. This was a roughly 68-second synthetic workload, not a sustained full-length or two-hour run.
- Measured local cross-region HTTP p50/p95: total 2.00s/7.22s; catalog 1.29s/1.37s; paper 1.12s/1.16s; paused saves 1.74s/3.41s; submissions/retries 3.43s/6.70s; session starts 3.45s/4.56s. Registration was 7.88s/8.64s under concurrent scrypt. Query p50/p95 for submissions was 2.31s/3.46s; JSON serialization p95 was 0.2ms. Pool wait p95 was 3.41s for submission under contention. Compared with the previous daily-quiz workload, catalog latency is similar, while timer/session work adds database round trips and the heavier two-section submission workload is slower (prior paused save p95 1.14s, submission/retry p95 3.85s). The prior workload was not timer-aware, so it is not a like-for-like comparison. Co-location on Render Ohio may reduce network RTT but is not yet measured. The suggested sub-second target is not met in this local test.

### Remaining before deployment

- Do not deploy until the owner has reviewed the complete diff and approved pushing the branch/deploying. No Render deployment occurred.
- Provision distinct private passwords (minimum 12 characters) for legacy candidates before cutover. Existing account hashes were preserved; the known shared demo password is rejected in production.
- Rotate the Neon credential before deployment if the previously shared connection string was exposed outside a private secret manager; update local and Render secret stores without placing it in GitHub.
- Confirm Render Ohio and Free plan before creating the service. After deployment, manually check `/health`, `/ready`, authentication isolation, test paper security, timer refresh/pause/resume, autosave and result submission.
- Warm request p95 and Neon latency have not been verified from Render Ohio, and no sustained two-hour mock session was run. Free-tier sleep/cold starts, quotas, transfer, and ephemeral storage remain constraints. Render Free is a hobby tier; it is not a production availability guarantee.

The repository already contained unrelated uncommitted edits in the frontend, server, package metadata, tests, and project files before this work; those files were preserved. Do not interpret them as part of this migration checkpoint.

## Rollback

The original `database.sqlite` and WAL/SHM files remain in place. To resume the existing local SQLite app, use `npm start` / `npm run dev` and do not run migration against that database. The saved snapshot is an additional recovery copy. If PostgreSQL receives production writes, returning to SQLite requires a separately reviewed reverse export/reconciliation; do not overwrite SQLite with the old snapshot or assume new PostgreSQL data is present there.
