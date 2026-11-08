# Mock Test App

An independent web application for practicing competitive examinations in a computer-based test format. It brings together timed mock tests, question navigation, saved progress, results, and practice tools in one candidate experience.

The project is not officially affiliated with, endorsed by, or operated by any examination board or commercial exam-preparation provider.

## Features

- **Timed mock tests:** Work through questions with section navigation, question status indicators, bookmarks, and section locking where configured by a test.
- **Authoritative timers:** The server stores test and section deadlines. Refreshing or disconnecting does not grant extra time; where pausing is enabled, a server-recorded pause freezes the remaining time.
- **Autosave and recovery:** Answer changes are saved periodically and at key transitions. A paused attempt can be recovered after a refresh, and a local browser fallback helps recover unsent changes after a temporary network problem.
- **Results and review:** Completed attempts include server-calculated scores, accuracy, question counts, and section breakdowns. Review screens can show correct answers and explanations after submission.
- **Candidate accounts and history:** Authenticated candidates have separate profiles, saved attempts, paused tests, and progress data.
- **Analytics and practice:** Candidate history and performance summaries support progress review. Quiz practice tracks candidate quiz history, streaks, and reward coins. Question bookmarks can be organized for later review.
- **Administration:** The application includes protected administrative operations for managing candidate access and test content.

Available tests, sections, question content, marking rules, and explanations depend on the records configured in the database.

## Technology

- Node.js 22.12.x and Express 5
- HTML, CSS, and browser JavaScript
- Vite for frontend development and production builds
- PostgreSQL through the `pg` driver; production configuration is prepared for Neon pooled connections
- Render Blueprint configuration for a Free web service

server.js, npm start, and npm run dev use the PostgreSQL backend in every environment and require DATABASE_URL. The direct PostgreSQL URL is reserved for explicit database administration commands; it is not needed by the Render web service. Application startup does not import data or run schema migrations.

## Requirements

- Node.js `>=22.12 <23` (see `package.json`)
- npm
- For PostgreSQL-backed operation: a PostgreSQL database and its pooled connection URL

## Local setup

```bash
git clone https://github.com/PiyushSinghjnp/Mock_test_App.git
cd Mock_test_App
npm ci
```

### PostgreSQL development

Copy .env.example to .env, set DATABASE_URL to the pooled PostgreSQL URL, and configure unique session and administrator secrets. Keep .env private and out of source control.

Run npm run dev to start Vite with the PostgreSQL backend. Open the Vite address printed in the terminal (normally http://localhost:3000); Vite proxies API requests to PostgreSQL. npm start starts the backend without Vite and also requires DATABASE_URL.

The server listens on PORT when provided, otherwise on its default backend port. Database migrations and legacy import utilities are explicit maintenance operations; application startup does not modify the database.

## npm commands

| Command | Purpose |
| --- | --- |
| npm run dev | Run Vite and the PostgreSQL-backed server for development |
| npm run dev | Run Vite and the PostgreSQL-backed server for development |
| npm run dev | Run Vite and the PostgreSQL-backed server for development |
| `npm start` | Start the backend; production mode uses PostgreSQL |
| `npm test` | Run automated tests and JavaScript syntax checks |
| `npm run build` | Build frontend assets and check server scripts |
| `npm run db:check` | Check configured pooled and direct database connectivity without printing URLs |
| `npm run db:inspect -- --summary` | Read-only summary of the configured PostgreSQL schema and record counts |
| `npm run test:postgres` | Run PostgreSQL integration tests when explicitly enabled with `RUN_POSTGRES_INTEGRATION=1` |
| `npm run test:load` | Run the PostgreSQL runtime load test when explicitly enabled with `RUN_POSTGRES_LOAD=1` |

Legacy SQLite import utilities remain only for explicit archival migration work. The application itself uses PostgreSQL exclusively; no SQLite database or fallback is part of startup.

## Render deployment configuration

The included `render.yaml` describes one Free Node.js web service in Ohio with:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health`
- `NODE_ENV=production`
- A pooled `DATABASE_URL` supplied as a secret and generated session/admin secrets

Before deploying, review [`docs/render-deployment.md`](docs/render-deployment.md). The Render service should use the existing PostgreSQL database and branch. Do not add the direct database URL to the web service. Render Free has cold starts and an ephemeral filesystem; runtime uploads are disabled when durable storage is not configured.

## License

The repository declares the ISC license in `package.json`. Review the repository's licensing and included asset/content terms before reuse or redistribution.
