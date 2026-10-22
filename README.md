# Oliveboard Mock Test App 🎯

An authentic, 1:1 reverse-engineered replica of **Oliveboard's live online mock test engine** and performance analytics platform. Built with vanilla HTML/CSS/JavaScript on the frontend and an Express + SQLite backend.

---

## ✨ Key Features

### 1. Authentic Oliveboard Live Test Player
- **1:1 Reverse-Engineered UI**: Exact font stacks (`verdana`, `helvetica`), color schemes (`#3476BB`), button borders, and layouts matching Oliveboard live tests.
- **4-Column Question Palette**: Signature 4-column sprite grid (`#question-main-pallette`) with real-time status transitions:
  - ⬜ **Not Visited** (`stic-notvisited` - Gray rounded rectangle)
  - 🟧 **Not Answered** (`stic-notanswered` - Orange badge)
  - 🟩 **Answered** (`stic-answered` - Green pentagon)
  - 🟪 **Marked for Review** (`stic-marked` - Purple circle)
  - 🟣 **Answered & Marked** (`stic-answered-marked` - Purple with green tick, evaluated for marks)
- **Sectional Timing & Section Locking**: Per-section countdown timers with automatic section transition and lock enforcement.
- **Two-Sided Duplex Split Screen**: Reading comprehension passages, caselets, data tables, and directions on the left pane (50%), question statements and radio choices on the right pane (50%) with independent scrollbars.
- **Action Buttons**: `Save & Next`, `Mark for Review & Next`, `Clear Response`, `< Previous`, and collapsible drawer slide arrow (`▶` / `◀`).
- **Live Legend Counter**: Real-time counts of Answered, Not Answered, Marked, Not Visited, and Answered Marked.
- **Exam Modals**: Full-paper question overview modal (`#b1`), Exam Instructions modal (`#b2`), Candidate Profile verification modal (`#b3`), and Section Submission / Locking confirmation dialog (`#b4`).
- **Exam Security & Fullscreen**: Custom fullscreen toggle (`requestFullscreen`) and context-menu prevention.

### 2. Post-Exam Analytics & Scorecard
- **Executive Performance Card**: Raw Score, Maximum Marks, Accuracy %, Percentile, and simulated All India Rank (AIR).
- **Cutoff Analysis**: Overall and section-wise cutoff benchmarks with dynamic `CLEARED` / `MISSED` badges.
- **Sectional Performance Table**: Section Name, Total Qs, Attempted, Correct (+1.00), Wrong (-0.25), Net Score, and Time Spent.
- **Topper vs You Benchmarking**: Comparative radar / bar analytics comparing your accuracy and time allocation against the exam topper and average test-taker.
- **Topic Mastery Grid**: Topic-wise drill-downs (English, Quantitative Aptitude, Logical Reasoning, Professional Knowledge).

### 3. Comprehensive Solutions Console
- **Duplex Solutions Interface**: Passage on left, question and annotated options on right.
- **Color-Coded Options**: Green highlighting for the correct answer, red highlight for incorrect candidate selections.
- **Official Solution Box**: Detailed step-by-step explanations, formulas, and diagrams.
- **Filter Pills**: Filter questions by *All*, *Correct*, *Incorrect*, *Skipped*, and *Marked*.
- **Re-attempt Mode**: Retake individual missed questions directly inside the solution console.

### 4. Multi-User Candidate Isolation & SQLite Engine
- **Persistent SQLite Database**: ACID-compliant database with WAL journal mode (`node:sqlite`).
- **Candidate Profile Switcher**: Switch between demo candidates (Rahul Sharma, Priya Verma, Vikram Malhotra) or create a new candidate.
- **Isolated Attempts**: Each candidate maintains their own separate attempt history, saved answers, streaks, and reward coins.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18.0.0 or higher recommended, Node.js 22+ includes native `node:sqlite`)

### Installation & Launch

1. **Clone the repository**:
   ```bash
   git clone https://github.com/PiyushSinghjnp/Mock_test_App.git
   cd Mock_test_App
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local server**:
   ```bash
   node server.js
   ```

4. **Open in browser**:
   Navigate to `http://localhost:3000` to start taking tests.

---

## 📁 Repository Structure

```
oliveboard-clone/
├── css/
│   ├── app-shell.css             # Dashboard, navbar, exam cards, streak banners
│   ├── test-engine.css           # Live test console, question palette, duplex split panes
│   └── variables.css             # Design tokens, colors, breakpoints
├── js/
│   ├── app.js                    # SPA router, test catalog, user profile switcher
│   ├── test-engine.js            # Live exam engine, timers, palette grid, section locking
│   ├── solution-engine.js        # Detailed solution viewer, option annotator, re-attempt
│   └── scorecard-engine.js       # Scorecard analytics, sectional breakdown, topper compare
├── IBPS SO IT mains questions/  # Authentic questions, comprehension passages & solutions
├── images/                       # Oliveboard UI assets, sprites, candidate avatars
├── oliveimg/                     # Scraped question diagrams, formulas, and charts
├── scraped_specs/                # 19 detailed reverse-engineering JSON specifications
├── server.js                     # Express REST API + persistent SQLite engine
├── database.sqlite               # Pre-seeded SQLite database with full test papers
├── index.html                    # Single Page Application entry point
├── package.json                  # Node.js project manifest & scripts
└── README.md                     # Project documentation
```

---

## 📝 License
MIT License. Built for educational and exam preparation purposes.
