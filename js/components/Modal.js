export class Modal {
  constructor({ title, content, centered = false, onClose } = {}) {
    this._onClose = onClose;
    this._overlay = document.createElement('div');
    this._overlay.className = `modal-overlay${centered ? ' centered' : ''}`;

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet';

    if (!centered) {
      const handle = document.createElement('div');
      handle.className = 'modal-handle';
      sheet.appendChild(handle);
    }

    if (title) {
      const h = document.createElement('div');
      h.className = 'modal-title';
      h.textContent = title;
      sheet.appendChild(h);
    }

    if (typeof content === 'string') {
      sheet.insertAdjacentHTML('beforeend', content);
    } else if (content instanceof HTMLElement) {
      sheet.appendChild(content);
    }

    this._overlay.appendChild(sheet);
    this._sheet = sheet;

    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) this.close();
    });

    document.addEventListener('keydown', this._onKey = (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  open() {
    document.getElementById('modal-container').appendChild(this._overlay);
    // Focus first focusable element
    requestAnimationFrame(() => {
      const el = this._sheet.querySelector('input, select, textarea, button');
      el?.focus();
    });
    return this;
  }

  close() {
    this._overlay.remove();
    document.removeEventListener('keydown', this._onKey);
    this._onClose?.();
  }

  get sheet() { return this._sheet; }
}

export function confirm({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    const content = document.createElement('div');
    content.innerHTML = `
      <p style="color:var(--text-secondary);margin-bottom:var(--space-lg)">${message}</p>
      <div class="row" style="gap:var(--space-sm)">
        <button class="btn btn-secondary btn-full" data-action="cancel">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-full" data-action="confirm">${confirmLabel}</button>
      </div>
    `;
    const modal = new Modal({ title, content, centered: true, onClose: () => resolve(false) });
    modal.open();
    content.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'confirm') { modal.close(); resolve(true); }
      if (action === 'cancel')  { modal.close(); resolve(false); }
    });
  });
}
