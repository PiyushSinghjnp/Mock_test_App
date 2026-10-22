# Backend Question Paper Auto-Ingestion Directory (`/papers`)

Drop any exam question paper `.json` file into this `/papers` directory.

## How It Works (100% Backend-Only)
1. **Automatic Detection on Boot & Live File Watcher**:
   - `server.js` automatically watches `/papers` (and `/IBPS SO IT mains questions`).
   - Whenever a `.json` file is placed in `/papers`, the backend automatically parses it and passes it through `/js/exam-patterns-2026.js` and `/data/official_exam_notifications.json`.
2. **Automatic 2026 Official Sectional Timing & Marking Scheme Application**:
   - The backend matches the paper's `examId` / `title` / filename against the 2026 Official Exam Registry (`sbi-po`, `sbi-clerk`, `ibps-so`, `ibps-po`, `ibps-clerk`, `ibps-rrb-po`, `rbi-grade-b`, `lic-aao`, `ssc-cgl`, `rrb-ntpc`) and stage (`prelims` / `mains`).
   - Official 2026 sectional timings (`durationMinutes` & `durationSeconds`), section lock rules (`isSectionalLocked`), and per-question marking schemes (`marksForCorrect` & `negativeMarks`) are automatically applied and persisted into `database.sqlite`.
3. **CLI Command**:
   - You can also run `node scripts/apply_official_timings.js` at any time to re-sync all database tests and ingest any new `.json` papers in `/papers`.
