/**
 * Modal Component
 * Reusable, accessible modal system with focus management
 */

export class Modal {
  constructor(id, options = {}) {
    this.id = id;
    this.element = null;
    this.previousFocus = null;
    this.isOpen = false;
    this.options = {
      closeOnOverlayClick: true,
      closeOnEscape: true,
      focusTrap: true,
      ...options,
    };
    this.onCloseCallbacks = [];
    this.onOpenCallbacks = [];
  }

  create(content, options = {}) {
    if (this.element) return this.element;

    const modal = document.createElement('div');
    modal.id = this.id;
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', `${this.id}-title`);
    modal.style.cssText = `
      display: none;
      position: fixed;
      inset: 0;
      z-index: 1050;
      background: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.style.cssText = `
      background: #fff;
      border-radius: 12px;
      max-width: ${options.maxWidth || '500px'};
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transform: scale(0.95);
      transition: transform 0.2s ease;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    `;

    if (options.title) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
      `;
      header.innerHTML = `
        <h2 id="${this.id}-title" style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;">${options.title}</h2>
        <button type="button" class="modal-close" aria-label="Close modal" style="
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #64748b;
          padding: 4px;
          line-height: 1;
          border-radius: 4px;
        ">✕</button>
      `;
      dialog.appendChild(header);

      header.querySelector('.modal-close').addEventListener('click', () => this.close());
    }

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = `
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    `;
    body.innerHTML = content;
    dialog.appendChild(body);

    if (options.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        padding: 16px 20px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
      `;
      footer.innerHTML = options.footer;
      dialog.appendChild(footer);
    }

    modal.appendChild(dialog);
    this.element = modal;

    // Event listeners
    if (this.options.closeOnOverlayClick) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.close();
      });
    }

    if (this.options.closeOnEscape) {
      this._handleEscape = (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      };
      document.addEventListener('keydown', this._handleEscape);
    }

    document.body.appendChild(modal);
    return modal;
  }

  open() {
    if (!this.element) return;
    if (this.isOpen) return;

    this.previousFocus = document.activeElement;
    this.element.style.display = 'flex';
    // Force reflow for animation
    this.element.offsetHeight;
    this.element.style.opacity = '1';
    this.element.querySelector('.modal-dialog').style.transform = 'scale(1)';

    this.isOpen = true;
    document.body.style.overflow = 'hidden';

    // Focus management
    if (this.options.focusTrap) {
      this._trapFocus();
    }

    const focusable = this.element.querySelector('[autofocus]') ||
                       this.element.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();

    this.onOpenCallbacks.forEach(cb => cb());
  }

  close() {
    if (!this.element || !this.isOpen) return;

    this.element.style.opacity = '0';
    this.element.querySelector('.modal-dialog').style.transform = 'scale(0.95)';

    setTimeout(() => {
      this.element.style.display = 'none';
      this.isOpen = false;
      document.body.style.overflow = '';

      // Restore focus
      if (this.previousFocus) {
        this.previousFocus.focus();
      }

      this.onCloseCallbacks.forEach(cb => cb());
    }, 200);
  }

  _trapFocus() {
    const focusableElements = this.element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    this._handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    this.element.addEventListener('keydown', this._handleTab);
  }

  destroy() {
    if (this._handleEscape) {
      document.removeEventListener('keydown', this._handleEscape);
    }
    if (this._handleTab) {
      this.element.removeEventListener('keydown', this._handleTab);
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.isOpen = false;
  }

  onClose(callback) {
    this.onCloseCallbacks.push(callback);
    return () => {
      const idx = this.onCloseCallbacks.indexOf(callback);
      if (idx > -1) this.onCloseCallbacks.splice(idx, 1);
    };
  }

  onOpen(callback) {
    this.onOpenCallbacks.push(callback);
    return () => {
      const idx = this.onOpenCallbacks.indexOf(callback);
      if (idx > -1) this.onOpenCallbacks.splice(idx, 1);
    };
  }

  setContent(content) {
    const body = this.element?.querySelector('.modal-body');
    if (body) body.innerHTML = content;
  }
}

// Factory function for common modals
export function createConfirmModal(id, title, message, onConfirm, onCancel) {
  const modal = new Modal(id);
  modal.create(`
    <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.5;">${message}</p>
  `, {
    title,
    footer: `
      <button type="button" class="modal-btn-cancel" style="
        padding: 8px 16px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #1e293b;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      ">Cancel</button>
      <button type="button" class="modal-btn-confirm" style="
        padding: 8px 16px;
        background: #dc2626;
        border: none;
        color: #fff;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      ">Confirm</button>
    `,
  });

  modal.element.querySelector('.modal-btn-cancel').addEventListener('click', () => {
    onCancel?.();
    modal.close();
  });

  modal.element.querySelector('.modal-btn-confirm').addEventListener('click', () => {
    onConfirm?.();
    modal.close();
  });

  return modal;
}

export function createFormModal(id, title, formHtml, onSubmit) {
  const modal = new Modal(id);
  modal.create(formHtml, {
    title,
    footer: `
      <button type="button" class="modal-btn-cancel" style="
        padding: 8px 16px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #1e293b;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      ">Cancel</button>
      <button type="button" class="modal-btn-submit" style="
        padding: 8px 16px;
        background: #008479;
        border: none;
        color: #fff;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      ">Submit</button>
    `,
  });

  modal.element.querySelector('.modal-btn-cancel').addEventListener('click', () => modal.close());
  modal.element.querySelector('.modal-btn-submit').addEventListener('click', () => {
    const form = modal.element.querySelector('form');
    if (form) {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData);
      onSubmit?.(data, modal);
    }
  });

  return modal;
}