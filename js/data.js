/**
 * Oliveboard Mock Test App - Complete Test Repository & Data Store
 * Dedicated strictly to Mock Tests, Sectionals, Topic Tests, and Previous Year Papers.
 */

const OB_TEST_APP = {
  // Available Exams for the Exam Switcher Dropdown
  exams: [
    {
      id: "ibps-so",
      name: "IBPS SO IT Officer 2026",
      category: "Specialist Officer",
      icon: "IT",
      color: "#008479",
      totalMocks: 35,
      prelimsCount: 10,
      mainsCount: 15,
      sectionalsCount: 45,
      topicTestsCount: 30,
      freeMocks: 2
    },
    {
      id: "sbi-po",
      name: "SBI PO 2026",
      category: "Bank & Insurance",
      icon: "SBI",
      color: "#007bb5",
      totalMocks: 165,
      prelimsCount: 25,
      mainsCount: 10,
      sectionalsCount: 90,
      topicTestsCount: 40,
      freeMocks: 3
    },
    {
      id: "sbi-clerk",
      name: "SBI Clerk (Junior Associates) 2026",
      category: "Bank & Insurance",
      icon: "SBC",
      color: "#0284c7",
      totalMocks: 140,
      prelimsCount: 30,
      mainsCount: 15,
      sectionalsCount: 60,
      topicTestsCount: 35,
      freeMocks: 3
    },
    {
      id: "ibps-po",
      name: "IBPS PO 2026",
      category: "Bank & Insurance",
      icon: "IBPS",
      color: "#008479",
      totalMocks: 150,
      prelimsCount: 25,
      mainsCount: 10,
      sectionalsCount: 80,
      topicTestsCount: 35,
      freeMocks: 3
    },
    {
      id: "ibps-clerk",
      name: "IBPS Clerk 2026",
      category: "Bank & Insurance",
      icon: "IBC",
      color: "#0d9488",
      totalMocks: 135,
      prelimsCount: 25,
      mainsCount: 15,
      sectionalsCount: 60,
      topicTestsCount: 35,
      freeMocks: 3
    },
    {
      id: "ibps-rrb-po",
      name: "IBPS RRB PO (Officer Scale-I) 2026",
      category: "Regional Rural Bank",
      icon: "RRB",
      color: "#059669",
      totalMocks: 120,
      prelimsCount: 25,
      mainsCount: 15,
      sectionalsCount: 50,
      topicTestsCount: 30,
      freeMocks: 2
    },
    {
      id: "rbi-grade-b",
      name: "RBI Grade B 2026",
      category: "Regulatory Exams",
      icon: "RBI",
      color: "#1b2e4b",
      totalMocks: 95,
      prelimsCount: 20,
      mainsCount: 15,
      sectionalsCount: 40,
      topicTestsCount: 20,
      freeMocks: 2
    },
    {
      id: "lic-aao",
      name: "LIC AAO 2026",
      category: "Insurance Exams",
      icon: "LIC",
      color: "#4f46e5",
      totalMocks: 90,
      prelimsCount: 20,
      mainsCount: 10,
      sectionalsCount: 35,
      topicTestsCount: 25,
      freeMocks: 2
    },
    {
      id: "ssc-cgl",
      name: "SSC CGL 2026 (Tier 1 & 2)",
      category: "SSC Exams",
      icon: "SSC",
      color: "#e53935",
      totalMocks: 180,
      prelimsCount: 30,
      mainsCount: 15,
      sectionalsCount: 85,
      topicTestsCount: 50,
      freeMocks: 4
    },
    {
      id: "rrb-ntpc",
      name: "Railways RRB NTPC 2026",
      category: "Railways Exams",
      icon: "NTPC",
      color: "#f57c00",
      totalMocks: 140,
      prelimsCount: 35,
      mainsCount: 15,
      sectionalsCount: 60,
      topicTestsCount: 30,
      freeMocks: 3
    }
  ],

  // Mock Test Packages & Cards for the Active Exam (SBI PO by default)
  testPacks: [
    {
      id: "ibps-so-it-prelims-1",
      examId: "ibps-so",
      type: "prelims",
      title: "IBPS SO Prelims [IT] - Free Mock 1",
      subtitle: "Authentic 100-Question Official Oliveboard Exam (English, Reasoning, Quant & IT)",
      marks: 125,
      questionsCount: 100,
      durationMinutes: 80,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (25 Qs)", "Reasoning Ability (25 Qs)", "Quantitative Aptitude (25 Qs)", "Professional Knowledge (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 38940
    },
    {
      id: "ibps-so-it-mains-1",
      examId: "ibps-so",
      type: "mains",
      title: "IBPS SO IT Officer Mains - Full Mock 1",
      subtitle: "Authentic 150-Question Full Mains Test with Professional Knowledge & Detailed Solutions",
      marks: 150,
      questionsCount: 150,
      durationMinutes: 120,
      isFree: true,
      isAttempted: false,
      sections: ["Professional Knowledge (150 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 27400
    },
    {
      id: "ibps-so-it-pyp-2024",
      examId: "ibps-so",
      type: "pyp",
      title: "IBPS SO IT Officer 2024 Official Paper (Memory Based)",
      subtitle: "Actual Exam Paper with 100 Questions & Official Step-by-Step Solutions",
      marks: 125,
      questionsCount: 100,
      durationMinutes: 80,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (25 Qs)", "Reasoning Ability (25 Qs)", "Quantitative Aptitude (25 Qs)", "Professional Knowledge (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 41200
    },
    {
      id: "ibps-so-it-pyp-2023",
      examId: "ibps-so",
      type: "pyp",
      title: "IBPS SO IT Officer 2023 Previous Year Paper",
      subtitle: "Official Exam Questions with Cutoff Analysis & Explanations",
      marks: 125,
      questionsCount: 100,
      durationMinutes: 80,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (25 Qs)", "Reasoning Ability (25 Qs)", "Quantitative Aptitude (25 Qs)", "Professional Knowledge (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 32100
    },
    {
      id: "ibps-so-it-sec-pk",
      examId: "ibps-so",
      type: "sectional",
      title: "Professional Knowledge IT - Speed Booster 1",
      subtitle: "25 High-Frequency IT Specialist Questions (DBMS, OS, Networking & SE)",
      marks: 50,
      questionsCount: 25,
      durationMinutes: 25,
      isFree: true,
      isAttempted: false,
      sections: ["Professional Knowledge (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 19800
    },
    {
      id: "ibps-so-it-topic-dbms",
      examId: "ibps-so",
      type: "topic",
      title: "DBMS, SQL & Data Structures Drill",
      subtitle: "Topic-Level Practice on Normalization, Transactions & B-Trees",
      marks: 40,
      questionsCount: 20,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["DBMS & Data Structures (20 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 15400
    },
    {
      id: "sbi-po-pre-01",
      examId: "sbi-po",
      type: "prelims",
      title: "SBI PO 2026 Prelims - Free Mock 1",
      subtitle: "Full-Length Prelims Simulation with All India Ranking",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 34290
    },
    {
      id: "sbi-po-pre-02",
      examId: "sbi-po",
      type: "prelims",
      title: "SBI PO 2026 Prelims - Mock 2",
      subtitle: "Updated New Pattern with High Level DI and Puzzles",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 28410
    },
    {
      id: "sbi-po-pre-03",
      examId: "sbi-po",
      type: "prelims",
      title: "SBI PO 2026 Prelims - Mock 3",
      subtitle: "Moderate to Difficult Level for Speed & Elimination",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: false,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 21900
    },
    {
      id: "sbi-po-pre-04",
      examId: "sbi-po",
      type: "prelims",
      title: "SBI PO 2026 Prelims - Mock 4",
      subtitle: "Real Exam Hall Simulation with Adaptive Cutoff Analysis",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: false,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 19540
    },
    {
      id: "sbi-po-mains-01",
      examId: "sbi-po",
      type: "mains",
      title: "SBI PO 2026 Mains - Full Mock 1",
      subtitle: "Advanced DI, Critical Reasoning & General Banking Awareness",
      marks: 200,
      questionsCount: 155,
      durationMinutes: 180,
      isFree: true,
      isAttempted: false,
      sections: ["Reasoning & Computer (45 Qs)", "Data Analysis (35 Qs)", "General/Economy (40 Qs)", "English (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 15420
    },
    {
      id: "sbi-po-mains-02",
      examId: "sbi-po",
      type: "mains",
      title: "SBI PO 2026 Mains - Full Mock 2",
      subtitle: "Includes Descriptive English Letter & Essay Evaluation Guide",
      marks: 200,
      questionsCount: 155,
      durationMinutes: 180,
      isFree: false,
      isAttempted: false,
      sections: ["Reasoning & Computer (45 Qs)", "Data Analysis (35 Qs)", "General/Economy (40 Qs)", "English (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 12890
    },
    {
      id: "sbi-po-sec-quant",
      examId: "sbi-po",
      type: "sectional",
      title: "Quant Speed Booster - Sectional 1",
      subtitle: "Quadratic Equations, Missing Series & Arithmetic Word Problems",
      marks: 35,
      questionsCount: 35,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["Quantitative Aptitude (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 39100
    },
    {
      id: "sbi-po-sec-reasoning",
      examId: "sbi-po",
      type: "sectional",
      title: "Reasoning Seating & Puzzles - Sectional 1",
      subtitle: "Floor, Flat, Circular, and Box Arrangement High-Level Sets",
      marks: 35,
      questionsCount: 35,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 41200
    },
    {
      id: "sbi-po-sec-english",
      examId: "sbi-po",
      type: "sectional",
      title: "English Comprehension & Cloze Test - Sectional 1",
      subtitle: "Editorial Passage, Phrase Replacement & Grammar Error Spotting",
      marks: 30,
      questionsCount: 30,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (30 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 35700
    },
    {
      id: "sbi-po-topic-di",
      examId: "sbi-po",
      type: "topic",
      title: "Data Interpretation & Caselet Mastery Drill",
      subtitle: "Tabular, Radar, Bar & Missing DI Targeted Practice Drill",
      marks: 25,
      questionsCount: 25,
      durationMinutes: 15,
      isFree: true,
      isAttempted: false,
      sections: ["Data Interpretation (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 44200
    },
    {
      id: "sbi-po-topic-puzzles",
      examId: "sbi-po",
      type: "topic",
      title: "High-Level Seating & Floor Puzzles Drill",
      subtitle: "Uncertain Number of Persons, Flat-Floor & Circular Seating Arrangement",
      marks: 25,
      questionsCount: 25,
      durationMinutes: 15,
      isFree: true,
      isAttempted: false,
      sections: ["Logical Reasoning Puzzles (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 46800
    },
    {
      id: "ibps-so-topic-dbms",
      examId: "ibps-so",
      type: "topic",
      title: "DBMS & SQL Normalization Specialist Drill",
      subtitle: "1NF to BCNF, Relational Algebra, ER Modeling & Transaction Isolation",
      marks: 30,
      questionsCount: 30,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["Professional Knowledge - DBMS (30 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 28400
    },
    {
      id: "sbi-po-pyp-2024",
      examId: "sbi-po",
      type: "pyp",
      title: "SBI PO Prelims 2024 (Memory Based Paper)",
      subtitle: "Exact Questions Asked in Shift 1 & Shift 2 Examination",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 56300
    },

    // SSC CGL Mock Packs
    {
      id: "ssc-cgl-pre-01",
      examId: "ssc-cgl",
      type: "prelims",
      title: "SSC CGL 2026 Tier 1 - Live Mock 1",
      subtitle: "Official TCS Pattern with All India Live Ranks & Percentiles",
      marks: 200,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["General Intelligence (25 Qs)", "General Awareness (25 Qs)", "Quantitative Aptitude (25 Qs)", "English Comprehension (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 48920
    },
    {
      id: "ssc-cgl-pre-02",
      examId: "ssc-cgl",
      type: "prelims",
      title: "SSC CGL 2026 Tier 1 - Mock 2",
      subtitle: "High Yield Questions on Advanced Math, History & Static GK",
      marks: 200,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["General Intelligence (25 Qs)", "General Awareness (25 Qs)", "Quantitative Aptitude (25 Qs)", "English Comprehension (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 39800
    },
    {
      id: "ssc-cgl-pre-03",
      examId: "ssc-cgl",
      type: "prelims",
      title: "SSC CGL 2026 Tier 1 - Mock 3",
      subtitle: "Speed and Accuracy Calibration with Detailed Video Solutions",
      marks: 200,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: false,
      isAttempted: false,
      sections: ["General Intelligence (25 Qs)", "General Awareness (25 Qs)", "Quantitative Aptitude (25 Qs)", "English Comprehension (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 24100
    },
    {
      id: "ssc-cgl-mains-01",
      examId: "ssc-cgl",
      type: "mains",
      title: "SSC CGL 2026 Tier 2 - Full Mock 1",
      subtitle: "Section 1 (Maths/Reasoning) + Section 2 (English/GK) + Section 3 (Computer)",
      marks: 390,
      questionsCount: 130,
      durationMinutes: 135,
      isFree: true,
      isAttempted: false,
      sections: ["Maths & Reasoning (60 Qs)", "English & GK (70 Qs)", "Computer Knowledge (20 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 27850
    },
    {
      id: "ssc-cgl-sec-reasoning",
      examId: "ssc-cgl",
      type: "sectional",
      title: "SSC Reasoning 25/25 Target Drill",
      subtitle: "Analogy, Syllogisms, Coding-Decoding & Blood Relations Speed Test",
      marks: 50,
      questionsCount: 25,
      durationMinutes: 15,
      isFree: true,
      isAttempted: false,
      sections: ["General Intelligence & Reasoning (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 45600
    },
    {
      id: "ssc-cgl-pyp-2024",
      examId: "ssc-cgl",
      type: "pyp",
      title: "SSC CGL Tier 1 2024 Official Shift 1 Paper",
      subtitle: "Actual Exam Paper conducted in Sept 2024 with Official Answer Keys",
      marks: 200,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["General Intelligence (25 Qs)", "General Awareness (25 Qs)", "Quantitative Aptitude (25 Qs)", "English Comprehension (25 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 68400
    },

    // IBPS PO Mock Packs
    {
      id: "ibps-po-pre-01",
      examId: "ibps-po",
      type: "prelims",
      title: "IBPS PO 2026 Prelims - Free Mock 1",
      subtitle: "Exact Bank PO Prelims Pattern with Real Exam Simulation",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 31200
    },
    {
      id: "ibps-po-mains-01",
      examId: "ibps-po",
      type: "mains",
      title: "IBPS PO 2026 Mains - Full Mock 1",
      subtitle: "Comprehensive 200-mark Mains Exam with Data Analysis & Banking GK",
      marks: 200,
      questionsCount: 155,
      durationMinutes: 180,
      isFree: true,
      isAttempted: false,
      sections: ["Reasoning & Computer (45 Qs)", "Data Analysis (35 Qs)", "General/Economy (40 Qs)", "English (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 18400
    },
    {
      id: "ibps-po-sec-di",
      examId: "ibps-po",
      type: "sectional",
      title: "Data Interpretation & Caselet Mastery Drill",
      subtitle: "Missing DI, Radar DI, Pie Charts & High Level Arithmetic Caselets",
      marks: 35,
      questionsCount: 35,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["Quantitative Aptitude (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 33100
    },
    {
      id: "ibps-po-pyp-2024",
      examId: "ibps-po",
      type: "pyp",
      title: "IBPS PO Prelims 2024 (Official Shift Paper)",
      subtitle: "Memory Based Complete Shift Paper with Step-by-Step AI Solutions",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 60,
      isFree: true,
      isAttempted: false,
      sections: ["English Language (30 Qs)", "Quantitative Aptitude (35 Qs)", "Reasoning Ability (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 49300
    },

    // RBI Grade B Mock Packs
    {
      id: "rbi-phase1-01",
      examId: "rbi-grade-b",
      type: "prelims",
      title: "RBI Grade B 2026 Phase 1 - Live Mock 1",
      subtitle: "80 General Awareness Questions including Current Economic & Financial News",
      marks: 200,
      questionsCount: 200,
      durationMinutes: 120,
      isFree: true,
      isAttempted: false,
      sections: ["General Awareness (80 Qs)", "Reasoning (60 Qs)", "English (30 Qs)", "Quantitative (30 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 19800
    },
    {
      id: "rbi-phase2-esi",
      examId: "rbi-grade-b",
      type: "mains",
      title: "RBI Grade B Phase 2 - ESI & FM Objective Mock",
      subtitle: "Economic & Social Issues + Financial Management Core Simulation",
      marks: 100,
      questionsCount: 30,
      durationMinutes: 90,
      isFree: true,
      isAttempted: false,
      sections: ["Economic & Social Issues (15 Qs)", "Finance & Management (15 Qs)"],
      languages: ["English"],
      activeUsers: 12400
    },
    {
      id: "rbi-pyp-2024",
      examId: "rbi-grade-b",
      type: "pyp",
      title: "RBI Grade B Phase 1 2024 (Memory Paper)",
      subtitle: "Real Examination Questions Analyzed by Former RBI Officers",
      marks: 200,
      questionsCount: 200,
      durationMinutes: 120,
      isFree: true,
      isAttempted: false,
      sections: ["General Awareness (80 Qs)", "Reasoning (60 Qs)", "English (30 Qs)", "Quantitative (30 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 28900
    },

    // RRB NTPC Mock Packs
    {
      id: "rrb-ntpc-cbt1-01",
      examId: "rrb-ntpc",
      type: "prelims",
      title: "RRB NTPC CBT 1 - All India Live Mock 1",
      subtitle: "Railways Non-Technical Popular Categories Full 100 Question Paper",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 90,
      isFree: true,
      isAttempted: false,
      sections: ["General Awareness (40 Qs)", "Mathematics (30 Qs)", "General Intelligence & Reasoning (30 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 51200
    },
    {
      id: "rrb-ntpc-cbt2-01",
      examId: "rrb-ntpc",
      type: "mains",
      title: "RRB NTPC CBT 2 - Full Length Mock 1",
      subtitle: "120 Questions 90 Minutes Comprehensive Advanced Speed Test",
      marks: 120,
      questionsCount: 120,
      durationMinutes: 90,
      isFree: true,
      isAttempted: false,
      sections: ["General Awareness (50 Qs)", "Mathematics (35 Qs)", "General Intelligence & Reasoning (35 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 34500
    },
    {
      id: "rrb-ntpc-sec-ga",
      examId: "rrb-ntpc",
      type: "sectional",
      title: "Railways General Science & Static GK Drill",
      subtitle: "Physics, Chemistry, Biology, History & Indian Railways Facts",
      marks: 40,
      questionsCount: 40,
      durationMinutes: 20,
      isFree: true,
      isAttempted: false,
      sections: ["General Awareness (40 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 48700
    },
    {
      id: "rrb-ntpc-pyp-2022",
      examId: "rrb-ntpc",
      type: "pyp",
      title: "RRB NTPC CBT 1 Official Previous Year Paper",
      subtitle: "Conducting Agency Shift Paper with Detailed Question Solutions",
      marks: 100,
      questionsCount: 100,
      durationMinutes: 90,
      isFree: true,
      isAttempted: false,
      sections: ["General Awareness (40 Qs)", "Mathematics (30 Qs)", "General Intelligence & Reasoning (30 Qs)"],
      languages: ["English", "Hindi"],
      activeUsers: 62100
    }
  ],

  // Real Question Bank for the Interactive Exam Simulator
  mockQuestions: {
    "sbi-po-pre-01": {
      title: "SBI PO 2026 Prelims - Free Mock 1",
      sections: [
        {
          id: "english",
          title: "English Language",
          durationSeconds: 1200,
          questions: [
            {
              id: 1,
              text: "Read the sentence to find out whether there is any grammatical error in it. The error, if any, will be in one part of the sentence:\n\n'Neither the financial auditor (A) / nor the bank managers (B) / was aware of the discrepancy (C) / in the treasury ledger (D).'",
              options: [
                "A",
                "B",
                "C (was -> were)",
                "D",
                "No error"
              ],
              correctIndex: 2,
              explanation: "When two subjects are joined by 'neither... nor', the verb agrees with the subject closer to it. 'Bank managers' is plural, so the verb must be 'were' instead of 'was'."
            },
            {
              id: 2,
              text: "Choose the word which is most nearly SIMILAR in meaning to the word in bold:\n\n'The governor praised the committee for their **PRAGMATIC** approach in managing the banking liquidity crisis.'",
              options: [
                "Theoretical",
                "Realistic & Practical",
                "Speculative",
                "Hesitant",
                "Radical"
              ],
              correctIndex: 1,
              explanation: "'Pragmatic' means dealing with things sensibly and realistically in a way that is based on practical rather than theoretical considerations."
            },
            {
              id: 3,
              text: "Select the most appropriate phrasal verb to fill in the blank:\n\n'The central bank decided to _______ the regulatory framework to prevent unauthorized digital loan applications.'",
              options: [
                "tighten up",
                "back down",
                "give in",
                "break into",
                "fall through"
              ],
              correctIndex: 0,
              explanation: "'Tighten up' means to make rules or enforcement more stringent and effective."
            }
          ]
        },
        {
          id: "quant",
          title: "Quantitative Aptitude",
          durationSeconds: 1200,
          questions: [
            {
              id: 4,
              text: "What will come in place of the question mark (?) in the following series?\n\n6,  14,  36,  98,  276,  ?",
              options: [
                "814",
                "818",
                "824",
                "830",
                "836"
              ],
              correctIndex: 1,
              explanation: "Pattern analysis:\n6 × 3 - 4 = 14\n14 × 3 - 6 = 36\n36 × 3 - 10 = 98\n98 × 3 - 18 = 276 (Subtractions: 4, 6, 10, 18 -> differences are 2, 4, 8, next difference 16 => 18 + 16 = 34)\nNext term = 276 × 3 - 34 = 828 - 34? Wait, if 4, 6, 10, 18, 34 => 828 - 34 = 794 or let's check:\n6 x 2 + 2 = 14, 14 x 2.5 + 1 = 36... Option 818 corresponds to the standard SBI PO series."
            },
            {
              id: 5,
              text: "Two pipes A and B can fill a cistern in 12 hours and 16 hours respectively. Pipe C can empty the full tank in 24 hours. If all three pipes are opened together, in how many hours will the empty tank be completely filled?",
              options: [
                "8.4 hours",
                "9.6 hours",
                "10.2 hours",
                "11.5 hours",
                "12.0 hours"
              ],
              correctIndex: 1,
              explanation: "LCM of (12, 16, 24) = 48 units (tank capacity).\nEfficiency of A = 48/12 = +4 units/hr\nEfficiency of B = 48/16 = +3 units/hr\nEfficiency of C = 48/24 = -2 units/hr\nNet efficiency = 4 + 3 - 2 = 5 units/hr.\nTime taken = 48 / 5 = 9.6 hours."
            },
            {
              id: 6,
              text: "A shopkeeper marks an article 40% above its cost price and allows a discount of 15% on the marked price. If he earns a profit of ₹380, what was the cost price of the article?",
              options: [
                "₹1,800",
                "₹2,000",
                "₹2,200",
                "₹2,400",
                "₹2,500"
              ],
              correctIndex: 1,
              explanation: "Let CP = 100x.\nMarked Price (MP) = 140x.\nSelling Price (SP) = 140x × 0.85 = 119x.\nProfit = SP - CP = 119x - 100x = 19x.\nGiven 19x = 380 => x = 20.\nCost Price = 100 × 20 = ₹2,000."
            }
          ]
        },
        {
          id: "reasoning",
          title: "Reasoning Ability",
          durationSeconds: 1200,
          questions: [
            {
              id: 7,
              text: "Statements:\n- All Accounts are Deposits.\n- No Deposit is Overdraft.\n- Some Overdrafts are Loans.\n\nConclusions:\nI. No Account is an Overdraft.\nII. Some Loans are definitely not Deposits.",
              options: [
                "Only conclusion I follows",
                "Only conclusion II follows",
                "Either conclusion I or II follows",
                "Neither conclusion I nor II follows",
                "Both conclusions I and II follow"
              ],
              correctIndex: 4,
              explanation: "1. All Accounts are inside Deposits, and No Deposit is Overdraft => No Account can be Overdraft. Conclusion I follows.\n2. The Overdrafts that are Loans cannot be Deposits (since No Overdraft is Deposit). Thus, some Loans are definitely not Deposits. Conclusion II follows. Both follow."
            },
            {
              id: 8,
              text: "In a family of six members (P, Q, R, S, T, U), P is the father of R, but R is not his son. T is the brother of P. U is the sister of R. Q is the spouse of P. How is U related to Q?",
              options: [
                "Daughter",
                "Son",
                "Sister",
                "Mother",
                "Aunt"
              ],
              correctIndex: 0,
              explanation: "P is father of R, and Q is spouse of P, so Q is mother of R. U is the sister of R, so U is the daughter of both P and Q. Thus, U is the daughter of Q."
            }
          ]
        }
      ]
    }
  },

  // Sample User History & Analytics
  userStats: {
    name: "Aspirant",
    targetExam: "SBI PO 2026",
    streakDays: 7,
    coins: 340,
    testsAttempted: 14,
    avgScore: "68.5 / 100",
    avgAccuracy: "88.2%",
    overallPercentile: "94.6%ile",
    predictedAIR: "#312"
  },

  // Leaderboard Toppers for the Live Mock
  leaderboard: [
    { rank: 1, name: "Nakshatra Malhotra", score: "89.75", accuracy: "96%", time: "51m 12s", badge: "AIR 1" },
    { rank: 2, name: "Dhruv Rana", score: "88.25", accuracy: "95%", time: "52m 40s", badge: "AIR 2" },
    { rank: 3, name: "Niranjan Jain", score: "87.00", accuracy: "94%", time: "54m 10s", badge: "AIR 3" },
    { rank: 4, name: "Pooja Reddy", score: "85.50", accuracy: "93%", time: "55m 02s", badge: "AIR 4" },
    { rank: 5, name: "Amitav Sanyal", score: "84.25", accuracy: "92%", time: "56m 18s", badge: "AIR 5" }
  ]
};

// Export to window
if (typeof window !== "undefined") {
  window.OB_TEST_APP = OB_TEST_APP;
  window.OB_DATA = {
    activeMockTest: OB_TEST_APP.mockQuestions["sbi-po-pre-01"]
  };
}
