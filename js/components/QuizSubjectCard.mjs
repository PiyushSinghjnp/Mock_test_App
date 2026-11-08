/**
 * QuizSubjectCard Component
 * Reusable card for daily quiz subjects
 */

export class QuizSubjectCard {
  constructor(subject, options = {}) {
    this.subject = subject;
    this.options = {
      onStartQuiz: () => {},
      ...options,
    };
    this.element = null;
  }

  getIcon() {
    const iconMap = {
      reasoning: '🧩',
      quant: '📐',
      math: '📐',
      english: '📖',
      general: '🌍',
      awareness: '🌍',
      current: '📰',
      computer: '💻',
      professional: '⚡',
    };

    const lower = (this.subject.subject || '').toLowerCase();
    for (const [k, ic] of Object.entries(iconMap)) {
      if (lower.includes(k)) return ic;
    }
    return '📝';
  }

  render() {
    const icon = this.getIcon();
    const solved = this.subject.solvedCount || 0;
    const total = Math.max(0, Number(this.subject.totalQuestions) || 0);
    const quizSize = Math.min(10, total);
    const pct = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
    const safeSubject = (this.subject.subject || '').replace(/'/g, "\\'");

    const html = `
      <div class="quiz-subject-card">
        <div>
          <div class="quiz-card-top">
            <div class="quiz-subject-icon">${icon}</div>
            <div style="flex: 1;">
              <h4 class="quiz-subject-title">${this.subject.subject}</h4>
              <div style="font-size: 12px; color: #64748b;">${quizSize} available question${quizSize === 1 ? '' : 's'} • up to 10 minutes</div>
            </div>
          </div>

          <div class="quiz-meta-row">
            <span><b>${Math.max(0, total - solved)} remaining</b> of ${total}</span>
            <span>•</span>
            <span style="color: #008479; font-weight: 700;">${solved} Solved</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 600;">
            <span>Subject progress</span>
            <span>${pct}%</span>
          </div>
          <div class="quiz-progress-track">
            <div class="quiz-progress-fill" style="width: ${pct}%;"></div>
          </div>
        </div>

        <div style="margin-top: 10px;">
          <button type="button" class="quiz-btn-start" data-action="start" ${quizSize === 0 ? 'disabled' : ''}>
            <span>${quizSize > 0 ? `Start ${quizSize}-Question Quiz` : 'No practice available'}</span>
          </button>
        </div>
      </div>
    `;

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    this.element = template.content.firstElementChild;

    const btn = this.element.querySelector('[data-action="start"]');
    if (btn) {
      btn.addEventListener('click', () => {
        this.options.onStartQuiz(safeSubject);
      });
    }

    return this.element;
  }

  update(subject) {
    this.subject = subject;
    if (this.element && this.element.parentNode) {
      const newElement = this.render();
      this.element.parentNode.replaceChild(newElement, this.element);
      this.element = newElement;
    }
  }

  destroy() {
    this.element = null;
  }
}

/**
 * QuizSubjectCardList - Manages a list of QuizSubjectCard components
 */
export class QuizSubjectCardList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.cards = new Map();
  }

  render(subjects) {
    this.container.innerHTML = '';

    if (!subjects || subjects.length === 0) {
      this.container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 30px; text-align: center; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="font-size: 32px; margin-bottom: 8px;">📚</div>
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">No Quiz Subjects Found Yet</div>
          <div style="font-size: 13px; color: #64748b;">Visit <a href="/admin#sec-quiz-bank" style="color: #008479; font-weight: 700;">Admin Console</a> to upload questions.</div>
        </div>
      `;
      return;
    }

    subjects.forEach(sub => {
      const card = new QuizSubjectCard(sub, this.options);
      const element = card.render();
      this.container.appendChild(element);
      this.cards.set(sub.subject, card);
    });
  }

  destroy() {
    this.cards.forEach(card => card.destroy());
    this.cards.clear();
  }
}
