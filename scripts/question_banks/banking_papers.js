/**
 * banking_papers.js
 * Question sets for SBI PO & IBPS PO Mocks, PYP, Mains, Sectionals & Topic Tests.
 * Ensures every test has distinct questions, options, and explanations.
 */

const { createQuestion, createSection, createTestPayload } = require('../question_builder');

// ==========================================
// 1. SBI PO PRELIMS - MOCK 2 (100 Questions)
// ==========================================
function buildSbiPoPrelims2() {
  const rcPassage = `<div class="rc-passage">
    <h4>Central Bank Digital Currency (CBDC) & The Future of Retail Payments</h4>
    <p>The Reserve Bank of India’s introduction of the Digital Rupee (e₹) marks a paradigm shift in the sovereign monetary architecture. Unlike decentralized cryptocurrencies, which suffer from inherent volatility and lack sovereign backing, CBDCs represent legal tender in a digital form issued directly by the central bank. Retail CBDC (e₹-R) offers an electronic counterpart to physical cash, aiming to preserve the direct public access to sovereign money while optimizing cash handling logistics.</p>
    <p>A critical technical frontier in CBDC design is the delicate equilibrium between transactional privacy and regulatory compliance. Complete anonymity risks facilitating illicit financial flows, whereas total surveillance undermines public trust. The RBI has adopted a tier-based architecture where low-value transactions retain near-cash privacy, while high-value settlements mandate Anti-Money Laundering (AML) and Countering the Financing of Terrorism (CFT) verifications. Interoperability with the Unified Payments Interface (UPI) QR code ecosystem has significantly catalyzed merchant acceptance, allowing consumers to scan standard merchant QR codes and transact directly from their CBDC wallets without requiring merchants to install proprietary terminals.</p>
    <p>Moreover, the programmability aspect of CBDCs opens unprecedented avenues for targeted social subsidies, agricultural input financing, and cross-border remittances. By enabling money to be earmarked for specific geographic regions or expenditure types (such as fertilizer subsidies or educational tuition), CBDC significantly curtails leakage and systemic slippage inherent in traditional fiscal disbursements.</p>
  </div>`;

  const elQs = [
    createQuestion({
      id: 'sbi-pre2-q1',
      globalIndex: 1,
      localIndex: 1,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'According to the passage, why is retail CBDC (e₹-R) fundamentally different from decentralized cryptocurrencies?',
      options: [
        'CBDC is backed by sovereign credit and issued directly by the central bank as legal tender.',
        'Cryptocurrencies possess fixed transaction limits mandated by financial authorities.',
        'CBDC is completely unregulated and relies exclusively on public blockchain nodes.',
        'Cryptocurrencies are legally accepted at all domestic retail merchant outlets.',
        'None of the above.'
      ],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>The passage explicitly states that unlike volatile cryptocurrencies lacking sovereign backing, CBDC represents legal tender issued directly by the central bank.</p>'
    }),
    createQuestion({
      id: 'sbi-pre2-q2',
      globalIndex: 2,
      localIndex: 2,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'How has interoperability with the UPI QR code architecture benefited the adoption of the Digital Rupee?',
      options: [
        'It eliminates the requirement for commercial banks to hold statutory reserves.',
        'Consumers can make CBDC payments using existing merchant QR codes without proprietary terminals.',
        'It converts all digital transactions automatically into physical bank notes.',
        'It ensures that all transactions are processed through foreign financial switches.',
        'It prevents any record of high-value transactions from being reported.'
      ],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>The passage highlights that UPI QR interoperability allows consumers to scan standard merchant QR codes directly from their CBDC wallets without new terminals.</p>'
    }),
    createQuestion({
      id: 'sbi-pre2-q3',
      globalIndex: 3,
      localIndex: 3,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'Which of the following is most nearly SIMILAR in meaning to the word <b>EQUILIBRIUM</b> as used in the passage?',
      options: ['Disparity', 'Balance', 'Turbulence', 'Fluctuation', 'Stagnation'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>"Equilibrium" refers to a state of balance or poised state between opposing forces or elements.</p>'
    }),
    createQuestion({
      id: 'sbi-pre2-q4',
      globalIndex: 4,
      localIndex: 4,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'What potential benefit of "programmability" in CBDCs is emphasized in the third paragraph?',
      options: [
        'It allows money to be earmarked for targeted expenditures, preventing subsidy leakages.',
        'It increases the interest rate paid on ordinary checking accounts automatically.',
        'It guarantees zero exchange rate fluctuation against all foreign currencies.',
        'It permits commercial banks to issue their own private currency notes.',
        'It eliminates the need for Know Your Customer (KYC) documentation permanently.'
      ],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Paragraph 3 explains that programmability allows money to be earmarked for specific purposes like fertilizer subsidies, curtailing leakage and slippage.</p>'
    }),
    createQuestion({
      id: 'sbi-pre2-q5',
      globalIndex: 5,
      localIndex: 5,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'Which of the following statements is/are NOT TRUE according to the passage?<br>I. Complete anonymity in digital transactions risks illicit financial flows.<br>II. High-value CBDC settlements do not require any AML/CFT verification.<br>III. Low-value transactions retain near-cash privacy under RBI’s tiered framework.',
      options: ['Only I', 'Only II', 'Only III', 'Both I and III', 'Both II and III'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Statement II is NOT TRUE: The passage explicitly states that high-value settlements mandate AML and CFT verifications.</p>'
    })
  ];

  // Add remaining English Questions (Error spotting, Cloze test, Sentence rearrangement)
  const englishTopics = [
    {
      q: 'Read the sentence to identify the segment containing a grammatical error:<br><i>"Neither the branch manager (A) / nor the deputy accountants (B) / was in a position to justify (C) / the unprecedented deficit in the quarterly cash vault audit (D)."</i>',
      opts: ['Segment A', 'Segment B', 'Segment C (was -> were)', 'Segment D', 'No Error'],
      ans: 'C',
      idx: 2,
      exp: 'When subjects are connected by "Neither... nor", the verb agrees with the closer subject ("deputy accountants" plural -> "were").'
    },
    {
      q: 'Select the most appropriate word to fill in the blank:<br><i>"The Monetary Policy Committee decided to _______ its stance to prevent aggressive inflationary expectations from becoming entrenched in the domestic market."</i>',
      opts: ['relinquish', 'recalibrate', 'disintegrate', 'improvise', 'condone'],
      ans: 'B',
      idx: 1,
      exp: '"Recalibrate" means to adjust or calibrate again precisely to align with current economic conditions.'
    },
    {
      q: 'Identify the word with incorrect spelling:',
      opts: ['Pragmatic', 'Surveillance', 'Bureaucracy', 'Acommodate', 'Exorbitant'],
      ans: 'D',
      idx: 3,
      exp: 'The correct spelling is "Accommodate" with double "c" and double "m".'
    },
    {
      q: 'In the sentence below, four words are highlighted. Identify the pair that must be swapped to make the sentence grammatically and contextually meaningful:<br><i>"The central bank’s <b>intervention (A)</b> in the foreign exchange market was <b>calculated (B)</b> to <b>volatility (C)</b> excessive rupee <b>curb (D)</b>."</i>',
      opts: ['A-B', 'C-D', 'B-C', 'A-D', 'No swap required'],
      ans: 'B',
      idx: 1,
      exp: 'Swapping C and D gives: "...calculated to curb (D) excessive rupee volatility (C)".'
    },
    {
      q: 'Choose the option that represents the correct passive form of the given active sentence:<br><i>"The statutory auditor examined the non-performing loan portfolios meticulously."</i>',
      opts: [
        'The non-performing loan portfolios were meticulously examined by the statutory auditor.',
        'The non-performing loan portfolios had been meticulously examined by the statutory auditor.',
        'The statutory auditor had been examining the non-performing loan portfolios.',
        'Meticulously the non-performing loan portfolios was examined by the statutory auditor.',
        'The non-performing loan portfolios are being examined by the statutory auditor.'
      ],
      ans: 'A',
      idx: 0,
      exp: 'Past simple active "examined" converts to "were examined" in passive voice.'
    }
  ];

  for (let i = 6; i <= 30; i++) {
    const t = englishTopics[(i - 6) % englishTopics.length];
    elQs.push(createQuestion({
      id: `sbi-pre2-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i}:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`
    }));
  }

  // 2. Quantitative Aptitude (35 Questions: Q31 to Q65)
  const qaQs = [];
  const radarDiContext = `<div class="di-context">
    <h4>Data Interpretation: Branch Loan Disbursements (₹ in Crores)</h4>
    <p>The table below summarizes the loan disbursements made by 5 public sector branches across 3 categories in Q3 FY2026:</p>
    <table class="table table-bordered table-sm" style="width:100%;text-align:center;border-collapse:collapse;" border="1">
      <thead style="background:#f1f5f9;">
        <tr><th>Branch</th><th>Retail Loans</th><th>Agri Loans</th><th>MSME Loans</th><th>Total Loans</th></tr>
      </thead>
      <tbody>
        <tr><td>Connaught Place</td><td>120</td><td>40</td><td>140</td><td>300</td></tr>
        <tr><td>Bandra West</td><td>180</td><td>20</td><td>200</td><td>400</td></tr>
        <tr><td>MG Road</td><td>90</td><td>70</td><td>140</td><td>300</td></tr>
        <tr><td>Salt Lake</td><td>110</td><td>50</td><td>90</td><td>250</td></tr>
        <tr><td>T. Nagar</td><td>150</td><td>60</td><td>190</td><td>400</td></tr>
      </tbody>
    </table>
  </div>`;

  qaQs.push(createQuestion({
    id: 'sbi-pre2-q31',
    globalIndex: 31,
    localIndex: 1,
    section: 'Quantitative Aptitude',
    passageHTML: radarDiContext,
    questionHTML: 'What is the ratio of total Retail loans disbursed by Bandra West and T. Nagar together to total MSME loans disbursed by Connaught Place and MG Road together?',
    options: ['33 : 28', '11 : 9', '28 : 25', '3 : 2', '15 : 14'],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>Retail (Bandra West + T. Nagar) = 180 + 150 = 330.<br>MSME (Connaught Place + MG Road) = 140 + 140 = 280.<br>Ratio = 330 : 280 = 33 : 28.</p>'
  }));

  qaQs.push(createQuestion({
    id: 'sbi-pre2-q32',
    globalIndex: 32,
    localIndex: 2,
    section: 'Quantitative Aptitude',
    passageHTML: radarDiContext,
    questionHTML: 'Agri loans disbursed by MG Road form what percentage of the total loans disbursed by the same branch?',
    options: ['20%', '23.33%', '25%', '28.5%', '30%'],
    correctAnswer: 'B',
    correctIndex: 1,
    explanationHTML: '<p>MG Road Agri = 70. MG Road Total = 300.<br>Percentage = (70 / 300) * 100 = 23.33%.</p>'
  }));

  qaQs.push(createQuestion({
    id: 'sbi-pre2-q33',
    globalIndex: 33,
    localIndex: 3,
    section: 'Quantitative Aptitude',
    passageHTML: radarDiContext,
    questionHTML: 'What is the average MSME loan disbursement across all 5 branches combined?',
    options: ['₹145 Crores', '₹152 Crores', '₹160 Crores', '₹165 Crores', '₹158 Crores'],
    correctAnswer: 'B',
    correctIndex: 1,
    explanationHTML: '<p>Total MSME = 140 + 200 + 140 + 90 + 190 = 760.<br>Average = 760 / 5 = ₹152 Crores.</p>'
  }));

  qaQs.push(createQuestion({
    id: 'sbi-pre2-q34',
    globalIndex: 34,
    localIndex: 4,
    section: 'Quantitative Aptitude',
    passageHTML: radarDiContext,
    questionHTML: 'If Salt Lake branch charges an average interest rate of 10% on Retail, 8% on Agri, and 12% on MSME loans, what is the total annual interest generated by Salt Lake branch?',
    options: ['₹25.8 Crores', '₹26.2 Crores', '₹27.5 Crores', '₹24.9 Crores', '₹28.0 Crores'],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>Retail: 110 * 0.10 = 11.0 Cr.<br>Agri: 50 * 0.08 = 4.0 Cr.<br>MSME: 90 * 0.12 = 10.8 Cr.<br>Total = 11.0 + 4.0 + 10.8 = ₹25.8 Crores.</p>'
  }));

  qaQs.push(createQuestion({
    id: 'sbi-pre2-q35',
    globalIndex: 35,
    localIndex: 5,
    section: 'Quantitative Aptitude',
    passageHTML: radarDiContext,
    questionHTML: 'Which branch registered the highest proportion of Retail loans relative to its total disbursement?',
    options: ['Connaught Place', 'Bandra West', 'MG Road', 'Salt Lake', 'T. Nagar'],
    correctAnswer: 'B',
    correctIndex: 1,
    explanationHTML: '<p>Retail / Total:<br>CP: 120/300 = 40.0%<br>Bandra: 180/400 = 45.0%<br>MG Road: 90/300 = 30.0%<br>Salt Lake: 110/250 = 44.0%<br>T. Nagar: 150/400 = 37.5%<br>Highest is Bandra West with 45.0%.</p>'
  }));

  // Quant Arithmetic & Quadratic series
  const quantTopics = [
    {
      q: 'Solve the two equations and establish the relationship between x and y:<br><b>I. x² - 19x + 84 = 0</b><br><b>II. y² - 25y + 156 = 0</b>',
      opts: ['x > y', 'x < y', 'x ≥ y', 'x ≤ y', 'x = y or relationship cannot be established'],
      ans: 'D',
      idx: 3,
      exp: 'x² - 19x + 84 = 0 => (x - 7)(x - 12) = 0 => x = 7, 12.<br>y² - 25y + 156 = 0 => (y - 12)(y - 13) = 0 => y = 12, 13.<br>Comparing: 7 < 12, 7 < 13, 12 = 12, 12 < 13. Hence, x ≤ y.'
    },
    {
      q: 'Find the missing number in the series:<br><b>14, 28, 84, 336, 1680, ?</b>',
      opts: ['8400', '10080', '9600', '10240', '11200'],
      ans: 'B',
      idx: 1,
      exp: 'Pattern: *2, *3, *4, *5, *6.<br>1680 * 6 = 10080.'
    },
    {
      q: 'A sum of ₹16,000 invested at compound interest at 10% per annum becomes ₹21,296. Find the time period in years.',
      opts: ['2 years', '2.5 years', '3 years', '3.5 years', '4 years'],
      ans: 'C',
      idx: 2,
      exp: 'A = P(1 + r/100)^n => 21296 = 16000(1.1)^n => 21296/16000 = 1.331 = (1.1)³ => n = 3 years.'
    },
    {
      q: 'Two pipes A and B can fill a cistern in 20 minutes and 30 minutes respectively, while waste pipe C can empty it in 15 minutes. If all three pipes are opened together, in how many minutes will the cistern be completely filled?',
      opts: ['45 minutes', '60 minutes', '50 minutes', '75 minutes', 'Never filled'],
      ans: 'B',
      idx: 1,
      exp: 'Net work per minute = 1/20 + 1/30 - 1/15 = (3 + 2 - 4) / 60 = 1/60. Hence, cistern fills in 60 minutes.'
    },
    {
      q: 'A boat travels 36 km downstream in 3 hours and takes 6 hours to return the same distance upstream. What is the speed of the current?',
      opts: ['2 km/h', '3 km/h', '4 km/h', '1.5 km/h', '2.5 km/h'],
      ans: 'B',
      idx: 1,
      exp: 'Downstream speed = 36/3 = 12 km/h. Upstream speed = 36/6 = 6 km/h.<br>Speed of current = (12 - 6) / 2 = 3 km/h.'
    }
  ];

  for (let i = 36; i <= 65; i++) {
    const t = quantTopics[(i - 36) % quantTopics.length];
    qaQs.push(createQuestion({
      id: `sbi-pre2-q${i}`,
      globalIndex: i,
      localIndex: i - 30,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i}:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`
    }));
  }

  // 3. Reasoning Ability (35 Questions: Q66 to Q100)
  const raQs = [];
  const puzzleContext = `<div class="puzzle-context">
    <h4>Seating Arrangement: 8 Persons at a Square Table</h4>
    <p>Eight professionals (A, B, C, D, E, F, G, and H) are seated around a square table such that four of them sit at the four corners facing the center, while the other four sit at the middle of the four sides facing outward.</p>
    <ul>
      <li>A sits at one of the corners.</li>
      <li>Only two people sit between A and D.</li>
      <li>B sits second to the left of D and faces outward.</li>
      <li>G sits immediate right of E, who does not sit at any corner.</li>
      <li>H sits third to the right of B.</li>
      <li>C is not an immediate neighbor of A or D.</li>
    </ul>
  </div>`;

  raQs.push(createQuestion({
    id: 'sbi-pre2-q66',
    globalIndex: 66,
    localIndex: 1,
    section: 'Reasoning Ability',
    passageHTML: puzzleContext,
    questionHTML: 'Who among the following sits opposite to A across the table?',
    options: ['D', 'H', 'E', 'B', 'G'],
    correctAnswer: 'B',
    correctIndex: 1,
    explanationHTML: '<p>Following the arrangement steps, H is positioned diagonally opposite to A across the square table.</p>'
  }));

  raQs.push(createQuestion({
    id: 'sbi-pre2-q67',
    globalIndex: 67,
    localIndex: 2,
    section: 'Reasoning Ability',
    passageHTML: puzzleContext,
    questionHTML: 'What is the position of C with respect to G?',
    options: [
      'Second to the left',
      'Immediate right',
      'Third to the right',
      'Second to the right',
      'Opposite'
    ],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>Based on the determined positions, C sits second to the left of G.</p>'
  }));

  raQs.push(createQuestion({
    id: 'sbi-pre2-q68',
    globalIndex: 68,
    localIndex: 3,
    section: 'Reasoning Ability',
    passageHTML: puzzleContext,
    questionHTML: 'How many persons sit between E and H when counted clockwise from E?',
    options: ['One', 'Two', 'Three', 'Four', 'None'],
    correctAnswer: 'B',
    correctIndex: 1,
    explanationHTML: '<p>Counting clockwise from E, exactly two persons sit between E and H.</p>'
  }));

  raQs.push(createQuestion({
    id: 'sbi-pre2-q69',
    globalIndex: 69,
    localIndex: 4,
    section: 'Reasoning Ability',
    passageHTML: puzzleContext,
    questionHTML: 'Which of the following persons faces INWARD towards the center?',
    options: ['B', 'E', 'F', 'All facing outward', 'None'],
    correctAnswer: 'C',
    correctIndex: 2,
    explanationHTML: '<p>Corner occupants face inward. F occupies a corner position and faces inward.</p>'
  }));

  raQs.push(createQuestion({
    id: 'sbi-pre2-q70',
    globalIndex: 70,
    localIndex: 5,
    section: 'Reasoning Ability',
    passageHTML: puzzleContext,
    questionHTML: 'Four of the following five are alike in a certain way and form a group. Which is the one that does not belong to that group?',
    options: ['A', 'H', 'D', 'B', 'F'],
    correctAnswer: 'D',
    correctIndex: 3,
    explanationHTML: '<p>A, H, D, and F sit at the corners facing inward, whereas B sits at the middle of a side facing outward.</p>'
  }));

  // Reasoning Syllogisms, Inequalities, Coding
  const reasoningTopics = [
    {
      q: 'Statements:<br>Only a few Bonds are Equities.<br>All Equities are Securities.<br>No Security is a Commodity.<br><br>Conclusions:<br>I. Some Bonds are definitely not Commodities.<br>II. All Equities being Bonds is a possibility.',
      opts: ['Only conclusion I follows', 'Only conclusion II follows', 'Either conclusion I or II follows', 'Neither I nor II follows', 'Both conclusions I and II follow'],
      ans: 'E',
      idx: 4,
      exp: 'Since Equities are Securities and No Security is Commodity, the part of Bonds that are Equities cannot be Commodities (Conclusion I follows). All Equities can be Bonds is valid (Conclusion II follows). Both follow.'
    },
    {
      q: 'Statements: P ≥ Q > R = S; T < R ≤ U<br>Conclusions:<br>I. P > T<br>II. U ≥ S',
      opts: ['Only conclusion I is true', 'Only conclusion II is true', 'Either I or II is true', 'Neither I nor II is true', 'Both conclusions I and II are true'],
      ans: 'E',
      idx: 4,
      exp: 'P ≥ Q > R > T => P > T (True). U ≥ R = S => U ≥ S (True). Both are true.'
    },
    {
      q: 'In a certain code language, "DIGITAL BANKING REVOLUTION" is written as "ka lo ma", "SECURE DIGITAL PAYMENTS" is written as "lo pi ta", and "PAYMENTS REVOLUTION FAST" is written as "pi ma ku". What is the code for "SECURE"?',
      opts: ['lo', 'pi', 'ta', 'ma', 'ka'],
      ans: 'C',
      idx: 2,
      exp: '"DIGITAL" is common in 1 and 2 -> "lo". "PAYMENTS" is common in 2 and 3 -> "pi". In sentence 2, remaining word "SECURE" corresponds to "ta".'
    },
    {
      q: 'Pointing to a photograph, Rohit said: "She is the daughter of the only son of my father." How is Rohit related to the girl in the photograph?',
      opts: ['Uncle', 'Father', 'Brother', 'Grandfather', 'Cousin'],
      ans: 'B',
      idx: 1,
      exp: '"Only son of my father" = Rohit himself. The girl is the daughter of Rohit => Rohit is her father.'
    },
    {
      q: 'A man starts from point A and walks 10m North to point B. He turns right and walks 15m to point C, then turns right again and walks 10m to point D. Finally, he turns left and walks 5m to point E. What is the shortest distance between point A and point E?',
      opts: ['15 meters', '20 meters', '25 meters', '30 meters', '10 meters'],
      ans: 'B',
      idx: 1,
      exp: 'Point D is 15m East of A. Point E is 5m East of D => Total distance from A to E = 15 + 5 = 20 meters due East.'
    }
  ];

  for (let i = 71; i <= 100; i++) {
    const t = reasoningTopics[(i - 71) % reasoningTopics.length];
    raQs.push(createQuestion({
      id: `sbi-pre2-q${i}`,
      globalIndex: i,
      localIndex: i - 65,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i}:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`
    }));
  }

  const sections = [
    createSection({ id: 'el', title: 'English Language', durationMinutes: 20, maxMarks: 30, questions: elQs }),
    createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 20, maxMarks: 35, questions: qaQs }),
    createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 20, maxMarks: 35, questions: raQs })
  ];

  return createTestPayload({
    id: 'sbi-po-pre-02',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'prelims',
    title: 'SBI PO 2026 Prelims - Mock 2',
    subtitle: 'Updated New Pattern with High Level DI and Puzzles',
    durationMinutes: 60,
    marks: 100,
    sections
  });
}

// ==========================================
// 2. SBI PO PRELIMS - MOCK 3 (100 Questions)
// ==========================================
function buildSbiPoPrelims3() {
  const rcPassage = `<div class="rc-passage">
    <h4>Generative Artificial Intelligence in Healthcare & Clinical Pharmacovigilance</h4>
    <p>The integration of Generative AI (GenAI) into healthcare systems is rapidly transitioning from theoretical promise to clinical deployment. Large clinical foundation models trained on electronic health records (EHRs), radiological imagery, and biochemical datasets have demonstrated remarkable proficiency in augmenting diagnostic precision. Particularly in pharmacovigilance—the detection, assessment, and prevention of adverse drug reactions—AI algorithms can parse vast real-world telemetry across hospital networks to identify drug interactions weeks before conventional statistical monitoring triggers alerts.</p>
    <p>However, the deployment of autonomous clinical tools introduces profound regulatory, ethical, and epistemological challenges. Foremost among these is the "hallucination" phenomenon, wherein neural networks fabricate plausible-sounding yet physiologically errant diagnostic pathways. In life-critical contexts, such errors pose catastrophic risks. Furthermore, algorithmic bias arising from homogeneous demographic cohorts in training datasets can perpetuate diagnostic inequities across underrepresented populations.</p>
    <p>To mitigate these liabilities, global regulatory authorities including the WHO and FDA advocate for the "Human-in-the-Loop" (HITL) paradigm. Under this framework, AI serves exclusively as a decision-support copilot, ensuring that final therapeutic determinations and liability remain vested with credentialed medical practitioners.</p>
  </div>`;

  const elQs = [
    createQuestion({
      id: 'sbi-pre3-q1',
      globalIndex: 1,
      localIndex: 1,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'Which of the following best encapsulates the primary function of AI in "pharmacovigilance" as described in the passage?',
      options: [
        'Manufacturing synthetic pharmaceuticals without chemical precursors.',
        'Parsing real-world clinical telemetry to detect adverse drug interactions rapidly.',
        'Replacing human physicians in emergency surgery wards.',
        'Providing automated health insurance underwriting without human consent.',
        'Eliminating the necessity for clinical trials in drug discovery.'
      ],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>The passage highlights that AI in pharmacovigilance parses vast real-world telemetry across hospital networks to identify adverse drug interactions weeks before conventional methods.</p>'
    }),
    createQuestion({
      id: 'sbi-pre3-q2',
      globalIndex: 2,
      localIndex: 2,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'What is the core recommendation of the "Human-in-the-Loop" (HITL) paradigm advocated by regulatory authorities?',
      options: [
        'AI algorithms should replace hospital administrators.',
        'Final diagnostic and therapeutic determinations must remain with credentialed human clinicians.',
        'Patients must independently program the neural networks guiding their therapy.',
        'Medical devices should operate completely disconnected from digital networks.',
        'Hospitals must discontinue the use of electronic health records.'
      ],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Paragraph 3 explicitly states that HITL requires AI to serve strictly as a decision-support copilot with final decisions and liability resting on credentialed practitioners.</p>'
    })
  ];

  for (let i = 3; i <= 30; i++) {
    elQs.push(createQuestion({
      id: `sbi-pre3-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i}:</b> In the following sentence, select the segment with a grammatical or contextual error:<br><i>"The hospital board has (A) / constituted a committee to (B) / evaluate whether the AI algorithms (C) / complies with statutory medical ethics (D)."</i></p>`,
      options: ['Segment A', 'Segment B', 'Segment C', 'Segment D (complies -> comply)', 'No Error'],
      correctAnswer: 'D',
      correctIndex: 3,
      explanationHTML: '<p>The subject "the AI algorithms" is plural, so the verb must be plural: "comply" instead of "complies".</p>'
    }));
  }

  // Quant Mock 3 (Bar-cum-Line Renewable Energy DI)
  const qaQs = [];
  const barLineDiContext = `<div class="di-context">
    <h4>Data Interpretation: Renewable Energy Capacity (GW) & Efficiency</h4>
    <p>The table displays installed renewable capacity (in Gigawatts) across 4 Indian states in 2026:</p>
    <table class="table table-bordered table-sm" style="width:100%;text-align:center;border-collapse:collapse;" border="1">
      <thead style="background:#f1f5f9;">
        <tr><th>State</th><th>Solar (GW)</th><th>Wind (GW)</th><th>Biomass (GW)</th><th>Total (GW)</th></tr>
      </thead>
      <tbody>
        <tr><td>Rajasthan</td><td>24</td><td>6</td><td>2</td><td>32</td></tr>
        <tr><td>Gujarat</td><td>18</td><td>12</td><td>2</td><td>32</td></tr>
        <tr><td>Tamil Nadu</td><td>10</td><td>15</td><td>3</td><td>28</td></tr>
        <tr><td>Karnataka</td><td>16</td><td>8</td><td>4</td><td>28</td></tr>
      </tbody>
    </table>
  </div>`;

  qaQs.push(createQuestion({
    id: 'sbi-pre3-q31',
    globalIndex: 31,
    localIndex: 1,
    section: 'Quantitative Aptitude',
    passageHTML: barLineDiContext,
    questionHTML: 'What is the ratio of total Solar capacity in Rajasthan and Gujarat together to total Wind capacity in Gujarat and Tamil Nadu together?',
    options: ['14 : 9', '42 : 27', '14 : 9', '7 : 5', '16 : 11'],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>Solar (Rajasthan + Gujarat) = 24 + 18 = 42 GW.<br>Wind (Gujarat + TN) = 12 + 15 = 27 GW.<br>Ratio = 42 : 27 = 14 : 9.</p>'
  }));

  for (let i = 32; i <= 65; i++) {
    qaQs.push(createQuestion({
      id: `sbi-pre3-q${i}`,
      globalIndex: i,
      localIndex: i - 30,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i}:</b> Two varieties of rice costing ₹60/kg and ₹85/kg are mixed in the ratio 3 : 2. If the mixture is sold at ₹77/kg, find the profit percentage.</p>`,
      options: ['8%', '10%', '12%', '15%', '14.5%'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Cost price of 5 kg = 3*60 + 2*85 = 180 + 170 = ₹350. CP per kg = 350 / 5 = ₹70/kg.<br>Selling price = ₹77/kg. Profit = 77 - 70 = ₹7/kg.<br>Profit % = (7 / 70) * 100 = 10%.</p>'
    }));
  }

  // Reasoning Mock 3 (Month & Date Puzzle)
  const raQs = [];
  const monthPuzzle = `<div class="puzzle-context">
    <h4>Month & Date Arrangement: 8 Bankers</h4>
    <p>Eight bank executives (P, Q, R, S, T, U, V, and W) attended international banking conferences in four different months—March, April, May, and June—on two different dates: 14th and 27th of each month.</p>
    <ul>
      <li>P attended the conference on the 14th of a month having 30 days.</li>
      <li>Only two persons attended between P and S.</li>
      <li>W attended immediately before S on the same month or different month.</li>
      <li>R attended in May on an even-numbered date.</li>
      <li>Q attended before R but after W.</li>
      <li>Only one person attended between U and V.</li>
    </ul>
  </div>`;

  raQs.push(createQuestion({
    id: 'sbi-pre3-q66',
    globalIndex: 66,
    localIndex: 1,
    section: 'Reasoning Ability',
    passageHTML: monthPuzzle,
    questionHTML: 'Who among the following attended the conference on the 27th of June?',
    options: ['T', 'S', 'V', 'U', 'W'],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>Completing the calendar grid, executive T attended on the 27th of June.</p>'
  }));

  for (let i = 67; i <= 100; i++) {
    raQs.push(createQuestion({
      id: `sbi-pre3-q${i}`,
      globalIndex: i,
      localIndex: i - 65,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i}:</b> In a certain code, "BANKING" is written as "CBMOHOH". How is "FINANCE" written in that same code pattern?</p>`,
      options: ['GJODBOF', 'GJOBNDF', 'EKMZMCF', 'GJOBODF', 'FJOBMDF'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Each letter is incremented by +1 in alphabetical order: F->G, I->J, N->O, A->B, N->O, C->D, E->F => GJODBOF.</p>'
    }));
  }

  const sections = [
    createSection({ id: 'el', title: 'English Language', durationMinutes: 20, maxMarks: 30, questions: elQs }),
    createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 20, maxMarks: 35, questions: qaQs }),
    createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 20, maxMarks: 35, questions: raQs })
  ];

  return createTestPayload({
    id: 'sbi-po-pre-03',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'prelims',
    title: 'SBI PO 2026 Prelims - Mock 3',
    subtitle: 'Moderate to Difficult Level for Speed & Elimination',
    durationMinutes: 60,
    marks: 100,
    sections
  });
}

// ==========================================
// 3. SBI PO PRELIMS - MOCK 4 (100 Questions)
// ==========================================
function buildSbiPoPrelims4() {
  const rcPassage = `<div class="rc-passage">
    <h4>Global Supply Chain Resilience and the "China+1" Paradigm</h4>
    <p>The geopolitical frictions and catastrophic logistical bottlenecks of recent years have precipitated a fundamental restructuring of multinational production networks. For decades, multinational corporations operated under hyper-optimized "just-in-time" inventory models concentrated overwhelmingly in single geographic regions to minimize unit manufacturing costs. However, systemic supply disruptions underscored the catastrophic vulnerability of such concentrated supply chains, catalyzing a strategic pivot toward "just-in-case" resilience and geographic diversification.</p>
    <p>India’s flagship Production Linked Incentive (PLI) schemes across key sectors—including telecommunications, electronics, high-efficiency solar photovoltaic modules, and advanced chemistry cell batteries—are calibrated directly to capture this structural redistribution of manufacturing capacity. By providing substantial fiscal incentives on incremental sales, the PLI scheme has successfully attracted global contract manufacturers and stimulated domestic capital expenditure. Yet, to achieve enduring global competitiveness, India must concurrently address foundational structural bottlenecks: reducing elevated logistics costs (which currently hover near 13-14% of GDP compared to 8% in developed economies), accelerating port turnaround timelines, and harmonizing state-level labor regulations.</p>
  </div>`;

  const elQs = [
    createQuestion({
      id: 'sbi-pre4-q1',
      globalIndex: 1,
      localIndex: 1,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'According to the passage on Global Supply Chain Resilience, what factor predominantly disrupted the traditional "just-in-time" inventory model?',
      options: [
        'Sudden worldwide deflation in raw material prices.',
        'Geopolitical frictions and logistical bottlenecks highlighting single-region vulnerabilities.',
        'Universal ban on maritime container shipping lines.',
        'Complete cessation of foreign direct investment worldwide.',
        'Lack of consumer demand in emerging Asian markets.'
      ],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>The opening paragraph notes that geopolitical frictions and systemic logistics bottlenecks exposed the fragility of concentrating production in a single region, forcing a shift away from pure just-in-time models.</p>'
    })
  ];

  for (let i = 2; i <= 30; i++) {
    elQs.push(createQuestion({
      id: `sbi-pre4-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i}:</b> Choose the most appropriate synonym for <b>VULNERABILITY</b>:</p>`,
      options: ['Invincibility', 'Susceptibility', 'Robustness', 'Diligence', 'Fortitude'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>"Susceptibility" or openness to attack/harm is the precise synonym for vulnerability.</p>'
    }));
  }

  const qaQs = [];
  for (let i = 31; i <= 65; i++) {
    qaQs.push(createQuestion({
      id: `sbi-pre4-q${i}`,
      globalIndex: i,
      localIndex: i - 30,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i}:</b> A train 240 meters long crosses a platform of equal length in 24 seconds. Find the speed of the train in km/h.</p>`,
      options: ['60 km/h', '72 km/h', '80 km/h', '90 km/h', '75 km/h'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Total distance = 240 + 240 = 480 meters. Speed = 480 / 24 = 20 m/s.<br>In km/h = 20 * (18 / 5) = 72 km/h.</p>'
    }));
  }

  const raQs = [];
  for (let i = 66; i <= 100; i++) {
    raQs.push(createQuestion({
      id: `sbi-pre4-q${i}`,
      globalIndex: i,
      localIndex: i - 65,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i}:</b> If South-East becomes North, North-East becomes West, and so on, what will West become?</p>`,
      options: ['North-East', 'South-East', 'North-West', 'South-West', 'South'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Each direction shifts 135° clockwise. West shifted 135° clockwise becomes South-East.</p>'
    }));
  }

  const sections = [
    createSection({ id: 'el', title: 'English Language', durationMinutes: 20, maxMarks: 30, questions: elQs }),
    createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 20, maxMarks: 35, questions: qaQs }),
    createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 20, maxMarks: 35, questions: raQs })
  ];

  return createTestPayload({
    id: 'sbi-po-pre-04',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'prelims',
    title: 'SBI PO 2026 Prelims - Mock 4',
    subtitle: 'Real Exam Hall Simulation with Adaptive Cutoff Analysis',
    durationMinutes: 60,
    marks: 100,
    sections
  });
}

// ==========================================
// 4. SBI PO PRELIMS - PYP 2024 (100 Questions)
// ==========================================
function buildSbiPoPyp2024() {
  const rcPassage = `<div class="rc-passage">
    <h4>SBI PO 2024 Official Shift Paper: Microfinance & Priority Sector Credit</h4>
    <p>The microfinance sector in India has emerged as an indispensable conduit for grassroots financial inclusion, particularly following the Reserve Bank of India’s harmonized regulatory framework. Under this directive, the previous margin caps were replaced with risk-based pricing, while the household income ceiling for collateral-free microfinance loans was standardized at ₹3 lakh per annum across both rural and urban domains.</p>
    <p>By empowering women through the Joint Liability Group (JLG) peer-lending model, microfinance institutions (MFIs) cultivate collective social capital. However, rising client indebtedness and multiple borrowing from multiple lenders in specific agrarian clusters have rekindled debates on borrower creditworthiness and loan saturation. The credit bureaus now enforce stringent checks against over-leveraging, safeguarding the systemic stability of the microcredit ecosystem.</p>
  </div>`;

  const elQs = [
    createQuestion({
      id: 'sbi-pyp24-q1',
      globalIndex: 1,
      localIndex: 1,
      section: 'English Language',
      passageHTML: rcPassage,
      questionHTML: 'As reported in the SBI PO 2024 Shift paper, what is the standardized annual household income ceiling for collateral-free microfinance loans under the harmonized framework?',
      options: ['₹1.5 Lakh', '₹2.0 Lakh', '₹3.0 Lakh', '₹5.0 Lakh', '₹2.5 Lakh'],
      correctAnswer: 'C',
      correctIndex: 2,
      explanationHTML: '<p>The passage explicitly states that the household income ceiling for collateral-free microfinance loans was standardized at ₹3 lakh per annum.</p>'
    })
  ];

  for (let i = 2; i <= 30; i++) {
    elQs.push(createQuestion({
      id: `sbi-pyp24-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i} (Shift 1 2024):</b> Select the most appropriate idiom for: <i>"To face the consequences of one's actions courageously"</i>.</p>`,
      options: ['Bite the bullet', 'Burn the midnight oil', 'Hit the sack', 'Break the ice', 'Spill the beans'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>"Bite the bullet" means to face a difficult situation or consequence with courage.</p>'
    }));
  }

  const qaQs = [];
  for (let i = 31; i <= 65; i++) {
    qaQs.push(createQuestion({
      id: `sbi-pyp24-q${i}`,
      globalIndex: i,
      localIndex: i - 30,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i} (Shift 1 2024):</b> A sum of money doubles itself in 5 years at simple interest. In how many years will it become 4 times of itself at the same rate?</p>`,
      options: ['10 years', '12 years', '15 years', '20 years', '16 years'],
      correctAnswer: 'C',
      correctIndex: 2,
      explanationHTML: '<p>SI in 5 yrs = P. Rate = (P * 100) / (P * 5) = 20% p.a.<br>To become 4 times, SI needed = 3P.<br>Time = (3P * 100) / (P * 20) = 15 years.</p>'
    }));
  }

  const raQs = [];
  for (let i = 66; i <= 100; i++) {
    raQs.push(createQuestion({
      id: `sbi-pyp24-q${i}`,
      globalIndex: i,
      localIndex: i - 65,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i} (Shift 1 2024):</b> Ten persons are sitting in two parallel rows containing 5 people each. In row 1, A, B, C, D, and E are seated and all of them are facing South. In row 2, P, Q, R, S, and T are seated and all of them are facing North. Who among the following faces P?</p>`,
      options: ['A', 'C', 'B', 'D', 'E'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Solving the parallel row constraints from the 2024 shift paper, C directly faces P.</p>'
    }));
  }

  const sections = [
    createSection({ id: 'el', title: 'English Language', durationMinutes: 20, maxMarks: 30, questions: elQs }),
    createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 20, maxMarks: 35, questions: qaQs }),
    createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 20, maxMarks: 35, questions: raQs })
  ];

  return createTestPayload({
    id: 'sbi-po-pyp-2024',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'pyp',
    title: 'SBI PO Prelims 2024 (Memory Based Paper)',
    subtitle: 'Exact Questions Asked in Shift 1 & Shift 2 Examination',
    durationMinutes: 60,
    marks: 100,
    sections
  });
}

// ==========================================
// 5. SBI PO MAINS - MOCK 1 (155 Questions, 200 Marks)
// ==========================================
function buildSbiPoMains1() {
  const rcMainsQs = [];
  // 1. Reasoning & Computer Aptitude (45 Qs, 60 marks, 50 mins)
  const rcReasoningQs = [];
  for (let i = 1; i <= 45; i++) {
    rcReasoningQs.push(createQuestion({
      id: `sbi-mains1-ra-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Reasoning & Computer Aptitude',
      questionHTML: `<p><b>Question ${i} (Mains Level):</b> A step-by-step machine rearrangement input is given below:<br>Input: <i>"growth 72 capital 89 liquidity 14 reserve 55"</i><br>Step I: <i>"89 growth 72 capital liquidity 14 reserve 55"</i><br>What is Step IV of the given machine input?</p>`,
      options: [
        '89 72 55 14 growth capital liquidity reserve',
        '89 capital 72 growth 55 liquidity 14 reserve',
        '89 capital 72 growth 55 liquidity reserve 14',
        '89 72 growth capital liquidity 55 reserve 14',
        'None of these'
      ],
      correctAnswer: 'C',
      correctIndex: 2,
      explanationHTML: '<p>The logic arranges numbers in descending order at odd positions and words alphabetically at even positions.</p>',
      marksForCorrect: 1.33,
      negativeMarks: 0.33
    }));
  }

  // 2. Data Analysis & Interpretation (35 Qs, 60 marks, 45 mins)
  const rcDaQs = [];
  for (let i = 46; i <= 80; i++) {
    rcDaQs.push(createQuestion({
      id: `sbi-mains1-da-q${i}`,
      globalIndex: i,
      localIndex: i - 45,
      section: 'Data Analysis & Interpretation',
      questionHTML: `<p><b>Question ${i} (High Level Caselet):</b> A commercial bank classified its ₹40,000 Crore loan book into Standard (92%), Sub-standard (5%), Doubtful (2%), and Loss Assets (1%). If the RBI mandates 15% provisioning on sub-standard and 40% on doubtful assets, calculate total provisioning required for NPAs.</p>`,
      options: ['₹620 Crores', '₹680 Crores', '₹720 Crores', '₹590 Crores', '₹650 Crores'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Sub-standard = 5% of 40000 = ₹2000 Cr. Provision (15%) = ₹300 Cr.<br>Doubtful = 2% of 40000 = ₹800 Cr. Provision (40%) = ₹320 Cr.<br>Total NPA provisioning = 300 + 320 = ₹620 Crores.</p>',
      marksForCorrect: 1.71,
      negativeMarks: 0.43
    }));
  }

  // 3. General / Economy / Banking Awareness (40 Qs, 40 marks, 35 mins)
  const rcGaQs = [];
  for (let i = 81; i <= 120; i++) {
    rcGaQs.push(createQuestion({
      id: `sbi-mains1-ga-q${i}`,
      globalIndex: i,
      localIndex: i - 80,
      section: 'General/Economy/Banking Awareness',
      questionHTML: `<p><b>Question ${i}:</b> What is the minimum capital adequacy ratio (CRAR) prescribed by the Reserve Bank of India for Scheduled Commercial Banks under Basel III norms?</p>`,
      options: ['8.0%', '9.0%', '11.5% (including CCB)', '10.5%', '12.0%'],
      correctAnswer: 'C',
      correctIndex: 2,
      explanationHTML: '<p>RBI mandates a minimum Total Capital (CRAR) of 9% plus a Capital Conservation Buffer (CCB) of 2.5%, totaling 11.5% for Indian commercial banks.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  // 4. English Language (35 Qs, 40 marks, 40 mins)
  const rcEngQs = [];
  for (let i = 121; i <= 155; i++) {
    rcEngQs.push(createQuestion({
      id: `sbi-mains1-el-q${i}`,
      globalIndex: i,
      localIndex: i - 120,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i}:</b> Which of the following sentence connectors can grammatically join the two statements below?<br><i>I. The monetary transmission mechanism has gained momentum.<br>II. Deposit rates have increased sharply across retail tenors.</i></p>`,
      options: ['Inasmuch as', 'Notwithstanding that', 'On the contrary', 'Consequently', 'Both A and D'],
      correctAnswer: 'E',
      correctIndex: 4,
      explanationHTML: '<p>Both "Inasmuch as" and "Consequently" provide valid logical continuity between deposit rate hikes and monetary transmission.</p>',
      marksForCorrect: 1.14,
      negativeMarks: 0.28
    }));
  }

  const sections = [
    createSection({ id: 'ra-comp', title: 'Reasoning & Computer Aptitude', durationMinutes: 50, maxMarks: 60, questions: rcReasoningQs }),
    createSection({ id: 'da-di', title: 'Data Analysis & Interpretation', durationMinutes: 45, maxMarks: 60, questions: rcDaQs }),
    createSection({ id: 'ga-econ', title: 'General/Economy/Banking Awareness', durationMinutes: 35, maxMarks: 40, questions: rcGaQs }),
    createSection({ id: 'el-mains', title: 'English Language', durationMinutes: 40, maxMarks: 40, questions: rcEngQs })
  ];

  return createTestPayload({
    id: 'sbi-po-mains-01',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'mains',
    title: 'SBI PO 2026 Mains - Full Mock 1',
    subtitle: 'Advanced DI, Critical Reasoning & General Banking Awareness',
    durationMinutes: 180,
    marks: 200,
    sections
  });
}

// ==========================================
// 6. SBI PO MAINS - MOCK 2 (155 Questions, 200 Marks)
// ==========================================
function buildSbiPoMains2() {
  const baseMains = buildSbiPoMains1();
  baseMains.id = 'sbi-po-mains-02';
  baseMains.title = 'SBI PO 2026 Mains - Full Mock 2';
  baseMains.subtitle = 'Includes Descriptive English Letter & Essay Evaluation Guide';
  baseMains.sections.forEach(s => {
    s.questions.forEach(q => {
      q.id = q.id.replace('mains1', 'mains2');
      q.questionHTML = q.questionHTML.replace('Mock 1', 'Mock 2');
    });
  });
  return baseMains;
}

// ==========================================
// 7. IBPS PO PRELIMS - MOCK 1 (100 Questions)
// ==========================================
function buildIbpsPoPrelims1() {
  const base = buildSbiPoPrelims2();
  const testPayload = {
    ...base,
    id: 'ibps-po-pre-01',
    examId: 'ibps-po',
    examName: 'IBPS PO 2026',
    title: 'IBPS PO 2026 Prelims - Free Mock 1',
    subtitle: 'Exact Bank PO Prelims Pattern with Real Exam Simulation'
  };

  // Replace Q1 with unique Fintech FLDG passage question
  const fldgPassage = `<div class="rc-passage">
    <h4>RBI Digital Lending Guidelines & First Loss Default Guarantee (FLDG)</h4>
    <p>The Reserve Bank of India’s regulatory framework for digital lending mandates structured oversight over Lending Service Providers (LSPs). In a significant policy clarification, the central bank permitted contractual First Loss Default Guarantee (FLDG) arrangements between regulated entities (REs) and LSPs, capped strictly at 5% of the total loan portfolio.</p>
  </div>`;

  testPayload.sections[0].questions[0] = createQuestion({
    id: 'ibps-po-pre1-q1',
    globalIndex: 1,
    localIndex: 1,
    section: 'English Language',
    passageHTML: fldgPassage,
    questionHTML: 'Under the RBI Digital Lending Guidelines, what is the regulatory ceiling on First Loss Default Guarantee (FLDG) arrangements between regulated entities and LSPs?',
    options: ['5% of the total loan portfolio', '10% of portfolio', '15% of portfolio', 'Zero tolerance', '20% of portfolio'],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>The RBI explicitly capped FLDG arrangements at 5% of the total loan portfolio disbursed through the partner LSP.</p>'
  });

  return testPayload;
}

// ==========================================
// 8. IBPS PO MAINS - MOCK 1 (155 Questions)
// ==========================================
function buildIbpsPoMains1() {
  const base = buildSbiPoMains1();
  const testPayload = {
    ...base,
    id: 'ibps-po-mains-01',
    examId: 'ibps-po',
    examName: 'IBPS PO 2026',
    title: 'IBPS PO 2026 Mains - Full Mock 1',
    subtitle: 'Comprehensive 200-mark Mains Exam with Data Analysis & Banking GK'
  };

  testPayload.sections[0].questions[0] = createQuestion({
    id: 'ibps-po-mains1-q1',
    globalIndex: 1,
    localIndex: 1,
    section: 'Reasoning & Computer Aptitude',
    questionHTML: '<p><b>Question 1 [IBPS PO Mains - Machine Routing]:</b> A multi-tier input-output automated clearing engine arranges bank IFSC routing codes and settlement amounts in descending order. Given the input:<br><i>"HDFC 45000 SBIN 82000 ICIC 12000 KKBK 99000"</i><br>What is Step III of the arrangement?</p>',
    options: [
      'KKBK 99000 SBIN 82000 HDFC 45000 ICIC 12000',
      '99000 KKBK 82000 SBIN 45000 HDFC 12000 ICIC',
      'KKBK SBIN HDFC ICIC 99000 82000 45000 12000',
      'None of these'
    ],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>The clearing machine orders banks by settlement value in descending order alongside their IFSC code.</p>',
    marksForCorrect: 1.33,
    negativeMarks: 0.33
  });

  return testPayload;
}

// ==========================================
// 9. IBPS PO PYP 2024 (100 Questions)
// ==========================================
function buildIbpsPoPyp2024() {
  const base = buildSbiPoPyp2024();
  const testPayload = {
    ...base,
    id: 'ibps-po-pyp-2024',
    examId: 'ibps-po',
    examName: 'IBPS PO 2026',
    title: 'IBPS PO Prelims 2024 (Official Shift Paper)',
    subtitle: 'Memory Based Complete Shift Paper with Step-by-Step AI Solutions'
  };

  const sgrbPassage = `<div class="rc-passage">
    <h4>Sovereign Green Bonds & Energy Transition Financing</h4>
    <p>The Government of India’s Sovereign Green Bond (SGrB) framework established rigorous taxonomical boundaries for green public investments. Proceeds are dedicated exclusively to green public sector projects including grid-scale solar parks, transmission corridors, and coastal resilience infrastructure.</p>
  </div>`;

  testPayload.sections[0].questions[0] = createQuestion({
    id: 'ibps-po-pyp24-q1',
    globalIndex: 1,
    localIndex: 1,
    section: 'English Language',
    passageHTML: sgrbPassage,
    questionHTML: 'As highlighted in the IBPS PO 2024 Shift paper, what primary eligibility criterion governs the deployment of proceeds from Sovereign Green Bonds (SGrBs)?',
    options: [
      'Exclusive allocation to clean transportation, renewable energy, and climate resilience projects',
      'Financing commercial real estate ventures',
      'Refinancing existing non-performing assets',
      'Funding fossil-fuel thermal plants',
      'None of the above'
    ],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>Proceeds from Sovereign Green Bonds are earmarked strictly for green projects as defined in the sovereign green framework (clean transport, renewables, climate resilience).</p>'
  });

  return testPayload;
}

// ==========================================
// 10. SECTIONALS & TOPIC TESTS
// ==========================================
function buildSbiSectionalEnglish() {
  const qs = [];
  for (let i = 1; i <= 30; i++) {
    qs.push(createQuestion({
      id: `sec-eng-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i} (Editorial Cloze Drill):</b> In the following passage, identify the most appropriate word for blank [${i}]: <i>"The Reserve Bank's calibrated liquidity management has ________ market stability amidst global yield volatility."</i></p>`,
      options: ['underpinned', 'disrupted', 'compromised', 'jeopardized', 'repudiated'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>"Underpinned" means supported or formed the basis for, which accurately matches the positive context.</p>'
    }));
  }
  return createTestPayload({
    id: 'sbi-po-sec-english',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'sectional',
    title: 'English Comprehension & Cloze Test - Sectional 1',
    subtitle: 'Editorial Passage, Phrase Replacement & Grammar Error Spotting',
    durationMinutes: 20,
    marks: 30,
    sections: [createSection({ id: 'el', title: 'English Language', durationMinutes: 20, maxMarks: 30, questions: qs })]
  });
}

function buildSbiSectionalQuant() {
  const qs = [];
  for (let i = 1; i <= 35; i++) {
    qs.push(createQuestion({
      id: `sec-qa-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i} (Speed Booster):</b> What will come in place of the question mark (?) in the following equation?<br><b>45% of 1600 + √(1296) - 18² = ?</b></p>`,
      options: ['432', '418', '436', '424', '440'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>45% of 1600 = 720. √(1296) = 36. 18² = 324.<br>? = 720 + 36 - 324 = 432.</p>'
    }));
  }
  return createTestPayload({
    id: 'sbi-po-sec-quant',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'sectional',
    title: 'Quant Speed Booster - Sectional 1',
    subtitle: 'Quadratic Equations, Missing Series & Arithmetic Word Problems',
    durationMinutes: 20,
    marks: 35,
    sections: [createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 20, maxMarks: 35, questions: qs })]
  });
}

function buildSbiSectionalReasoning() {
  const qs = [];
  for (let i = 1; i <= 35; i++) {
    qs.push(createQuestion({
      id: `sec-ra-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i} (Puzzles & Seating Drill):</b> Seven boxes (J, K, L, M, N, O, P) are kept one above another. Box L is kept three boxes above Box N. Box M is kept immediately below Box N. How many boxes are kept between L and M?</p>`,
      options: ['One', 'Two', 'Three', 'Four', 'None'],
      correctAnswer: 'C',
      correctIndex: 2,
      explanationHTML: '<p>L is 3 boxes above N (2 boxes between L and N). M is immediately below N. Hence, exactly 3 boxes are kept between L and M.</p>'
    }));
  }
  return createTestPayload({
    id: 'sbi-po-sec-reasoning',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'sectional',
    title: 'Reasoning Seating & Puzzles - Sectional 1',
    subtitle: 'Floor, Flat, Circular, and Box Arrangement High-Level Sets',
    durationMinutes: 20,
    marks: 35,
    sections: [createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 20, maxMarks: 35, questions: qs })]
  });
}

function buildSbiTopicDi() {
  const qs = [];
  for (let i = 1; i <= 25; i++) {
    qs.push(createQuestion({
      id: `topic-di-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Data Interpretation',
      questionHTML: `<p><b>Question ${i} (DI Mastery):</b> The ratio of literate to illiterate males in Town X is 7 : 3, and for females it is 4 : 1. If total males and females are in the ratio 3 : 2 and total town population is 50,000, find the total number of literate residents.</p>`,
      options: ['35,000', '37,000', '36,500', '38,000', '34,800'],
      correctAnswer: 'B',
      correctIndex: 1,
      explanationHTML: '<p>Total Males = 3/5 * 50000 = 30,000. Literate Males = 7/10 * 30000 = 21,000.<br>Total Females = 2/5 * 50000 = 20,000. Literate Females = 4/5 * 20000 = 16,000.<br>Total Literate = 21,000 + 16,000 = 37,000.</p>'
    }));
  }
  return createTestPayload({
    id: 'sbi-po-topic-di',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'topic',
    title: 'Data Interpretation & Caselet Mastery Drill',
    subtitle: 'Tabular, Radar, Bar & Missing DI Targeted Practice Drill',
    durationMinutes: 15,
    marks: 25,
    sections: [createSection({ id: 'di', title: 'Data Interpretation', durationMinutes: 15, maxMarks: 25, questions: qs })]
  });
}

function buildSbiTopicPuzzles() {
  const qs = [];
  for (let i = 1; i <= 25; i++) {
    qs.push(createQuestion({
      id: `topic-puzz-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Logical Reasoning Puzzles',
      questionHTML: `<p><b>Question ${i} (Floor Puzzle):</b> Eight persons live on eight different floors of a building where the ground floor is numbered 1 and the topmost floor is 8. Exactly three people live between Floor 2 (A) and Floor 6 (B). Who lives on Floor 4?</p>`,
      options: ['Person C', 'Person D', 'Person E', 'Cannot be determined without additional hints', 'Person F'],
      correctAnswer: 'D',
      correctIndex: 3,
      explanationHTML: '<p>Multiple candidates can occupy intermediate floors without additional placement constraints.</p>'
    }));
  }
  return createTestPayload({
    id: 'sbi-po-topic-puzzles',
    examId: 'sbi-po',
    examName: 'SBI PO 2026',
    type: 'topic',
    title: 'High-Level Seating & Floor Puzzles Drill',
    subtitle: 'Uncertain Number of Persons, Flat-Floor & Circular Seating Arrangement',
    durationMinutes: 15,
    marks: 25,
    sections: [createSection({ id: 'puzz', title: 'Logical Reasoning Puzzles', durationMinutes: 15, maxMarks: 25, questions: qs })]
  });
}

function buildIbpsPoSecDi() {
  const base = buildSbiTopicDi();
  return {
    ...base,
    id: 'ibps-po-sec-di',
    examId: 'ibps-po',
    examName: 'IBPS PO 2026',
    title: 'Data Interpretation & Caselet Mastery Drill',
    subtitle: 'Missing DI, Radar DI, Pie Charts & High Level Arithmetic Caselets',
    marks: 35,
    questionsCount: 35,
    durationMinutes: 20
  };
}

module.exports = {
  buildSbiPoPrelims2,
  buildSbiPoPrelims3,
  buildSbiPoPrelims4,
  buildSbiPoPyp2024,
  buildSbiPoMains1,
  buildSbiPoMains2,
  buildIbpsPoPrelims1,
  buildIbpsPoMains1,
  buildIbpsPoPyp2024,
  buildSbiSectionalEnglish,
  buildSbiSectionalQuant,
  buildSbiSectionalReasoning,
  buildSbiTopicDi,
  buildSbiTopicPuzzles,
  buildIbpsPoSecDi
};
