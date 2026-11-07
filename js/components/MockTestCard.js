/**
 * MockTestCard Component
 * Reusable card component for displaying mock tests
 */

import { store, ActionTypes } from '@state/store';

export class MockTestCard {
  constructor(pack, options = {}) {
    this.pack = pack;
    this.options = {
      onTakeTest: () => {},
      onResumeTest: () => {},
      onViewSolutions: () => {},
      onViewScorecard: () => {},
      onReattempt: () => {},
      onStartFresh: () => {},
      ...options,
    };
    this.element = null;
  }

  getCardClass() {
    const isAttempted = !!this.pack.isAttempted && !!this.pack.userAttempt;
    const isPaused = !!this.pack.isPaused && !!this.pack.pausedAttempt;

    if (isAttempted) return 'mock-test-card card-attempted';
    if (isPaused) return 'mock-test-card card-paused';
    return 'mock-test-card';
  }

  getTopBadge() {
    const isAttempted = !!this.pack.isAttempted && !!this.pack.userAttempt;
    const isPaused = !!this.pack.isPaused && !!this.pack.pausedAttempt;
    const isFree = !!(this.pack.is_free || this.pack.isFree);

    if (isAttempted) return '<span class="badge-tag-completed">COMPLETED</span>';
    if (isPaused) return '<span class="badge-tag-paused">IN PROGRESS</span>';
    if (isFree) return '<span class="badge-tag-free">FREE</span>';
    return '<span class="badge-tag-locked">🔒 PRO</span>';
  }

  getProgressData() {
    const isAttempted = !!this.pack.isAttempted && !!this.pack.userAttempt;
    const att = this.pack.userAttempt;
    const totalQs = this.pack.questions_count || this.pack.questionsCount || 100;

    if (!isAttempted || !att) {
      return { correctPct: 0, wrongPct: 0, unattPct: 100 };
    }

    const cCount = att.correct_count ?? 0;
    const wCount = att.wrong_count ?? 0;
    const correctPct = Math.min(100, Math.round((cCount / Math.max(1, totalQs)) * 100));
    const wrongPct = Math.min(100 - correctPct, Math.round((wCount / Math.max(1, totalQs)) * 100));
    const unattPct = Math.max(0, 100 - correctPct - wrongPct);

    return { correctPct, wrongPct, unattPct };
  }

  getRankInfo() {
    const isAttempted = !!this.pack.isAttempted && !!this.pack.userAttempt;
    const att = this.pack.userAttempt;

    if (!isAttempted || !att) {
      return {
        displayAIR: 1000,
        displayPercentile: 0,
        displayActiveUsers: this.pack.activeUsers || 24800,
      };
    }

    // Use cached rank info or compute
    return {
      displayAIR: att.estimated_air || 1000,
      displayPercentile: att.percentile || 0,
      displayActiveUsers: this.pack.activeUsers || 24800,
    };
  }

  getPausedInfo() {
    const isPaused = !!this.pack.isPaused && !!this.pack.pausedAttempt;
    if (!isPaused) return null;

    const paused = this.pack.pausedAttempt;
    const remSec = paused.sectionRemainingSeconds ?? paused.section_remaining_seconds ?? paused.remainingSeconds ?? paused.remaining_seconds ?? 1200;
    const pausedMinsLeft = Math.max(1, Math.ceil(remSec / 60));
    const pausedSecIdx = paused.currentSectionIndex ?? paused.current_section_index ?? 0;
    const pausedQIdx = paused.currentQuestionIndex ?? paused.current_question_index ?? 0;

    return { pausedMinsLeft, pausedSecIdx, pausedQIdx };
  }

  render() {
    const isAttempted = !!this.pack.isAttempted && !!this.pack.userAttempt;
    const isPaused = !!this.pack.isPaused && !!this.pack.pausedAttempt;
    const isFree = !!(this.pack.is_free || this.pack.isFree);
    const totalQs = this.pack.questions_count || this.pack.questionsCount || 100;
    const att = this.pack.userAttempt;
    const paused = this.pack.pausedAttempt;

    const { correctPct, wrongPct, unattPct } = this.getProgressData();
    const { displayAIR, displayPercentile, displayActiveUsers } = this.getRankInfo();
    const pausedInfo = this.getPausedInfo();

    const cardClass = this.getCardClass();
    const topBadge = this.getTopBadge();

    const sectionsHtml = (this.pack.sections_summary || this.pack.sections || []).map(s =>
      `<span style="font-size: 11px; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 500;">${s}</span>`
    ).join('');

    const actionsHtml = isPaused ? `
      <button class="btn-attempt-card" style="background: #0284c7; color: #ffffff;" data-action="resume">
        Resume Test ▶
      </button>
      <button class="btn-view-scorecard" data-action="start-fresh">
        Start Fresh
      </button>
    ` : isAttempted ? `
      <button class="btn-attempt-card" style="background: #3476BB; color: #ffffff;" data-action="solutions">
        Solutions
      </button>
      <button class="btn-view-scorecard" data-action="scorecard">
        Analytics
      </button>
      <button class="btn-view-scorecard" data-action="reattempt">
        Re-attempt
      </button>
    ` : `
      <button class="btn-attempt-card" data-action="take-test">
        Take Test
      </button>
    `;

    const attemptBannerHtml = isAttempted && att ? `
      <div class="card-attempt-banner" style="display: block;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div>
            <span style="font-weight: 800; color: #15803d; font-size: 13px;">${Number(att.score).toFixed(2)}/${this.pack.marks} <span style="font-weight: 600; color: #475569; font-size: 11px;">Score</span></span>
            <span style="margin-left: 10px; font-weight: 700; color: #0f172a; font-size: 12px;">${att.accuracy ?? 0}% <span style="font-weight: 600; color: #475569; font-size: 11px;">Accuracy</span></span>
          </div>
          <span style="font-size: 11px; color: #334155; font-weight: 600;">Rank: <strong>#${Number(displayAIR).toLocaleString()}/${Number(displayActiveUsers).toLocaleString()}</strong> (${Number(displayPercentile).toFixed(1)}%ile)</span>
        </div>
        <div class="attempt-3color-bar" title="Green: Correct (${att.correct_count ?? 0}) | Red: Wrong (${att.wrong_count ?? 0}) | Grey: Skipped (${att.unanswered_count ?? 0})">
          <div class="seg-correct" style="width: ${correctPct}%;"></div>
          <div class="seg-wrong" style="width: ${wrongPct}%;"></div>
          <div class="seg-unattempted" style="width: ${unattPct}%;"></div>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; margin-top: 6px; font-size: 11px; font-weight: 600; color: #334155;">
          <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a; display: inline-block;"></span> ${att.correct_count ?? 0} Correct</span>
          <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #dc2626; display: inline-block;"></span> ${att.wrong_count ?? 0} Wrong</span>
          <span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; display: inline-block;"></span> ${att.unanswered_count ?? 0} Skipped</span>
        </div>
      </div>
    ` : '';

    const pausedBannerHtml = isPaused && pausedInfo ? `
      <div class="card-paused-banner">
        <div>
          <span style="font-weight: 700; color: #0284c7;">⏸ Paused at Section ${pausedInfo.pausedSecIdx + 1}, Q${pausedInfo.pausedQIdx + 1}</span>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            Time Remaining: <strong>${pausedInfo.pausedMinsLeft} mins left</strong>
          </div>
        </div>
      </div>
    ` : '';

    const html = `
      <div class="${cardClass}" id="mock-card-${this.pack.id}" data-test-id="${this.pack.id}">
        <div>
          <div class="card-top-row">
            <h4 class="mock-title">${this.pack.title}</h4>
            ${topBadge}
          </div>
          <p class="mock-desc">${this.pack.subtitle || 'TCS iON authentic exam simulation'}</p>

          <div class="mock-specs-row">
            <div class="spec-entry"><img class="spec-icon-img" src="img/numq.svg" alt=""> ${totalQs} Questions</div>
            <div class="spec-entry"><img class="spec-icon-img" src="img/marks.svg" alt=""> ${this.pack.marks} Marks</div>
            <div class="spec-entry"><img class="spec-icon-img" src="img/duration.svg" alt=""> ${this.pack.duration_minutes || this.pack.durationMinutes} Mins</div>
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
            ${sectionsHtml}
          </div>

          ${pausedBannerHtml}
          ${attemptBannerHtml}
        </div>

        <div class="mock-card-footer">
          <span class="active-takers">🌐 English, Hindi • 👥 ${Number(displayActiveUsers).toLocaleString()}</span>

          <div class="mock-card-actions">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;

    // Create element from HTML
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    this.element = template.content.firstElementChild;

    // Bind events
    this.bindEvents();

    return this.element;
  }

  bindEvents() {
    if (!this.element) return;

    const actions = this.element.querySelector('.mock-card-actions');
    if (!actions) return;

    actions.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.dataset.action;
      switch (action) {
        case 'take-test':
          this.options.onTakeTest(this.pack.id);
          break;
        case 'resume':
          this.options.onResumeTest(this.pack.id);
          break;
        case 'solutions':
          this.options.onViewSolutions(att.attempt_id, this.pack.id);
          break;
        case 'scorecard':
          this.options.onViewScorecard(att.attempt_id, this.pack.id);
          break;
        case 'reattempt':
          this.options.onReattempt(this.pack.id);
          break;
        case 'start-fresh':
          this.options.onStartFresh(this.pack.id);
          break;
      }
    });
  }

  update(pack) {
    this.pack = pack;
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
 * MockTestCardList - Manages a list of MockTestCard components
 */
export class MockTestCardList {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.cards = new Map();
  }

  render(packs) {
    // Clear container
    this.container.innerHTML = '';

    if (!packs || packs.length === 0) {
      this.container.innerHTML = `
        <div style="grid-column: span 2; text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px solid var(--ob-app-border);">
          <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
          <h4 style="font-size: 16px; font-weight: 700; color: #1e293b;">No tests found for this filter</h4>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Select 'All Tests' or switch status filters above to view available mock tests.</p>
        </div>
      `;
      return;
    }

    // Create and mount cards
    packs.forEach(pack => {
      const card = new MockTestCard(pack, this.options);
      const element = card.render();
      this.container.appendChild(element);
      this.cards.set(pack.id, card);
    });
  }

  updatePack(pack) {
    const card = this.cards.get(pack.id);
    if (card) {
      card.update(pack);
    }
  }

  destroy() {
    this.cards.forEach(card => card.destroy());
    this.cards.clear();
  }
}