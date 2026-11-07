/**
 * Toast Notification Component
 * Reusable, accessible toast system
 */

export class Toast {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.idCounter = 0;
  }

  init() {
    if (this.container) return this.container;

    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-live', 'polite');
    this.container.setAttribute('aria-label', 'Notifications');
    this.container.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 360px;
    `;
    document.body.appendChild(this.container);
    return this.container;
  }

  show(message, type = 'info', options = {}) {
    const { duration = 4000, action, onAction } = options;
    this.init();

    const id = `toast-${++this.idCounter}`;
    const toast = document.createElement('div');
    toast.id = id;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const typeStyles = {
      info: 'background: #0f172a; border-left: 4px solid #3476BB;',
      success: 'background: #0f172a; border-left: 4px solid #15803d;',
      error: 'background: #0f172a; border-left: 4px solid #dc2626;',
      warning: 'background: #0f172a; border-left: 4px solid #d97706;',
    };

    toast.style.cssText = `
      ${typeStyles[type] || typeStyles.info}
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      gap: 12px;
      animation: slideIn 0.3s ease;
      pointer-events: auto;
      opacity: 1;
      transition: opacity 0.25s ease, transform 0.25s ease;
    `;

    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️',
    };

    toast.innerHTML = `
      <span style="font-size: 16px; flex-shrink: 0;">${iconMap[type] || iconMap.info}</span>
      <span style="flex: 1; line-height: 1.4;">${message}</span>
      ${action ? `<button style="background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;">${action}</button>` : ''}
    `;

    const actionBtn = toast.querySelector('button');
    if (actionBtn && onAction) {
      actionBtn.addEventListener('click', () => {
        onAction();
        this.dismiss(id);
      });
    }

    this.container.appendChild(toast);
    this.toasts.set(id, { toast, timer: null });

    if (duration > 0) {
      const timer = setTimeout(() => this.dismiss(id), duration);
      this.toasts.set(id, { toast, timer });
    }

    return id;
  }

  dismiss(id) {
    const entry = this.toasts.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);
    entry.toast.style.opacity = '0';
    entry.toast.style.transform = 'translateX(100%)';

    setTimeout(() => {
      if (entry.toast.parentNode) {
        entry.toast.parentNode.removeChild(entry.toast);
      }
      this.toasts.delete(id);
    }, 250);
  }

  dismissAll() {
    this.toasts.forEach((_, id) => this.dismiss(id));
  }

  info(message, options) { return this.show(message, 'info', options); }
  success(message, options) { return this.show(message, 'success', options); }
  error(message, options) { return this.show(message, 'error', options); }
  warning(message, options) { return this.show(message, 'warning', options); }
}

export const toast = new Toast();

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => toast.init());
  } else {
    toast.init();
  }
}