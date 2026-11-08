/**
 * SearchInput Component
 * Reusable, debounced search input
 */

import { useDebouncedCallback } from '@hooks/useDebounce';

export class SearchInput {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      placeholder: 'Search...',
      debounceDelay: 300,
      onSearch: () => {},
      onClear: () => {},
      ...options,
    };
    this.element = null;
    this.value = '';
    this._debouncedSearch = useDebouncedCallback(
      (query) => this.options.onSearch(query),
      this.options.debounceDelay
    );
  }

  render() {
    const html = `
      <div class="search-input-wrapper">
        <div class="search-input-box">
          <span class="search-icon">🔍</span>
          <input type="text"
                 id="search-input"
                 class="search-input-field"
                 placeholder="${this.options.placeholder}"
                 value="${this.value.replace(/"/g, '&quot;')}"
                 autocomplete="off"
                 aria-label="Search">
          ${this.value ? `
            <button class="search-clear-btn" title="Clear search" aria-label="Clear search">✕</button>
          ` : ''}
        </div>
      </div>
    `;

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    this.element = template.content.firstElementChild;

    const input = this.element.querySelector('#search-input');
    const clearBtn = this.element.querySelector('.search-clear-btn');

    input.addEventListener('input', (e) => {
      this.value = e.target.value;
      this._debouncedSearch(e.target.value);
      this._updateClearButton();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.clear();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clear());
    }

    return this.element;
  }

  _updateClearButton() {
    const existing = this.element.querySelector('.search-clear-btn');
    if (existing) existing.remove();

    if (this.value) {
      const btn = document.createElement('button');
      btn.className = 'search-clear-btn';
      btn.title = 'Clear search';
      btn.setAttribute('aria-label', 'Clear search');
      btn.textContent = '✕';
      btn.addEventListener('click', () => this.clear());
      this.element.querySelector('.search-input-box').appendChild(btn);
    }
  }

  clear() {
    this.value = '';
    const input = this.element.querySelector('#search-input');
    if (input) input.value = '';
    this._updateClearButton();
    this.options.onClear();
  }

  setValue(value) {
    this.value = value;
    const input = this.element.querySelector('#search-input');
    if (input) input.value = value;
    this._updateClearButton();
  }

  getValue() {
    return this.value;
  }

  focus() {
    const input = this.element.querySelector('#search-input');
    if (input) input.focus();
  }

  destroy() {
    if (this._debouncedSearch.cancel) this._debouncedSearch.cancel();
    this.element = null;
  }
}

/**
 * Debounced Search Component
 * Combines SearchInput with a results list
 */
export class DebouncedSearch {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      placeholder: 'Search tests, topics, PYPs...',
      debounceDelay: 300,
      onSearch: () => {},
      ...options,
    };
    this.searchInput = null;
    this.resultsContainer = null;
  }

  render() {
    const html = `
      <div class="debounced-search-wrapper">
        <div class="search-input-box">
          <span class="search-icon">🔍</span>
          <input type="text"
                 id="debounced-search-input"
                 class="search-input-field"
                 placeholder="${this.options.placeholder}"
                 autocomplete="off"
                 aria-label="Search">
          <button class="search-clear-btn" title="Clear search" aria-label="Clear search" style="display: none;">✕</button>
        </div>
        <div class="search-results-container" id="search-results-container"></div>
      </div>
    `;

    const template = document.createElement('template');
    template.innerHTML = html.trim();
    this.element = template.content.firstElementChild;

    const input = this.element.querySelector('#debounced-search-input');
    const clearBtn = this.element.querySelector('.search-clear-btn');
    this.resultsContainer = this.element.querySelector('#search-results-container');

    this._debouncedSearch = useDebouncedCallback(
      (query) => this.options.onSearch(query),
      this.options.debounceDelay
    );

    input.addEventListener('input', (e) => {
      const value = e.target.value;
      clearBtn.style.display = value ? 'block' : 'none';
      this._debouncedSearch(value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        input.value = '';
        clearBtn.style.display = 'none';
        this.resultsContainer.innerHTML = '';
        this._debouncedSearch.cancel();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      this.resultsContainer.innerHTML = '';
      this._debouncedSearch.cancel();
    });

    return this.element;
  }

  setResults(results) {
    if (!results || results.length === 0) {
      this.resultsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #64748b; font-size: 13px;">No results found</div>';
      return;
    }

    this.resultsContainer.innerHTML = results.map(r => `
      <div style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; font-size: 13px; color: #1e293b;"
           onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
        ${r.label}
      </div>
    `).join('');
  }

  destroy() {
    if (this._debouncedSearch.cancel) this._debouncedSearch.cancel();
    this.element = null;
  }
}