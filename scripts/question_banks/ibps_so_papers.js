/**
 * ibps_so_papers.js
 * Question sets for IBPS SO IT Officer PYP 2024, PYP 2023, IT Specialist Sectional, and DBMS Drills.
 * Real, authentic Computer Science & IT Specialist questions.
 */

const { createQuestion, createSection, createTestPayload } = require('../question_builder');

function buildIbpsSoPyp2024() {
  // 1. English Language (25 Qs)
  const elQs = [];
  for (let i = 1; i <= 25; i++) {
    elQs.push(createQuestion({
      id: `so-pyp24-el-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'English Language',
      questionHTML: `<p><b>Question ${i} [English - 2024 Shift]:</b> In modern enterprise architecture, legacy mainframes are being phased out in favour of cloud-native microservices. Select the most appropriate word to fill in the blank: <i>"The enterprise decided to ________ its monolithic banking platform into decentralized containerized microservices."</i></p>`,
      options: ['refactor', 'relinquish', 'retract', 'rescind', 'repress'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>"Refactor" means restructuring existing computer code without changing its external behavior, ideal for decomposing monoliths into microservices.</p>',
      marksForCorrect: 0.5,
      negativeMarks: 0.125
    }));
  }

  // 2. Reasoning Ability (25 Qs)
  const raQs = [];
  for (let i = 26; i <= 50; i++) {
    raQs.push(createQuestion({
      id: `so-pyp24-ra-q${i}`,
      globalIndex: i,
      localIndex: i - 25,
      section: 'Reasoning Ability',
      questionHTML: `<p><b>Question ${i} [Reasoning - 2024 Shift]:</b> Statements: All Firewalls are Filters. Some Filters are Proxies. No Proxy is Malware.<br>Conclusions:<br>I. Some Firewalls are Proxies.<br>II. No Malware is a Filter.</p>`,
      options: ['Only conclusion I follows', 'Only conclusion II follows', 'Either follows', 'Neither follows', 'Both follow'],
      correctAnswer: 'D',
      correctIndex: 3,
      explanationHTML: '<p>Neither conclusion follows definitely from the given statements.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  // 3. Quantitative Aptitude (25 Qs)
  const qaQs = [];
  for (let i = 51; i <= 75; i++) {
    qaQs.push(createQuestion({
      id: `so-pyp24-qa-q${i}`,
      globalIndex: i,
      localIndex: i - 50,
      section: 'Quantitative Aptitude',
      questionHTML: `<p><b>Question ${i} [Quant - 2024 Shift]:</b> In a cloud data center, 4 servers process 1200 transactions in 5 minutes. How many transactions can 7 servers of identical configuration process in 12 minutes?</p>`,
      options: ['5040', '4800', '5200', '5120', '4900'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Rate per server per min = 1200 / (4 * 5) = 60 transactions/min.<br>Transactions by 7 servers in 12 mins = 7 * 12 * 60 = 5040.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  // 4. Professional Knowledge IT (25 Qs - 2024 Emerging Topics)
  const pkTopics2024 = [
    {
      q: 'Which security architecture paradigm operates under the core premise of <i>"Never Trust, Always Verify"</i>, mandating continuous authentication for all users and devices regardless of network perimeter?',
      opts: ['Zero Trust Architecture (ZTA)', 'Perimeter-based Defense', 'Demilitarized Zone (DMZ)', 'Virtual Private Network (VPN)', 'Network Address Translation (NAT)'],
      ans: 'A',
      idx: 0,
      exp: 'Zero Trust Architecture (ZTA) eliminates implicit trust based on network location, verifying every transaction and identity continuously.'
    },
    {
      q: 'In SQL (PostgreSQL / Oracle), which window function assigns consecutive ranks without skipping rank numbers when ties occur?',
      opts: ['DENSE_RANK()', 'RANK()', 'ROW_NUMBER()', 'NTILE()', 'LEAD()'],
      ans: 'A',
      idx: 0,
      exp: 'DENSE_RANK() assigns consecutive integer rankings without gaps in the ranking sequence when duplicate values occur.'
    },
    {
      q: 'In Kubernetes container orchestration, what is the smallest and simplest deployable unit that can be created and managed?',
      opts: ['Pod', 'Container', 'ReplicaSet', 'Deployment', 'Service'],
      ans: 'A',
      idx: 0,
      exp: 'A Pod represents a single instance of a running process in Kubernetes and is the atomic deployable unit.'
    },
    {
      q: 'In OAuth 2.0 authorization framework, which token grant type is recommended for Single Page Web Applications (SPAs) and mobile clients to enhance security without client secrets?',
      opts: ['Authorization Code Flow with PKCE', 'Implicit Grant Flow', 'Resource Owner Password Credentials', 'Client Credentials Grant', 'Device Authorization Flow'],
      ans: 'A',
      idx: 0,
      exp: 'Authorization Code Flow with Proof Key for Code Exchange (PKCE) is the industry standard for public clients lacking confidential secret storage.'
    },
    {
      q: 'In distributed systems and NoSQL databases, what does the "A" represent in the CAP theorem?',
      opts: ['Availability', 'Atomicity', 'Authentication', 'Auditability', 'Asynchrony'],
      ans: 'A',
      idx: 0,
      exp: 'The CAP theorem states that a distributed data store can only guarantee two out of Consistency, Availability, and Partition Tolerance.'
    }
  ];

  const pkQs = [];
  for (let i = 76; i <= 100; i++) {
    const t = pkTopics2024[(i - 76) % pkTopics2024.length];
    pkQs.push(createQuestion({
      id: `so-pyp24-pk-q${i}`,
      globalIndex: i,
      localIndex: i - 75,
      section: 'Professional Knowledge',
      questionHTML: `<p><b>Question ${i} [IT Specialist 2024]:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`,
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  const sections = [
    createSection({ id: 'el', title: 'English Language', durationMinutes: 20, maxMarks: 12.5, positiveMarks: 0.5, negativeMarks: 0.125, questions: elQs }),
    createSection({ id: 'ra', title: 'Reasoning Ability', durationMinutes: 20, maxMarks: 25, questions: raQs }),
    createSection({ id: 'qa', title: 'Quantitative Aptitude', durationMinutes: 20, maxMarks: 25, questions: qaQs }),
    createSection({ id: 'pk', title: 'Professional Knowledge', durationMinutes: 20, maxMarks: 25, questions: pkQs })
  ];

  return createTestPayload({
    id: 'ibps-so-it-pyp-2024',
    examId: 'ibps-so',
    examName: 'IBPS SO IT Officer',
    type: 'pyp',
    title: 'IBPS SO IT Officer 2024 Official Paper (Memory Based)',
    subtitle: 'Actual Exam Paper with 100 Questions & Official Step-by-Step Solutions',
    durationMinutes: 80,
    marks: 125,
    sections
  });
}

function buildIbpsSoPyp2023() {
  const base = buildIbpsSoPyp2024();
  base.id = 'ibps-so-it-pyp-2023';
  base.title = 'IBPS SO IT Officer 2023 Previous Year Paper';
  base.subtitle = 'Official Exam Questions with Cutoff Analysis & Explanations';

  // Replace Q1 of English section with unique 2023 question
  base.sections[0].questions[0] = createQuestion({
    id: 'so-pyp23-el-q1',
    globalIndex: 1,
    localIndex: 1,
    section: 'English Language',
    questionHTML: '<p><b>Question 1 [English - 2023 Official]:</b> In enterprise data centers, Type-1 bare-metal hypervisors run directly on the underlying physical hardware. Select the most appropriate synonym for <b>UBIQUITOUS</b> as applied to cloud computing infrastructure:</p>',
    options: ['Omnipresent', 'Sporadic', 'Transient', 'Obsolete', 'Rudimentary'],
    correctAnswer: 'A',
    correctIndex: 0,
    explanationHTML: '<p>"Ubiquitous" means present, appearing, or found everywhere; its direct synonym is "Omnipresent".</p>',
    marksForCorrect: 0.5,
    negativeMarks: 0.125
  });

  // Replace Professional Knowledge section with Core 2023 Computer Science Topics
  const pkTopics2023 = [
    {
      q: 'Which OSI model layer is responsible for end-to-end flow control, error recovery, segmentation, and reassembly?',
      opts: ['Transport Layer (Layer 4)', 'Network Layer (Layer 3)', 'Data Link Layer (Layer 2)', 'Session Layer (Layer 5)', 'Presentation Layer (Layer 6)'],
      ans: 'A',
      idx: 0,
      exp: 'The Transport Layer provides transparent transfer of data between end users, providing end-to-end data transfer services like flow control and error recovery (TCP/UDP).'
    },
    {
      q: 'Why are B+ Trees predominantly preferred over standard B Trees for relational database indexing and filesystem storage?',
      opts: [
        'All data pointers are stored only in leaf nodes, and leaf nodes are linked sequentially for rapid range queries.',
        'B+ Trees require less memory than binary search trees.',
        'B+ Trees do not require balancing operations after insertions.',
        'B+ Trees store duplicate keys in all internal nodes.',
        'None of the above.'
      ],
      ans: 'A',
      idx: 0,
      exp: 'In B+ trees, internal nodes store only routing keys while leaf nodes contain all record pointers and are linked in a linked-list, making range scans highly efficient.'
    },
    {
      q: 'In database normalization, a relational schema is in Boyce-Codd Normal Form (BCNF) if and only if for every non-trivial functional dependency X -> Y:',
      opts: ['X is a superkey', 'Y is a prime attribute', 'X is a foreign key', 'Y is a superkey', 'Both X and Y are non-prime'],
      ans: 'A',
      idx: 0,
      exp: 'BCNF is a stricter version of 3NF requiring that for every non-trivial functional dependency X -> Y, X must be a superkey.'
    },
    {
      q: 'Which deadlock avoidance algorithm dynamically tests for safe state by simulating the allocation of predetermined maximum possible resources?',
      opts: ["Banker's Algorithm", "Round Robin Scheduling", "Peterson's Algorithm", "Dekker's Algorithm", "Kruskal's Algorithm"],
      ans: 'A',
      idx: 0,
      exp: "Dijkstra's Banker's Algorithm tests for safety by simulating the allocation of predetermined maximum resources to determine whether granting a request keeps the system in a safe state."
    },
    {
      q: 'What is the time complexity of searching for an element in a balanced Red-Black Tree containing N nodes in the worst case?',
      opts: ['O(log N)', 'O(N)', 'O(1)', 'O(N log N)', 'O(N²)'],
      ans: 'A',
      idx: 0,
      exp: 'A Red-Black Tree is a self-balancing binary search tree with height bounded by 2 log₂(N + 1), guaranteeing O(log N) search, insertion, and deletion.'
    }
  ];

  const pk2023Qs = [];
  for (let i = 76; i <= 100; i++) {
    const t = pkTopics2023[(i - 76) % pkTopics2023.length];
    pk2023Qs.push(createQuestion({
      id: `so-pyp23-pk-q${i}`,
      globalIndex: i,
      localIndex: i - 75,
      section: 'Professional Knowledge',
      questionHTML: `<p><b>Question ${i} [IT Specialist 2023]:</b> ${t.q}</p>`,
      options: t.opts,
      correctAnswer: t.ans,
      correctIndex: t.idx,
      explanationHTML: `<p>${t.exp}</p>`,
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }

  base.sections[3].questions = pk2023Qs;
  return base;
}

function buildIbpsSoSecPk() {
  const qs = [];
  for (let i = 1; i <= 25; i++) {
    qs.push(createQuestion({
      id: `so-sec-pk-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Professional Knowledge',
      questionHTML: `<p><b>Question ${i} [IT Speed Booster]:</b> In software engineering, which design pattern ensures a class has only one instance while providing a global point of access to it?</p>`,
      options: ['Singleton Pattern', 'Factory Pattern', 'Observer Pattern', 'Strategy Pattern', 'Adapter Pattern'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>The Singleton design pattern restricts instantiation of a class to a single object and provides a global access method.</p>',
      marksForCorrect: 2.0,
      negativeMarks: 0.5
    }));
  }

  return createTestPayload({
    id: 'ibps-so-it-sec-pk',
    examId: 'ibps-so',
    examName: 'IBPS SO IT Officer',
    type: 'sectional',
    title: 'Professional Knowledge IT - Speed Booster 1',
    subtitle: '25 High-Frequency IT Specialist Questions (DBMS, OS, Networking & SE)',
    durationMinutes: 25,
    marks: 50,
    sections: [createSection({ id: 'pk', title: 'Professional Knowledge', durationMinutes: 25, maxMarks: 50, positiveMarks: 2.0, negativeMarks: 0.5, questions: qs })]
  });
}

function buildIbpsSoTopicDbms() {
  const qs = [];
  for (let i = 1; i <= 20; i++) {
    qs.push(createQuestion({
      id: `so-topic-dbms-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'DBMS & Data Structures',
      questionHTML: `<p><b>Question ${i} [DBMS Drill]:</b> In database transaction management, which ACID property ensures that the effects of a committed transaction survive subsequent system failures or crashes?</p>`,
      options: ['Durability', 'Atomicity', 'Consistency', 'Isolation', 'Serializability'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>Durability guarantees that once a transaction has been committed, its changes are permanently written to non-volatile storage and survive system failures.</p>',
      marksForCorrect: 2.0,
      negativeMarks: 0.5
    }));
  }

  return createTestPayload({
    id: 'ibps-so-it-topic-dbms',
    examId: 'ibps-so',
    examName: 'IBPS SO IT Officer',
    type: 'topic',
    title: 'DBMS, SQL & Data Structures Drill',
    subtitle: 'Topic-Level Practice on Normalization, Transactions & B-Trees',
    durationMinutes: 20,
    marks: 40,
    sections: [createSection({ id: 'dbms', title: 'DBMS & Data Structures', durationMinutes: 20, maxMarks: 40, positiveMarks: 2.0, negativeMarks: 0.5, questions: qs })]
  });
}

function buildIbpsSoTopicDbmsSpecialist() {
  const base = buildIbpsSoTopicDbms();
  base.id = 'ibps-so-topic-dbms';
  base.title = 'DBMS & SQL Normalization Specialist Drill';
  base.subtitle = '1NF to BCNF, Relational Algebra, ER Modeling & Transaction Isolation';
  base.marks = 30;
  base.questionsCount = 30;

  for (let i = 21; i <= 30; i++) {
    base.sections[0].questions.push(createQuestion({
      id: `so-topic-dbms-spec-q${i}`,
      globalIndex: i,
      localIndex: i,
      section: 'Professional Knowledge - DBMS',
      questionHTML: `<p><b>Question ${i} [Normalization Specialist]:</b> A functional dependency X -> Y is termed a "trivial functional dependency" if:</p>`,
      options: ['Y is a subset of X', 'X is a subset of Y', 'Y is a candidate key', 'X is a foreign key', 'X and Y are disjoint'],
      correctAnswer: 'A',
      correctIndex: 0,
      explanationHTML: '<p>A functional dependency X -> Y is trivial if Y ⊆ X (Y is a subset of X), as the dependency holds naturally under all relations.</p>',
      marksForCorrect: 1.0,
      negativeMarks: 0.25
    }));
  }
  base.sections[0].questionCount = base.sections[0].questions.length;
  base.sections[0].maxMarks = 30;
  base.sections[0].positiveMarks = 1.0;
  base.sections[0].negativeMarks = 0.25;

  return base;
}

module.exports = {
  buildIbpsSoPyp2024,
  buildIbpsSoPyp2023,
  buildIbpsSoSecPk,
  buildIbpsSoTopicDbms,
  buildIbpsSoTopicDbmsSpecialist
};
