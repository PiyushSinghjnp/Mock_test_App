# Render Free deployment

## Render service

Create one **Web Service** from the existing GitHub repository and select the Free instance. The checked-in `render.yaml` sets:

- Region: Ohio, to keep the service near the existing Neon `us-east-2` database. Render does not allow changing a service's region after creation, so confirm Ohio during setup.
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/health`
- Node runtime: the repository's `.node-version` (Node 22 LTS)

Set these secrets in Render's Environment page:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (`-pooler` hostname) |
| `SESSION_SECRET` | Random secret with at least 32 characters |
| `OLIVEBOARD_ADMIN_TOKEN` | A different random secret with at least 32 characters |
| `NODE_ENV` | `production` (set by `render.yaml`) |

Do not set `DATABASE_DIRECT_URL` on the web service. It is reserved for explicit migration/administration commands. Do not put any database string in Vite variables or frontend files. Render's filesystem is ephemeral; runtime image uploads therefore return a clear disabled response. `/health` is liveness-only and does not query Neon, so periodic health probes do not keep Neon compute awake; `/ready` runs an explicit `SELECT 1`. The app does not use a keep-alive service and accepts Free service sleep/cold starts.

## Neon

Use the existing Neon project and branch. The schema ledger includes migrations `001_initial_schema.sql`, `002_auth_and_attempt_guards.sql`, and `003_authoritative_exam_timers.sql`. Do not recreate the database or rerun the SQLite import. In Neon, open **Connect**, select the existing branch/database, and copy both connection strings:

1. Choose the pooled connection option for `DATABASE_URL`; its hostname includes `-pooler`.
2. Choose the direct connection option only for `DATABASE_DIRECT_URL` when a manual migration command requires it.
3. Keep SSL enabled. The app runtime pool is capped at five connections.
4. The existing schema ledger shows migrations `001_initial_schema.sql`, `002_auth_and_attempt_guards.sql`, and `003_authoritative_exam_timers.sql`; do not recreate the database or rerun the SQLite import.

The current `.env` is for local use only and must never be uploaded to GitHub or placed in Render build assets. If a URL has already been shared outside a private secret store, rotate it in Neon and update the local/Render secret values before deployment.

## Before cutover

1. Before announcing cutover, provision private 12-character-minimum passwords for migrated candidates through `PUT https://<render-host>/api/admin/users/<candidate-id>/password`, with `x-admin-token` and a JSON body containing `password`. Keep the token out of browser storage and share each password privately. This revokes that candidate's previous sessions. Do not reuse the shared demo password; production rejects it.
2. Verify required environment names are present in Render. Keep the direct URL out of runtime configuration.
3. Trigger deploy from the Render dashboard only after reviewing this branch. Confirm `/health`, login, test paper loading, pause/resume, submission, and result retrieval.
4. Watch Render memory and outbound transfer, and Neon compute/storage/transfer usage. The warning thresholds in the migration progress document are internal early-warning targets, not provider guarantees.
5. Do not configure automatic paid plan upgrades or recurring pings.

No deployment has been performed by this migration work.

## Beginner deployment checklist

### 1. Prepare GitHub

1. Review `git status` and the complete diff. Keep unrelated local edits out of the deployment branch.
2. Confirm `.env`, SQLite files, `backups/`, migration reports, passwords, and generated secrets are not staged. Do not force-add ignored files.
3. Run `npm test` and `npm run build` locally. Commit and push the reviewed app files to the existing GitHub repository only after approving that external change.

### 2. Create the Render service

1. In Render, choose **New → Blueprint** to use `render.yaml`, or choose **New → Web Service** and connect the existing GitHub repository.
2. Select the branch containing the reviewed changes. Choose **Ohio** before creation; region cannot be changed later.
3. Select the **Free** instance. Confirm `npm ci && npm run build`, `npm start`, and health check `/health` (the Blueprint fills these in).
4. Keep auto-deploy off until the first review if desired. Do not configure paid upgrades, cron jobs, or keep-alive pings.

### 3. Set environment variables

In the Render service's **Environment** page, set `NODE_ENV=production` and `DATABASE_URL` to the existing Neon **pooled** connection string. `render.yaml` generates `SESSION_SECRET` and `OLIVEBOARD_ADMIN_TOKEN`; verify both are present and private. Do not add `DATABASE_DIRECT_URL` to the web service. Save changes and allow Render to build.

### 4. Provision legacy candidate passwords

Before candidates use the service, use the Neon SQL Editor on the existing branch to privately retrieve candidate IDs and usernames (`SELECT id, username FROM users ORDER BY username;`). For each candidate, generate a distinct password of at least 12 characters and send it privately. From a secure administrative terminal, send `PUT /api/admin/users/<id>/password` with `x-admin-token` and JSON `{ "password": "<new-password>" }`. Never put the admin token or candidate passwords in browser storage, source control, chat, or deployment logs. This revokes that candidate's existing sessions.

### 5. Smoke-test the deployment

1. Open `https://<render-service>.onrender.com/health`; expect `{"status":"ok"}` after cold start.
2. Sign in as two different provisioned candidates in separate private browser windows.
3. Verify catalog and paper loading; confirm answers are hidden before submission.
4. Start a mock test, answer and bookmark questions, refresh once, and verify saved answers and the server countdown recover.
5. Pause/resume, advance sections, submit, and open results. Verify one candidate cannot access the other's result.
6. Check Render logs for runtime errors and confirm MCP endpoints are disabled in production.

### 6. Monitor free-tier usage

Check Render memory, outbound transfer, restarts, and cold starts, plus Neon compute-hours, storage, and public transfer. Use the internal early-warning targets in `docs/deployment-migration-progress.md`; they are not provider limits. Free instances sleep and filesystems are ephemeral; the first request may be slow. Do not set automatic paid upgrades.

### 7. Roll back safely

If no production attempts were submitted, use Render's rollback to the previous deployment and continue the local SQLite app. Keep the SQLite database and backup untouched. If PostgreSQL accepted candidate activity, do not copy the old SQLite snapshot over it; first export and reconcile the newer PostgreSQL records under a separately reviewed recovery procedure.

## Rollback

If deployment fails before candidates submit production attempts, disable/rollback the Render deploy and continue using the local SQLite app with `npm start` or `npm run dev`. The original `database.sqlite`, its WAL/SHM files, and the separately created backup remain in place.

If PostgreSQL has accepted new production writes, do not copy the old SQLite backup over the local database. It cannot contain those writes. Export and reconcile the newer PostgreSQL data in a separately reviewed recovery operation before returning candidates to SQLite.
