# Oliveboard 1:1 Live Mock Test Parity & 2026 Exam Pattern Auto-Application Engine

Deliver 100% functional parity with Oliveboard's live exam console and post-test solution viewer, paired with a comprehensive 2026 Official Exam Marking Scheme & Sectional Timing Registry that automatically configures sectional timers, section locks, and marking rules whenever a question paper JSON is uploaded.

### User Review & Critical Decisions

> [!IMPORTANT]
> All core interaction rules from your feedback have been locked into this plan, along with the new 2026 Exam Pattern Registry & Question Paper JSON Upload pipeline. Review and click **Proceed** to begin implementation.

- **Confirmed Decision 1 — Radio Selection & Deselection (`clearme` Parity)**: Selecting a radio option checks it in the DOM as an uncommitted choice without turning the palette icon green until `Save & Next` or `Mark for Review & Next` is clicked. Clicking an already-selected radio option again deselects it and immediately reverts any saved status back to `Not Answered` (`stic-notanswered`).
- **Confirmed Decision 2 — End-of-Section Navigation**: Clicking `Save & Next` or `Mark for Review & Next` on the last question of a section commits the answer and automatically opens the Section Advance / Submit confirmation screen.
- **Confirmed Decision 3 — Locked Section Tabs & Timers**: During sectional-timed banking/insurance exams, other section tabs in the top bar are locked (`cursor: default`) while retaining the hover status summary tooltip (`#hover-con`). Advancing to the next section occurs strictly via `Next Section`, end-of-section save, or section timer expiry (`00:00`).
- **Confirmed Decision 4 — Partial Right-Sidebar Collapse**: Collapsing the right sidebar hides only the lower palette and legend area (`#right-low-half-outer`) while expanding the question pane to full width (`122%`), keeping the top-right Candidate Photo, `Time Left` countdown timer, and `Pause Test` button visible at all times.
- **Confirmed Decision 5 — 2026 Exam Marking & Sectional Timing Auto-Application on JSON Upload**: A dedicated 2026 Exam Pattern Registry will store official section-by-section durations, question counts, lock rules, and positive/negative marking schemes for all major 2026 exams, and automatically apply them whenever you upload a question paper JSON.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. Replicates every interactive detail of Oliveboard's live exam player—including uncommitted vs. committed radio state, click-to-deselect, `Clear Response`, `Save & Next`, `Mark for Review & Next`, 4-column auto-scrolling sprite palette, partial sidebar collapse, in-pane `Question Paper` / `Instructions` / `Profile` views, `Pause Test`, and `Next Section` / `Submit` summaries.
  2. Maintains a comprehensive **2026 Official Exam Pattern Registry** covering Banking (SBI PO, SBI Clerk, IBPS PO, IBPS Clerk, IBPS SO IT/Specialist, IBPS RRB PO & Clerk), Regulatory & Insurance (RBI Grade B, RBI Assistant, NABARD Grade A, SEBI Grade A, LIC AAO, NIACL AO), and SSC & Railways (SSC CGL Tier-1 & Tier-2, SSC CHSL, SSC MTS, RRB NTPC CBT-1 & CBT-2).
  3. Provides a **Question Paper JSON Uploader** on the dashboard that ingests any uploaded mock test JSON, matches or lets you pick the 2026 exam & stage, and automatically stamps every section and question with the official 2026 sectional timer, section-locking rule, and positive/negative marking scheme.
- **Target Audience / Persona**: Competitive exam aspirants practicing full-length and sectional mocks under authentic TCS iON / Oliveboard exam conditions.
- **Key Value**: Eliminates manual timing/marking configuration when importing scraped or custom JSON question papers and guarantees realistic exam console behavior from the first question to post-test analytics.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Uploading a Question Paper JSON**: Click **Upload JSON Paper** in the header/tests view -> drop or select a `.json` question paper file -> auto-detect (or choose) the 2026 Exam & Stage (e.g., *IBPS SO IT Mains 2026*, *SBI PO Prelims 2026*, *SSC CGL Tier-2 2026*) -> preview the auto-applied sectional timings and marking scheme (`+marks` / `-negative`) -> save to SQLite and launch immediately.
  2. **Pre-Exam Instructions & Section Matrix**: View the dynamically populated `#in-tab` table showing each section's exact 2026 question count, maximum marks, sectional minutes, and language medium -> accept declaration -> click **Start Test**.
  3. **Live Test Execution**:
     - Select/deselect options with authentic `clearme` behavior.
     - Use `Save & Next`, `Mark for Review & Next`, and `Clear Response` with real-time Legend and 4-column Sprite Palette updates.
     - Collapse the lower palette drawer while keeping the top-right Timer & Pause controls pinned.
     - Inspect in-pane `Question Paper`, `Instructions`, and `Profile` views and return via `Back` or any palette click.
     - Advance across sections via the `Next Section` confirmation table or automatic section timer expiration.
  4. **Post-Test Scorecard & Solution Console**: Review section-wise cutoffs, accuracy, and Topper comparisons, then launch the 2-sided Oliveboard Solution Window with normalized answer grading, status filters (`All`, `Correct`, `Incorrect`, `Unattempted`), and interactive **Re-attempt Mode**.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Authentic utilitarian Oliveboard / TCS iON examination console paired with a clean Oliveboard dashboard shell.
  - *Color Palette & Mood*: Classic Oliveboard console header blue (`#3476BB`), pale steel-blue palette surface (`#E4EDF7`), secondary button fill (`#C7DCF0` with `#A9D0F5` border), active utility highlight (`#2F72B7`), and official sprite status indicators (Green Answered, Red/Orange Not Answered, Purple Marked, Grey Not Visited).
  - *Typography & Hierarchy*: `Verdana, Arial, Helvetica, sans-serif` at `12px–14px` inside the live exam player for pixel-accurate line heights and table alignment; `Inter` on the main dashboard and analytics views.
- **Interactive Feedback & Motion**:
  - Instant radio check/uncheck feedback, smooth palette `scrollIntoView` tracking, mousewheel warning banner (`.scrolltooltip`) triggered only on first scroll wheel attempt, and dimmed background opacity (`0.3` / `0.1`) during `Pause Test`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Uncommitted (`draftSelectedIndex`) vs. Committed (`selectedIndex`) Radio State**
  - *Chosen Approach*: Track both the current DOM radio selection and the committed saved answer per question.
  - *Why*: In Oliveboard's live player, clicking a radio button checks it visually, but jumping to another question via the palette without clicking `Save & Next` does not count the question as `Answered`. Keeping both states reproduces exact exam evaluation rules while preserving the radio check if the candidate returns to that question.
- **Decision 2: Automatic 2026 Exam Pattern Matcher on JSON Upload**
  - *Chosen Approach*: Centralize all 2026 exam schemes in a structured registry and run an automatic pattern-application pipeline whenever a JSON file is uploaded or seeded.
  - *Why*: Uploaded question paper JSONs often contain raw questions (`questions: [...]`) without per-section durations or official negative marking. Auto-matching section names and exam stages guarantees accurate sectional timers (e.g., `20m/20m/20m` for SBI/IBPS Prelims, `25m/35m/25m/35m` for IBPS SO IT Mains, `60m composite` for SSC CGL Tier-1) without manual editing.
- **Decision 3: Multi-Format Answer Key Normalization**
  - *Chosen Approach*: Normalize `correctIndex` across `0`-based numbers, `1`-based numbers, and option letters (`A`–`E` / `a`–`e`) during both JSON ingestion and runtime evaluation.
  - *Why*: Prevents misgraded questions in the Scorecard and Solution Window regardless of how the uploaded JSON encodes the correct answer.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│                   2026 Official Exam Pattern Registry                      │
│  • Banking: SBI PO/Clerk, IBPS PO/Clerk/SO, IBPS RRB PO/Clerk (Pre/Mains)  │
│  • Regulatory & Insurance: RBI Gr B/Asst, NABARD, SEBI, LIC AAO, NIACL AO  │
│  • SSC & Railways: SSC CGL/CHSL/MTS (Tier 1/2), RRB NTPC/ALP (CBT 1/2)     │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ Auto-Matches Exam, Stage & Sections
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             JSON Question Paper Upload & Normalization Pipeline            │
│  • Parses raw questions[] or sections[] JSON                               │
│  • Stamps 2026 section durationSeconds, lock rules, +marks & -negative     │
│  • Normalizes options, passages, images, and 0-indexed correctIndex        │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ Persists to SQLite (WAL Mode)
                                      ▼
┌─────────────────────────────────────┴──────────────────────────────────────┐
│                         SQLite Database & REST API                         │
│     [tests]            [test_attempts]           [paused_attempts]         │
└────────┬──────────────────────┬──────────────────────────┬─────────────────┘
         │                      │                          │
         ▼                      ▼                          ▼
┌────────────────────┐ ┌────────────────────────┐ ┌──────────────────────────┐
│ 1:1 Live Test      │ │ Post-Test Scorecard    │ │ 1:1 Solution & Review    │
│ Console Engine     │ │ & AI Analytics Modal   │ │ Console Engine           │
│ • clearme() radio  │ │ • Sectional cutoffs    │ │ • 2-Sided & 1-Pane views │
│ • Save / Mark /    │ │ • Topic mastery grid   │ │ • All/Correct/Wrong/     │
│   Clear Response   │ │ • Topper vs You bars   │ │   Unattempted filters    │
│ • End-of-section   │ └────────────────────────┘ │ • Interactive Re-attempt │
│   advance prompt   │                            └──────────────────────────┘
│ • Partial sidebar  │
│   collapse         │
└────────────────────┘
```

- **Data Model & State**:
  - **2026 Exam Pattern Registry**: Keyed by exam slug (`sbi-po`, `sbi-clerk`, `ibps-po`, `ibps-clerk`, `ibps-so`, `ibps-rrb-po`, `ibps-rrb-clerk`, `rbi-grade-b`, `rbi-assistant`, `nabard-grade-a`, `sebi-grade-a`, `lic-aao`, `niacl-ao`, `ssc-cgl`, `ssc-chsl`, `ssc-mts`, `rrb-ntpc`, `rrb-alp`) and stage (`prelims`, `mains`, `tier-1`, `tier-2`, `phase-1`, `phase-2`, `cbt-1`, `cbt-2`). Each stage defines `total_questions`, `total_marks`, `total_duration_minutes`, `has_sectional_timing`, `is_sectional_locked`, `marking_scheme` (`positive_mark`, `negative_mark`, `penalty_ratio`), and ordered `sections[]` with aliases for automatic section matching.
  - **Per-Question Live State (`userResponses[qId]`)**: Tracks `selectedIndex` (committed), `draftSelectedIndex` (DOM radio state), `status` (`stic-notvisited` | `stic-notanswered` | `stic-answered` | `stic-marked` | `stic-answered-marked`), and `timeSpentSeconds`.
- **Interactive Component & State Mapping**:
  - **JSON Upload Modal & API (`POST /api/tests/upload-json` & `GET /api/exam-patterns-2026`)**: Accepts an uploaded JSON payload plus optional `examId` and `stage`, matches each section against the 2026 registry, applies official sectional timings and marking schemes, stores the test in SQLite, and refreshes the test cards grid.
  - **Radio & Action Handlers (`clearme`, `displayQuestionsSave`, `displayQuestionsMark`, `clearOption`)**: Mutate `draftSelectedIndex` and `selectedIndex`, update `#palette-numbers-grid` sprite classes and `#legend` counters, scroll the active palette button into view, and trigger `finalSubmit(true)` when advancing past the last question of a section.
  - **Partial Sidebar Toggle (`.darr-rightslide` / `.darr-leftslide`)**: Hides/shows `#right-low-half-outer` while toggling `#question-outer-pane` width between `122%` and `95%`, keeping `#cand-time-outer` pinned at top-right.
