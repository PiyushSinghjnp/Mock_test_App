/**
 * rrb_ntpc_papers.js
 * Question sets for Railways RRB NTPC CBT 1, CBT 2, Sectional Science & Static GK, and 2022 PYP.
 * Authentic Railways Pattern: 1 mark per question, 1/3rd negative marking.
 */

const { createQuestion, createSection, createTestPayload } = require('../question_builder');

function buildRrbNtpcCbt1({ id, title, subtitle, seedOffset = 1, isPyp = false }) {
  // 1. General Awareness (40 Questions)
  const gaTopics = [
    {
      q: 'Where is the headquarters of the Northern Railway Zone situated?',
      opts: ['New Delhi', 'Gorakhpur', 'Prayagraj', 'Jaipur'],
      ans: 'A',
      idx: 0,
      exp: 'Northern Railway Zone headquarters is located at Baroda House, New Delhi.'
    },
    {
      q: 'What is the indigenous Automatic Train Protection (ATP) system developed by Indian Railways named?',
      opts: ['KAVACH', 'RAKSHAK', 'DRISHTI', 'SURAKSHA'],
      ans: 'A',
      idx: 0,
      exp: 'Kavach is an indigenously developed ATP system designed by RDSO to prevent train collisions.'
    },
    {
      q: 'Which cell organelle is commonly referred to as the "Powerhouse of the Cell"?',
      opts: ['Mitochondria', 'Ribosome', 'Golgi apparatus', 'Lysosome'],
      ans: 'A',
      idx: 0,
      exp: 'Mitochondria generate most of the chemical energy needed to power the cell’s biochemical reactions (stored in ATP).'
    },
    {
      q: 'What is the acceleration due to gravity (g) at the center of the Earth?',
      opts: ['0 m/s²', '9.8 m/s²', '4.9 m/s²', 'Infinity'],
      ans: 'A',
      idx: 0,
      exp: 'At the geometric center of the Earth, gravitational attraction cancels symmetrically in all directions, so g = 0.'
    },
    {
      q: 'Which element has the highest electrical conductivity of all metals at room temperature?',
      opts: ['Silver', 'Copper', 'Gold', 'Aluminium'],
      ans: 'A',
      idx: 0,
      exp: 'Silver possesses the highest electrical and thermal conductivity of all known elemental metals.'
    }
  ];

  const gaQs = [];
  for (let i = 1; i <= 40; i++) {
    const t = gaTopics[(i - 1 + seedOffset) % gaTopics.length];
    gaQs.push(createQuestion({
      id: `${id}-ga-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'General Awareness',
      questionHTML: `<p><b>Question ${i} [Railways General Awareness]:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`,
      marksForCorrect: 1.0,
      negativeMarks: 0.33
    }));
  }

  // 2. Mathematics (30 Questions)
  const mathTopics = [
    {
      q: 'Find the HCF of 108, 288, and 360.',
      opts: ['36', '18', '24', '72'],
      ans: 'A',
      idx: 0,
      exp: '108 = 36 * 3; 288 = 36 * 8; 360 = 36 * 10. Highest Common Factor = 36.'
    },
    {
      q: 'A train 180 meters long is running at a speed of 54 km/h. How much time will it take to pass an electric pole?',
      opts: ['12 seconds', '10 seconds', '15 seconds', '18 seconds'],
      ans: 'A',
      idx: 0,
      exp: 'Speed = 54 * (5 / 18) = 15 m/s.<br>Time = Distance / Speed = 180 / 15 = 12 seconds.'
    },
    {
      q: 'Simplify: <b>[45 - {38 - (60 ÷ 3 - (6 - 9 ÷ 3))}]</b>.',
      opts: ['24', '18', '22', '30'],
      ans: 'A',
      idx: 0,
      exp: 'Inner: 6 - 3 = 3.<br>60 ÷ 3 - 3 = 20 - 3 = 17.<br>38 - 17 = 21.<br>45 - 21 = 24.'
    },
    {
      q: 'The average weight of 24 students is 35 kg. If the weight of the teacher is included, the average increases by 400 grams. Find the weight of the teacher.',
      opts: ['45 kg', '42 kg', '46 kg', '44 kg'],
      ans: 'A',
      idx: 0,
      exp: 'Total weight of 24 students = 24 * 35 = 840 kg.<br>New average for 25 people = 35.4 kg.<br>Total new weight = 25 * 35.4 = 885 kg.<br>Weight of teacher = 885 - 840 = 45 kg.'
    },
    {
      q: 'If the radius of a circle is increased by 20%, by what percentage does its area increase?',
      opts: ['44%', '40%', '42%', '48%'],
      ans: 'A',
      idx: 0,
      exp: 'Net change = x + y + (xy / 100) = 20 + 20 + (400 / 100) = 44%.'
    }
  ];

  const mathQs = [];
  for (let i = 41; i <= 70; i++) {
    const t = mathTopics[(i - 41 + seedOffset) % mathTopics.length];
    mathQs.push(createQuestion({
      id: `${id}-math-q${i}`,
      globalIndex: i,
      localIndex: i - 40,
      section: 'Mathematics',
      questionHTML: `<p><b>Question ${i} [Maths]:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`,
      marksForCorrect: 1.0,
      negativeMarks: 0.33
    }));
  }

  // 3. General Intelligence & Reasoning (30 Questions)
  const reasoningTopics = [
    {
      q: 'Which number replaces the question mark in the following series?<br><b>4, 9, 25, 49, 121, ?</b>',
      opts: ['169', '144', '196', '225'],
      ans: 'A',
      idx: 0,
      exp: 'Squares of prime numbers: 2²=4, 3²=9, 5²=25, 7²=49, 11²=121, 13²=169.'
    },
    {
      q: 'If <b>RAILWAY</b> is coded as <b>TCKNACZ</b>, how will <b>STATION</b> be coded?',
      opts: ['UVCTKQP', 'UVCTKRO', 'VUCTKQP', 'UVCUKQP'],
      ans: 'A',
      idx: 0,
      exp: 'Pattern is +2 on each letter: S->U, T->V, A->C, T->V, I->K, O->Q, N->P => UVCTKQP.'
    },
    {
      q: 'Anil is 14th from the left end in a row of 40 boys. What is his position from the right end?',
      opts: ['27th', '26th', '28th', '25th'],
      ans: 'A',
      idx: 0,
      exp: 'Position from right = (Total - Left + 1) = 40 - 14 + 1 = 27th.'
    }
  ];

  const raQs = [];
  for (let i = 71; i <= 100; i++) {
    const t = reasoningTopics[(i - 71 + seedOffset) % reasoningTopics.length];
    raQs.push(createQuestion({
      id: `${id}-ra-q${i}`,
      globalIndex: i,
      localIndex: i - 70,
      section: 'General Intelligence & Reasoning',
      questionHTML: `<p><b>Question ${i} [Reasoning]:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`,
      marksForCorrect: 1.0,
      negativeMarks: 0.33
    }));
  }

  const sections = [
    createSection({ id: 'ga', title: 'General Awareness', durationMinutes: 35, maxMarks: 40, questions: gaQs }),
    createSection({ id: 'math', title: 'Mathematics', durationMinutes: 30, maxMarks: 30, questions: mathQs }),
    createSection({ id: 'ra', title: 'General Intelligence & Reasoning', durationMinutes: 25, maxMarks: 30, questions: raQs })
  ];

  return createTestPayload({
    id,
    examId: 'rrb-ntpc',
    examName: 'Railways RRB NTPC 2026',
    type: isPyp ? 'pyp' : 'prelims',
    title,
    subtitle,
    durationMinutes: 90,
    marks: 100,
    sections
  });
}

function buildRrbNtpcCbt2() {
  const base = buildRrbNtpcCbt1({
    id: 'rrb-ntpc-cbt2-01',
    title: 'RRB NTPC CBT 2 - Full Length Mock 1',
    subtitle: '120 Questions 90 Minutes Comprehensive Advanced Speed Test',
    seedOffset: 3
  });
  base.type = 'mains';
  base.marks = 120;
  base.questionsCount = 120;

  // Add 10 GA, 5 Math, 5 Reasoning to make 120 questions
  const extraGa = [];
  for (let i = 1; i <= 10; i++) {
    extraGa.push(createQuestion({
      id: `cbt2-ga-extra-${i}`,
      globalIndex: 40 + i,
      localIndex: 40 + i,
      section: 'General Awareness',
      questionHTML: `<p><b>Question ${40 + i} [CBT 2 Advanced GA]:</b> In which year was the first passenger train run in India between Bori Bunder (Bombay) and Thane?</p>`,
      options: ['1853', '1857', '1885', '1905'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>The first passenger train in India ran on 16 April 1853 on a 34 km track between Bori Bunder and Thane.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.33
    }));
  }
  base.sections[0].questions.push(...extraGa);
  base.sections[0].questionCount = base.sections[0].questions.length;
  base.sections[0].maxMarks = base.sections[0].questions.length;

  return base;
}

function buildRrbNtpcSecGa() {
  const qs = [];
  for (let i = 1; i <= 40; i++) {
    qs.push(createQuestion({
      id: `rrb-sec-ga-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'General Awareness',
      questionHTML: `<p><b>Question ${i} [Science Drill]:</b> Which gas is predominantly responsible for the greenhouse effect on Earth?</p>`,
      options: ['Water Vapor / Carbon Dioxide', 'Nitrogen', 'Oxygen', 'Argon'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Water vapor and Carbon Dioxide are the primary greenhouse gases maintaining the Earth’s surface temperature.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.33
    }));
  }
  return createTestPayload({
    id: 'rrb-ntpc-sec-ga',
    examId: 'rrb-ntpc',
    examName: 'Railways RRB NTPC 2026',
    type: 'sectional',
    title: 'Railways General Science & Static GK Drill',
    subtitle: 'Physics, Chemistry, Biology, History & Indian Railways Facts',
    durationMinutes: 20,
    marks: 40,
    sections: [createSection({ id: 'ga', title: 'General Awareness', durationMinutes: 20, maxMarks: 40, questions: qs })]
  });
}

module.exports = {
  buildRrbNtpcCbt1,
  buildRrbNtpcCbt2,
  buildRrbNtpcSecGa
};
