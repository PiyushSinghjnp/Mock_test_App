/**
 * 2026 Official Exam Marking Scheme & Sectional Timing Registry + Auto-Applicator
 * Works in both Node.js (server.js / scripts) and Browser (window.OB_EXAM_PATTERNS_2026)
 *
 * Automatically stamps any uploaded Question Paper JSON with the exact 2026
 * sectional timings, section lock rules, and positive/negative marking scheme.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OB_EXAM_PATTERNS_2026 = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const EXAM_PATTERNS_2026 = {
    'sbi-po': {
      examId: 'sbi-po',
      examName: 'SBI PO 2026',
      category: 'Banking',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'SBI PO 2026 Prelims',
          totalQuestions: 100,
          totalMarks: 100,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'english-language', title: 'English Language', aliases: ['english', 'general english', 'english language', 'el'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'numerical ability', 'math', 'mathematics', 'qa'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability', 'logical reasoning', 'lr'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'SBI PO 2026 Mains',
          totalQuestions: 155,
          totalMarks: 200,
          totalDurationMinutes: 180,
          totalDurationSeconds: 10800,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.29, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'reasoning-computer', title: 'Reasoning & Computer Aptitude', aliases: ['reasoning', 'reasoning ability', 'reasoning & computer aptitude', 'reasoning and computer'], questionCount: 40, maxMarks: 60, positiveMarks: 1.5, negativeMarks: 0.375, durationMinutes: 50, durationSeconds: 3000, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'data-analysis', title: 'Data Analysis & Interpretation', aliases: ['data analysis', 'data interpretation', 'quant', 'quantitative aptitude', 'di'], questionCount: 30, maxMarks: 60, positiveMarks: 2.0, negativeMarks: 0.5, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'general-awareness', title: 'General/Economy/Banking Awareness', aliases: ['general awareness', 'banking awareness', 'economy', 'ga', 'gk'], questionCount: 50, maxMarks: 60, positiveMarks: 1.2, negativeMarks: 0.3, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language', 'general english'], questionCount: 35, maxMarks: 20, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 40, durationSeconds: 2400, language: 'English', isSectionalLocked: true }
          ]
        }
      }
    },

    'sbi-clerk': {
      examId: 'sbi-clerk',
      examName: 'SBI Clerk 2026',
      category: 'Banking',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'SBI Clerk 2026 Prelims',
          totalQuestions: 100,
          totalMarks: 100,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English', isSectionalLocked: true },
            { id: 'numerical-ability', title: 'Numerical Ability', aliases: ['numerical ability', 'quant', 'quantitative aptitude'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'SBI Clerk 2026 Mains',
          totalQuestions: 190,
          totalMarks: 200,
          totalDurationMinutes: 160,
          totalDurationSeconds: 9600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'general-awareness', title: 'General/Financial Awareness', aliases: ['general awareness', 'financial awareness', 'ga'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'general-english', title: 'General English', aliases: ['english', 'general english', 'english language'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'numerical ability'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'reasoning-computer', title: 'Reasoning Ability & Computer Aptitude', aliases: ['reasoning', 'reasoning ability', 'reasoning & computer'], questionCount: 50, maxMarks: 60, positiveMarks: 1.2, negativeMarks: 0.3, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'ibps-so': {
      examId: 'ibps-so',
      examName: 'IBPS SO IT Officer',
      category: 'Specialist Officer',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'IBPS SO 2026 Prelims',
          totalQuestions: 150,
          totalMarks: 125,
          totalDurationMinutes: 120,
          totalDurationSeconds: 7200,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 50, maxMarks: 25, positiveMarks: 0.5, negativeMarks: 0.125, durationMinutes: 40, durationSeconds: 2400, language: 'English', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 40, durationSeconds: 2400, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'general awareness'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 40, durationSeconds: 2400, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'IBPS SO IT Officer 2026 Mains',
          totalQuestions: 150,
          totalMarks: 150,
          totalDurationMinutes: 120,
          totalDurationSeconds: 7200,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language', 'general english'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 25, durationSeconds: 1500, language: 'English', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability', 'logical reasoning'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'data interpretation', 'numerical ability'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 25, durationSeconds: 1500, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'professional-knowledge', title: 'Professional Knowledge', aliases: ['professional knowledge', 'pk', 'it officer', 'computer', 'computer knowledge', 'specialist'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'ibps-po': {
      examId: 'ibps-po',
      examName: 'IBPS PO 2026',
      category: 'Banking',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'IBPS PO 2026 Prelims',
          totalQuestions: 100,
          totalMarks: 100,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'numerical ability'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'IBPS PO 2026 Mains',
          totalQuestions: 155,
          totalMarks: 200,
          totalDurationMinutes: 180,
          totalDurationSeconds: 10800,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'reasoning-computer', title: 'Reasoning & Computer Aptitude', aliases: ['reasoning', 'reasoning ability', 'reasoning & computer'], questionCount: 45, maxMarks: 60, positiveMarks: 1.33, negativeMarks: 0.25, durationMinutes: 60, durationSeconds: 3600, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'general-awareness', title: 'General/Economy/Banking Awareness', aliases: ['general awareness', 'banking awareness', 'ga'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 35, maxMarks: 40, positiveMarks: 1.14, negativeMarks: 0.25, durationMinutes: 40, durationSeconds: 2400, language: 'English', isSectionalLocked: true },
            { id: 'data-analysis', title: 'Data Analysis & Interpretation', aliases: ['data analysis', 'data interpretation', 'quant', 'quantitative aptitude'], questionCount: 35, maxMarks: 60, positiveMarks: 1.71, negativeMarks: 0.25, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'ibps-clerk': {
      examId: 'ibps-clerk',
      examName: 'IBPS Clerk 2026',
      category: 'Banking',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'IBPS Clerk 2026 Prelims',
          totalQuestions: 100,
          totalMarks: 100,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English', isSectionalLocked: true },
            { id: 'numerical-ability', title: 'Numerical Ability', aliases: ['numerical ability', 'quant', 'quantitative aptitude'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'IBPS Clerk 2026 Mains',
          totalQuestions: 190,
          totalMarks: 200,
          totalDurationMinutes: 160,
          totalDurationSeconds: 9600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'general-awareness', title: 'General/Financial Awareness', aliases: ['general awareness', 'ga'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'general-english', title: 'General English', aliases: ['english', 'general english', 'english language'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 35, durationSeconds: 2100, language: 'English', isSectionalLocked: true },
            { id: 'reasoning-computer', title: 'Reasoning Ability & Computer Aptitude', aliases: ['reasoning', 'reasoning ability'], questionCount: 50, maxMarks: 60, positiveMarks: 1.2, negativeMarks: 0.25, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'numerical ability'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'ibps-rrb-po': {
      examId: 'ibps-rrb-po',
      examName: 'IBPS RRB PO 2026',
      category: 'Regional Rural Bank',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'IBPS RRB PO 2026 Prelims',
          totalQuestions: 80,
          totalMarks: 80,
          totalDurationMinutes: 45,
          totalDurationSeconds: 2700,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'reasoning-ability', title: 'Reasoning', aliases: ['reasoning', 'reasoning ability'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 25, durationSeconds: 1500, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'numerical ability'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'IBPS RRB PO 2026 Mains',
          totalQuestions: 200,
          totalMarks: 200,
          totalDurationMinutes: 120,
          totalDurationSeconds: 7200,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'reasoning', title: 'Reasoning', aliases: ['reasoning', 'reasoning ability'], questionCount: 40, maxMarks: 50, positiveMarks: 1.25, negativeMarks: 0.31, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'computer-knowledge', title: 'Computer Knowledge', aliases: ['computer', 'computer knowledge', 'it'], questionCount: 40, maxMarks: 20, positiveMarks: 0.5, negativeMarks: 0.125, durationMinutes: 15, durationSeconds: 900, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'general-awareness', title: 'General Awareness', aliases: ['general awareness', 'ga'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 15, durationSeconds: 900, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'english-language', title: 'English / Hindi Language', aliases: ['english', 'english language', 'hindi'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude'], questionCount: 40, maxMarks: 50, positiveMarks: 1.25, negativeMarks: 0.31, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'rbi-grade-b': {
      examId: 'rbi-grade-b',
      examName: 'RBI Grade B 2026',
      category: 'Regulatory Body',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'RBI Grade B 2026 Phase-1',
          totalQuestions: 200,
          totalMarks: 200,
          totalDurationMinutes: 120,
          totalDurationSeconds: 7200,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'general-awareness', title: 'General Awareness', aliases: ['general awareness', 'ga'], questionCount: 80, maxMarks: 80, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 25, durationSeconds: 1500, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 60, maxMarks: 60, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 45, durationSeconds: 2700, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 25, durationSeconds: 1500, language: 'English', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.25, durationMinutes: 25, durationSeconds: 1500, language: 'English & Hindi', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'RBI Grade B 2026 Phase-2 (ESI & FM)',
          totalQuestions: 60,
          totalMarks: 100,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.67, negative: 0.25, penaltyRatio: '1/4th' },
          sections: [
            { id: 'esi', title: 'Economic & Social Issues (ESI)', aliases: ['esi', 'economic', 'general awareness'], questionCount: 30, maxMarks: 50, positiveMarks: 1.67, negativeMarks: 0.25, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'fm', title: 'Finance & Management (FM)', aliases: ['fm', 'finance', 'management', 'professional knowledge'], questionCount: 30, maxMarks: 50, positiveMarks: 1.67, negativeMarks: 0.25, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'lic-aao': {
      examId: 'lic-aao',
      examName: 'LIC AAO 2026',
      category: 'Insurance',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'LIC AAO 2026 Prelims',
          totalQuestions: 100,
          totalMarks: 70,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 1.0, negative: 0.0, penaltyRatio: 'No Negative Marking' },
          sections: [
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.0, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.0, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'english-language', title: 'English Language', aliases: ['english', 'english language'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.0, durationMinutes: 20, durationSeconds: 1200, language: 'English', isSectionalLocked: true }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'LIC AAO 2026 Mains',
          totalQuestions: 120,
          totalMarks: 300,
          totalDurationMinutes: 120,
          totalDurationSeconds: 7200,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 2.5, negative: 0.0, penaltyRatio: 'No Negative Marking' },
          sections: [
            { id: 'reasoning-ability', title: 'Reasoning Ability', aliases: ['reasoning', 'reasoning ability'], questionCount: 30, maxMarks: 90, positiveMarks: 3.0, negativeMarks: 0.0, durationMinutes: 40, durationSeconds: 2400, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'general-awareness', title: 'General Knowledge & Current Affairs', aliases: ['general awareness', 'ga', 'gk'], questionCount: 30, maxMarks: 60, positiveMarks: 2.0, negativeMarks: 0.0, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'data-analysis', title: 'Data Analysis & Interpretation', aliases: ['quant', 'data analysis', 'di'], questionCount: 30, maxMarks: 90, positiveMarks: 3.0, negativeMarks: 0.0, durationMinutes: 40, durationSeconds: 2400, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'insurance-awareness', title: 'Insurance & Financial Market Awareness', aliases: ['insurance', 'financial', 'professional knowledge'], questionCount: 30, maxMarks: 60, positiveMarks: 2.0, negativeMarks: 0.0, durationMinutes: 20, durationSeconds: 1200, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'ssc-cgl': {
      examId: 'ssc-cgl',
      examName: 'SSC CGL (Tier 1 & 2)',
      category: 'SSC Exams',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'SSC CGL 2026 Tier-1',
          totalQuestions: 100,
          totalMarks: 200,
          totalDurationMinutes: 60,
          totalDurationSeconds: 3600,
          hasSectionalTiming: false,
          isSectionalLocked: false,
          markingScheme: { positive: 2.0, negative: 0.5, penaltyRatio: '1/4th' },
          sections: [
            { id: 'general-intelligence', title: 'General Intelligence and Reasoning', aliases: ['reasoning', 'general intelligence', 'reasoning ability'], questionCount: 25, maxMarks: 50, positiveMarks: 2.0, negativeMarks: 0.5, durationMinutes: 15, durationSeconds: 900, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'general-awareness', title: 'General Awareness', aliases: ['general awareness', 'ga', 'gk'], questionCount: 25, maxMarks: 50, positiveMarks: 2.0, negativeMarks: 0.5, durationMinutes: 15, durationSeconds: 900, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'quantitative-aptitude', title: 'Quantitative Aptitude', aliases: ['quant', 'quantitative aptitude', 'mathematics'], questionCount: 25, maxMarks: 50, positiveMarks: 2.0, negativeMarks: 0.5, durationMinutes: 15, durationSeconds: 900, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'english-comprehension', title: 'English Comprehension', aliases: ['english', 'english comprehension', 'english language'], questionCount: 25, maxMarks: 50, positiveMarks: 2.0, negativeMarks: 0.5, durationMinutes: 15, durationSeconds: 900, language: 'English', isSectionalLocked: false }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'SSC CGL 2026 Tier-2 (Paper-I)',
          totalQuestions: 150,
          totalMarks: 450,
          totalDurationMinutes: 135,
          totalDurationSeconds: 8100,
          hasSectionalTiming: true,
          isSectionalLocked: true,
          markingScheme: { positive: 3.0, negative: 1.0, penaltyRatio: '1/3rd' },
          sections: [
            { id: 'section-1-math-reasoning', title: 'Section I: Mathematical Abilities & Reasoning', aliases: ['quant', 'reasoning', 'section 1', 'mathematical abilities'], questionCount: 60, maxMarks: 180, positiveMarks: 3.0, negativeMarks: 1.0, durationMinutes: 60, durationSeconds: 3600, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'section-2-english-ga', title: 'Section II: English Language & General Awareness', aliases: ['english', 'general awareness', 'section 2'], questionCount: 70, maxMarks: 210, positiveMarks: 3.0, negativeMarks: 1.0, durationMinutes: 60, durationSeconds: 3600, language: 'English & Hindi', isSectionalLocked: true },
            { id: 'section-3-computer', title: 'Section III: Computer Knowledge Module', aliases: ['computer', 'professional knowledge', 'section 3'], questionCount: 20, maxMarks: 60, positiveMarks: 3.0, negativeMarks: 1.0, durationMinutes: 15, durationSeconds: 900, language: 'English & Hindi', isSectionalLocked: true }
          ]
        }
      }
    },

    'rrb-ntpc': {
      examId: 'rrb-ntpc',
      examName: 'Railways RRB NTPC',
      category: 'Railways Exams',
      stages: {
        prelims: {
          stageId: 'prelims',
          title: 'RRB NTPC 2026 CBT-1',
          totalQuestions: 100,
          totalMarks: 100,
          totalDurationMinutes: 90,
          totalDurationSeconds: 5400,
          hasSectionalTiming: false,
          isSectionalLocked: false,
          markingScheme: { positive: 1.0, negative: 0.33, penaltyRatio: '1/3rd' },
          sections: [
            { id: 'general-awareness', title: 'General Awareness', aliases: ['general awareness', 'ga', 'gk'], questionCount: 40, maxMarks: 40, positiveMarks: 1.0, negativeMarks: 0.33, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'mathematics', title: 'Mathematics', aliases: ['mathematics', 'math', 'quant', 'quantitative aptitude'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.33, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'general-intelligence', title: 'General Intelligence and Reasoning', aliases: ['reasoning', 'general intelligence', 'reasoning ability'], questionCount: 30, maxMarks: 30, positiveMarks: 1.0, negativeMarks: 0.33, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: false }
          ]
        },
        mains: {
          stageId: 'mains',
          title: 'RRB NTPC 2026 CBT-2',
          totalQuestions: 120,
          totalMarks: 120,
          totalDurationMinutes: 90,
          totalDurationSeconds: 5400,
          hasSectionalTiming: false,
          isSectionalLocked: false,
          markingScheme: { positive: 1.0, negative: 0.33, penaltyRatio: '1/3rd' },
          sections: [
            { id: 'general-awareness', title: 'General Awareness', aliases: ['general awareness', 'ga'], questionCount: 50, maxMarks: 50, positiveMarks: 1.0, negativeMarks: 0.33, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'mathematics', title: 'Mathematics', aliases: ['mathematics', 'math', 'quant'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.33, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: false },
            { id: 'general-intelligence', title: 'General Intelligence and Reasoning', aliases: ['reasoning', 'general intelligence'], questionCount: 35, maxMarks: 35, positiveMarks: 1.0, negativeMarks: 0.33, durationMinutes: 30, durationSeconds: 1800, language: 'English & Hindi', isSectionalLocked: false }
          ]
        }
      }
    }
  };

  /**
   * Automatically detect examId and stage ('prelims' | 'mains') from JSON metadata, title, or section names
   */
  function detectExamAndStage(rawJson, fallbackTitle = '') {
    const combinedText = [
      rawJson.examId || '',
      rawJson.exam_id || '',
      rawJson.examName || '',
      rawJson.exam_name || '',
      rawJson.title || '',
      rawJson.test_name || '',
      fallbackTitle || ''
    ].join(' ').toLowerCase();

    // Check if any question has "Professional Knowledge"
    const flatQs = Array.isArray(rawJson.questions) ? rawJson.questions : [];
    const hasPK = flatQs.some(q => /professional\s*knowledge|it\s*officer/i.test(q.section || ''));

    let examId = 'sbi-po';
    if (/ibps\s*so|specialist\s*officer|it\s*officer/i.test(combinedText) || hasPK) {
      examId = 'ibps-so';
    } else if (/sbi\s*clerk|junior\s*associate/i.test(combinedText)) {
      examId = 'sbi-clerk';
    } else if (/sbi\s*po/i.test(combinedText)) {
      examId = 'sbi-po';
    } else if (/ibps\s*rrb/i.test(combinedText)) {
      examId = 'ibps-rrb-po';
    } else if (/ibps\s*clerk/i.test(combinedText)) {
      examId = 'ibps-clerk';
    } else if (/ibps\s*po/i.test(combinedText)) {
      examId = 'ibps-po';
    } else if (/rbi\s*grade\s*b|rbi/i.test(combinedText)) {
      examId = 'rbi-grade-b';
    } else if (/lic\s*aao|lic/i.test(combinedText)) {
      examId = 'lic-aao';
    } else if (/ssc\s*cgl|ssc/i.test(combinedText)) {
      examId = 'ssc-cgl';
    } else if (/rrb\s*ntpc|railway|ntpc/i.test(combinedText)) {
      examId = 'rrb-ntpc';
    }

    let stage = 'prelims';
    if (/mains|main|tier\s*2|tier-2|phase\s*2|phase-2|cbt\s*2|cbt-2/i.test(combinedText) || hasPK) {
      stage = 'mains';
    } else if (rawJson.type && /mains/i.test(rawJson.type)) {
      stage = 'mains';
    }

    return { examId, stage };
  }

  /**
   * Normalize any correctIndex / correctAnswer representation into a 0-based integer (0..4)
   */
  function normalizeCorrectIndex(question, optionsArray) {
    if (typeof question.correctIndex === 'number' && question.correctIndex >= 0 && question.correctIndex < 10) {
      return question.correctIndex;
    }
    const rawAns = question.correct_answer ?? question.correctAnswer ?? question.answer ?? question.correct_option ?? question.correctOption;
    if (rawAns !== undefined && rawAns !== null) {
      const str = String(rawAns).trim().toUpperCase();
      const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4, '(A)': 0, '(B)': 1, '(C)': 2, '(D)': 3, '(E)': 4 };
      if (letterMap[str] !== undefined) {
        return letterMap[str];
      }
      const num = parseInt(str, 10);
      if (!isNaN(num)) {
        // If 1..5, convert to 0..4; if 0, keep 0
        if (num >= 1 && num <= Math.max(5, optionsArray.length)) {
          return num - 1;
        }
        if (num === 0) return 0;
      }
      // Try matching option text
      const byText = optionsArray.findIndex(o => (o.text || o.html || '').trim().toLowerCase() === String(rawAns).trim().toLowerCase());
      if (byText !== -1) return byText;
    }
    return 0;
  }

  /**
   * Match a raw section name to the official 2026 stage section specification
   */
  function matchOfficialSectionSpec(secTitle, stageSpec, fallbackIndex) {
    if (!stageSpec || !Array.isArray(stageSpec.sections) || stageSpec.sections.length === 0) {
      return null;
    }
    const clean = String(secTitle || '').trim().toLowerCase();
    for (const s of stageSpec.sections) {
      if (s.id.toLowerCase() === clean || s.title.toLowerCase() === clean) {
        return s;
      }
      if (Array.isArray(s.aliases)) {
        for (const alias of s.aliases) {
          if (clean.includes(alias.toLowerCase()) || alias.toLowerCase().includes(clean)) {
            return s;
          }
        }
      }
    }
    return stageSpec.sections[fallbackIndex % stageSpec.sections.length] || stageSpec.sections[0];
  }

  /**
   * Apply the official 2026 Exam Marking Scheme & Sectional Timing to any uploaded Question Paper JSON
   */
  function apply2026PatternToQuestionPaper(rawJson, options = {}) {
    if (!rawJson || typeof rawJson !== 'object') {
      throw new Error('Invalid JSON question paper object');
    }

    const detected = detectExamAndStage(rawJson, options.title || options.filename || '');
    const examId = options.examId || detected.examId || 'sbi-po';
    const stageId = options.stage || detected.stage || 'prelims';

    const examEntry = EXAM_PATTERNS_2026[examId] || EXAM_PATTERNS_2026['sbi-po'];
    const stageSpec = (examEntry.stages && examEntry.stages[stageId]) || examEntry.stages.prelims || Object.values(examEntry.stages)[0];

    // Extract raw sections or group flat questions[] by section
    let rawSections = [];
    if (Array.isArray(rawJson.sections) && rawJson.sections.length > 0 && Array.isArray(rawJson.sections[0].questions)) {
      rawSections = rawJson.sections.map(s => ({
        title: s.title || s.name || 'Section',
        id: s.id,
        questions: s.questions || []
      }));
    } else if (Array.isArray(rawJson.questions) && rawJson.questions.length > 0) {
      const secMap = new Map();
      rawJson.questions.forEach((q, idx) => {
        let sName = q.section || q.section_name || q.subject || '';
        if (!sName) {
          // Assign to official sections proportionally if no section field exists
          const totalRaw = rawJson.questions.length;
          const secIdx = Math.min(stageSpec.sections.length - 1, Math.floor((idx / Math.max(1, totalRaw)) * stageSpec.sections.length));
          sName = stageSpec.sections[secIdx].title;
        }
        if (!secMap.has(sName)) secMap.set(sName, []);
        secMap.get(sName).push(q);
      });
      for (const [title, qList] of secMap.entries()) {
        rawSections.push({ title, questions: qList });
      }
    } else if (Array.isArray(rawJson)) {
      // Root array of questions
      const secMap = new Map();
      rawJson.forEach((q, idx) => {
        let sName = q.section || q.section_name || q.subject || '';
        if (!sName) {
          const totalRaw = rawJson.length;
          const secIdx = Math.min(stageSpec.sections.length - 1, Math.floor((idx / Math.max(1, totalRaw)) * stageSpec.sections.length));
          sName = stageSpec.sections[secIdx].title;
        }
        if (!secMap.has(sName)) secMap.set(sName, []);
        secMap.get(sName).push(q);
      });
      for (const [title, qList] of secMap.entries()) {
        rawSections.push({ title, questions: qList });
      }
    } else {
      throw new Error('Uploaded JSON must contain either a "questions" array or a "sections" array.');
    }

    const testId = options.testId || rawJson.id || `${examId}-${stageId}-custom-${Date.now()}`;
    let globalIdx = 0;
    let totalDurationSeconds = 0;
    let totalMarks = 0;

    // Special case: Single-section IBPS SO IT Mains (60 Qs Professional Knowledge only)
    const isSingleSectionPK = examId === 'ibps-so' && stageId === 'mains' && rawSections.length === 1 && /professional|pk|it/i.test(rawSections[0].title);

    const normalizedSections = rawSections.map((rawSec, secIdx) => {
      const matchedSpec = matchOfficialSectionSpec(rawSec.title, stageSpec, secIdx);
      const posMark = matchedSpec ? matchedSpec.positiveMarks : stageSpec.markingScheme.positive;
      const negMark = matchedSpec ? matchedSpec.negativeMarks : stageSpec.markingScheme.negative;
      const durationMins = isSingleSectionPK ? 45 : (matchedSpec ? matchedSpec.durationMinutes : 20);
      const durationSecs = durationMins * 60;
      const secTitle = matchedSpec ? matchedSpec.title : rawSec.title;
      const secId = rawSec.id || (matchedSpec ? matchedSpec.id : secTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

      const normalizedQuestions = (rawSec.questions || []).map((q, lIdx) => {
        globalIdx++;
        // Normalize options array
        let optionsList = [];
        const letters = ['A', 'B', 'C', 'D', 'E'];
        if (Array.isArray(q.options)) {
          optionsList = q.options.map((opt, oIdx) => {
            if (typeof opt === 'object' && opt !== null) {
              return {
                letter: opt.letter || letters[oIdx] || String.fromCharCode(65 + oIdx),
                text: opt.text ?? opt.html ?? '',
                html: opt.html ?? opt.text ?? ''
              };
            }
            return {
              letter: letters[oIdx] || String.fromCharCode(65 + oIdx),
              text: String(opt),
              html: String(opt)
            };
          });
        } else if (q.options && typeof q.options === 'object') {
          optionsList = Object.keys(q.options).sort().map((k, oIdx) => ({
            letter: k.toUpperCase(),
            text: String(q.options[k]),
            html: String(q.options[k])
          }));
        }

        const correctIndex = normalizeCorrectIndex(q, optionsList);
        const correctLetter = optionsList[correctIndex]?.letter || letters[correctIndex] || 'A';

        const qHtml = q.questionHTML || q.question_text || q.question || q.text || '';
        const pHtml = q.passageHTML || q.passage_text || q.passage || q.directions || '';
        const expHtml = q.explanationHTML || q.explanation || q.solution || '';
        const rawImgs = q.imageUrls || q.image_urls || [];

        return {
          id: q.id || `${testId}-q-${globalIdx}`,
          globalIndex: globalIdx,
          localIndex: lIdx + 1,
          questionNumber: q.questionNumber || q.question_number || (lIdx + 1),
          section: secTitle,
          questionHTML: qHtml,
          passageHTML: pHtml,
          hasPassage: Boolean(pHtml && String(pHtml).trim().length > 15),
          imageUrls: rawImgs,
          options: optionsList,
          correctAnswer: correctLetter,
          correctIndex: correctIndex,
          explanationHTML: expHtml,
          marksForCorrect: posMark,
          negativeMarks: negMark
        };
      });

      const secMaxMarks = Math.round(normalizedQuestions.length * posMark * 100) / 100;
      totalDurationSeconds += durationSecs;
      totalMarks += secMaxMarks;

      return {
        id: secId,
        sectionIndex: secIdx + 1,
        title: secTitle,
        questionCount: normalizedQuestions.length,
        durationMinutes: durationMins,
        durationSeconds: durationSecs,
        maxMarks: secMaxMarks,
        positiveMarks: posMark,
        marksForCorrect: posMark,
        negativeMarks: negMark,
        language: matchedSpec ? matchedSpec.language : 'English & Hindi',
        isSectionalLocked: stageSpec.isSectionalLocked,
        questions: normalizedQuestions
      };
    });

    // If composite timer (e.g. SSC CGL Tier-1 or RRB NTPC), use stage total duration
    if (!stageSpec.hasSectionalTiming) {
      totalDurationSeconds = stageSpec.totalDurationSeconds || (stageSpec.totalDurationMinutes * 60);
      normalizedSections.forEach(s => {
        s.durationMinutes = Math.round(totalDurationSeconds / 60);
        s.durationSeconds = totalDurationSeconds;
        s.isSectionalLocked = false;
      });
    }

    const totalDurationMinutes = Math.round(totalDurationSeconds / 60);
    const finalTitle = options.title || rawJson.title || `${stageSpec.title} - Custom Mock`;
    const sectionsSummary = normalizedSections.map(s => `${s.title} (${s.questionCount} Qs • ${s.durationMinutes}m)`);

    return {
      id: testId,
      title: finalTitle,
      examId: examEntry.examId,
      examName: examEntry.examName,
      type: stageId,
      subtitle: options.subtitle || rawJson.subtitle || `2026 Official Pattern (${stageSpec.hasSectionalTiming ? 'Sectional Timing' : 'Composite Timer'} • +${stageSpec.markingScheme.positive} / -${stageSpec.markingScheme.negative})`,
      marks: Math.round(totalMarks),
      questionsCount: globalIdx,
      durationMinutes: totalDurationMinutes,
      totalDurationSeconds: totalDurationSeconds,
      hasSectionalTiming: stageSpec.hasSectionalTiming,
      isSectionalLocked: stageSpec.isSectionalLocked,
      markingScheme: stageSpec.markingScheme,
      marksPerCorrect: stageSpec.markingScheme.positive,
      negativeMarks: stageSpec.markingScheme.negative,
      sectionsSummary: sectionsSummary,
      sections: normalizedSections
    };
  }

  return {
    EXAM_PATTERNS_2026,
    detectExamAndStage,
    normalizeCorrectIndex,
    apply2026PatternToQuestionPaper
  };
});
