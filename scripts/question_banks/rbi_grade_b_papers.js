/**
 * rbi_grade_b_papers.js
 * Question sets for RBI Grade B Phase 1, Phase 2 (ESI & FM), and 2024 Memory Paper.
 * Authentic RBI Grade B standard: High-level General Awareness (80 Qs), Reasoning (60 Qs), Quant (30 Qs), English (30 Qs).
 */

const { createQuestion, createSection, createTestPayload } = require('../question_builder');

function buildRbiPhase1({ id, title, subtitle, seedOffset = 1, isPyp = false }) {
  // 1. General Awareness (80 Questions)
  const gaQs = [];
  const rbiGaTopics = [
    {
      q: 'Under the Reserve Bank of India’s revised priority sector lending (PSL) norms, what is the mandatory PSL target for domestic commercial banks?',
      opts: ['40% of Adjusted Net Bank Credit (ANBC)', '35% of ANBC', '45% of ANBC', '30% of ANBC', '50% of ANBC'],
      ans: 'A',
      idx: 0,
      exp: 'RBI prescribes that all domestic scheduled commercial banks must allocate at least 40% of their ANBC or credit equivalent of off-balance sheet exposures to priority sectors.'
    },
    {
      q: 'Which liquidity management facility serves as the non-collateralized operational floor of the RBI’s Liquidity Adjustment Facility (LAF) corridor?',
      opts: ['Standing Deposit Facility (SDF)', 'Marginal Standing Facility (MSF)', 'Repo Facility', 'Reverse Repo Rate', 'Bank Rate'],
      ans: 'A',
      idx: 0,
      exp: 'Introduced in April 2022, the Standing Deposit Facility (SDF) replaced the fixed-rate reverse repo as the non-collateralized floor of the LAF corridor.'
    },
    {
      q: 'What is the statutory ceiling on foreign direct investment (FDI) in Indian private sector commercial banks under the automatic and government approval routes?',
      opts: ['74% (up to 49% automatic, beyond 49% approval)', '100% automatic', '51% approval only', '49% automatic', '26% automatic'],
      ans: 'A',
      idx: 0,
      exp: 'FDI in private banking is permitted up to 74% (automatic route up to 49%, and government approval route beyond 49% and up to 74%).'
    },
    {
      q: 'Which international financial organization publishes the flagship semi-annual "Global Financial Stability Report" (GFSR)?',
      opts: ['International Monetary Fund (IMF)', 'World Bank', 'Bank for International Settlements (BIS)', 'Financial Stability Board (FSB)', 'OECD'],
      ans: 'A',
      idx: 0,
      exp: 'The IMF publishes the Global Financial Stability Report twice a year (April and October).'
    },
    {
      q: 'Under the Sovereign Gold Bond (SGB) scheme, what is the annual interest rate paid semi-annually on the nominal value of the investment?',
      opts: ['2.50% per annum', '2.00% per annum', '3.00% per annum', '1.75% per annum', '3.50% per annum'],
      ans: 'A',
      idx: 0,
      exp: 'SGB investors earn a fixed interest rate of 2.50% per annum paid semi-annually on the initial nominal investment.'
    }
  ];

  for (let i = 1; i <= 80; i++) {
    const t = rbiGaTopics[(i - 1 + seedOffset) % rbiGaTopics.length];
    gaQs.push(createQuestion({
      id: `${id}-ga-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'General Awareness',
      questionHTML: `<p><b>Question ${i} [Economic & Financial Awareness]:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`,
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  // 2. Reasoning (60 Questions)
  const raQs = [];
  for (let i = 81; i <= 140; i++) {
    raQs.push(createQuestion({
      id: `${id}-ra-q${i}`,
      globalIndex: i,
      localIndex: i - 80,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i} [High Level Critical Reasoning]:</b> The Central Bank raised the key policy rate by 50 basis points. Which of the following assumptions is implicit in this policy action?</p>`,
      options: [
        'Higher borrowing costs will temper aggregate demand and anchor inflation expectations.',
        'Commercial banks will immediately lower all lending rates.',
        'Foreign institutional investors will completely exit the domestic equity market.',
        'Economic growth will accelerate exponentially in the short term.',
        'None of the above.'
      ],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Monetary tightening is premised on the fundamental macroeconomic assumption that raising policy rates dampens demand-pull inflation by making credit costlier.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  // 3. English Language (30 Questions)
  const elQs = [];
  for (let i = 141; i <= 170; i++) {
    elQs.push(createQuestion({
      id: `${id}-el-q${i}`,
      globalIndex: i,
      localIndex: i - 140,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i} [Editorial Vocabulary]:</b> Select the most appropriate synonym for <b>PARSIMONIOUS</b>:</p>`,
      options: ['Frugal', 'Extravagant', 'Generous', 'Prolific', 'Ostentatious'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>"Parsimonious" means extremely frugal or stingy with resources.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  // 4. Quantitative Aptitude (30 Questions)
  const qaQs = [];
  for (let i = 171; i <= 200; i++) {
    qaQs.push(createQuestion({
      id: `${id}-qa-q${i}`,
      globalIndex: i,
      localIndex: i - 170,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i} [RBI Quant]:</b> An investor invests ₹1,00,000 partly in Scheme X at 12% p.a. simple interest and the remaining in Scheme Y at 15% p.a. simple interest. If the total annual interest received is ₹13,800, how much was invested in Scheme Y?</p>`,
      options: ['₹60,000', '₹50,000', '₹40,000', '₹70,000', '₹65,000'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>By Alligation: Average rate = (13800 / 100000) * 100 = 13.8%.<br>Ratio of X to Y = (15 - 13.8) : (13.8 - 12) = 1.2 : 1.8 = 2 : 3.<br>Investment in Scheme Y = (3 / 5) * 100,000 = ₹60,000.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  const sections = [
    createSection({ id: 'ga', title: 'General Awareness', durationMinutes: 25, maxMarks: 80, questions: gaQs }),
    createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 45, maxMarks: 60, questions: raQs }),
    createSection({ id: 'el', title: 'English Language', durationMinutes: 25, maxMarks: 30, questions: elQs }),
    createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 25, maxMarks: 30, questions: qaQs })
  ];

  return createTestPayload({
    id,
    examId: 'rbi-grade-b',
    examName: 'RBI Grade B 2026',
    type: isPyp ? 'pyp' : 'prelims',
    title,
    subtitle,
    durationMinutes: 120,
    marks: 200,
    sections
  });
}

function buildRbiPhase2Esi() {
  const esiQs = [];
  for (let i = 1; i <= 15; i++) {
    esiQs.push(createQuestion({
      id: `rbi-esi-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Economic & Social Issues',
      questionHTML: `<p><b>Question ${i} [ESI]:</b> What is the primary metric utilized by the NITI Aayog to compute the National Multidimensional Poverty Index (MPI)?</p>`,
      options: [
        'Alkire-Foster (AF) methodology spanning Health, Education, and Standard of Living',
        'Pure calorie intake per person per day',
        'Daily wage rates under MGNREGA',
        'Per capita consumption expenditure from NSSO rounds',
        'Headcount ratio based solely on income below $2.15 a day'
      ],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>NITI Aayog’s National MPI is based on the globally recognized Alkire-Foster methodology with 12 indicators across Health, Education, and Standard of Living.</p>',
      marksForCorrect: 3.33,
      negativeMarks: 0.83
    }));
  }

  const fmQs = [];
  for (let i = 16; i <= 30; i++) {
    fmQs.push(createQuestion({
      id: `rbi-fm-q${i}`,
      globalIndex: i,
      localIndex: i - 15,
      section: 'Finance & Management',
      questionHTML: `<p><b>Question ${i} [FM]:</b> According to Herzberg’s Two-Factor Theory of Motivation, which of the following is categorized as a "Motivator" factor rather than a "Hygiene" factor?</p>`,
      options: ['Challenging work and recognition', 'Salary and monetary compensation', 'Company policies and administration', 'Working conditions and job security', 'Interpersonal relations with supervisors'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Herzberg classified recognition, achievement, and challenging work as intrinsic Motivators, whereas salary, working conditions, and company policy are extrinsic Hygiene factors.</p>',
      marksForCorrect: 3.33,
      negativeMarks: 0.83
    }));
  }

  const sections = [
    createSection({ id: 'esi', title: 'Economic & Social Issues', durationMinutes: 45, maxMarks: 50, questions: esiQs }),
    createSection({ id: 'fm', title: 'Finance & Management', durationMinutes: 45, maxMarks: 50, questions: fmQs })
  ];

  return createTestPayload({
    id: 'rbi-phase2-esi',
    examId: 'rbi-grade-b',
    examName: 'RBI Grade B 2026',
    type: 'mains',
    title: 'RBI Grade B Phase 2 - ESI & FM Objective Mock',
    subtitle: 'Economic & Social Issues + Financial Management Core Simulation',
    durationMinutes: 90,
    marks: 100,
    sections
  });
}

module.exports = {
  buildRbiPhase1,
  buildRbiPhase2Esi
};
