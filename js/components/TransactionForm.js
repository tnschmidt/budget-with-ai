import { getStorage } from '../app.js';
import { Modal } from './Modal.js';
import { createTransaction } from '../models/models.js';
import { today, monthKey } from '../utils/dates.js';
import { toast } from '../utils/notify.js';

const CATEGORY_COLORS = [
  '#4fc3f7','#2ecc71','#e74c3c','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#3498db','#e91e63','#00bcd4','#8bc34a','#ff5722'
];

export class TransactionForm {
  constructor({ onSave, existing = null } = {}) {
    this._onSave = onSave;
    this._existing = existing;
    this._modal = null;
  }

  async open(prefill = {}) {
    const categories = await getStorage().getCategories();
    const data = { ...prefill };
    const isEdit = !!this._existing;

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="field">
        <label>Type</label>
        <div class="type-toggle">
          <button type="button" data-type="expense" class="${(data.type || 'expense') === 'expense' ? 'active-expense' : ''}">Expense</button>
          <button type="button" data-type="income" class="${data.type === 'income' ? 'active-income' : ''}">Income</button>
        </div>
      </div>
      <div class="field">
        <label>Amount</label>
        <input type="number" id="f-amount" inputmode="decimal" step="0.01" min="0"
          placeholder="0.00" value="${data.amount || ''}">
      </div>
      <div class="field">
        <label>Category</label>
        <select id="f-category">
          ${categories.map(c => `<option value="${c.name}" ${c.name === (data.category || 'Uncategorized') ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Merchant</label>
        <input type="text" id="f-merchant" placeholder="Where?" value="${data.merchant || ''}">
      </div>
      <div class="field">
        <label>Date</label>
        <input type="date" id="f-date" value="${data.date || today()}">
      </div>
      <div class="field">
        <label>Note</label>
        <input type="text" id="f-note" placeholder="Optional note" value="${data.note || ''}">
      </div>
      <div class="row" style="gap:var(--space-sm);margin-top:var(--space-md)">
        ${isEdit ? `<button type="button" class="btn btn-danger" style="flex:0 0 auto" data-action="delete">Delete</button>` : ''}
        <button type="button" class="btn btn-secondary btn-full" data-action="cancel">Cancel</button>
        <button type="button" class="btn btn-primary btn-full" data-action="save">${isEdit ? 'Update' : 'Save'}</button>
      </div>
    `;

    this._modal = new Modal({
      title: isEdit ? 'Edit Transaction' : 'Add Transaction',
      content,
      onClose: () => {},
    }).open();

    // Type toggle
    let selectedType = data.type || 'expense';
    content.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = btn.dataset.type;
        content.querySelectorAll('[data-type]').forEach(b => {
          b.className = '';
          if (b.dataset.type === selectedType) {
            b.className = selectedType === 'expense' ? 'active-expense' : 'active-income';
          }
        });
      });
    });

    content.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      if (action === 'cancel') { this._modal.close(); return; }

      if (action === 'delete') {
        const { confirm } = await import('./Modal.js');
        const ok = await confirm({ title: 'Delete Transaction', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        const mk = this._existing.date.slice(0, 7);
        await getStorage().deleteTransaction(this._existing.id, mk);
        toast('Transaction deleted');
        this._modal.close();
        this._onSave?.();
        return;
      }

      if (action === 'save') {
        const amount = parseFloat(content.querySelector('#f-amount').value);
        if (!amount || amount <= 0) {
          toast('Enter a valid amount', 'error');
          return;
        }

        const txnData = {
          amount,
          type: selectedType,
          category: content.querySelector('#f-category').value,
          merchant: content.querySelector('#f-merchant').value.trim(),
          date: content.querySelector('#f-date').value,
          note: content.querySelector('#f-note').value.trim(),
        };

        if (isEdit) {
          await getStorage().updateTransaction(
            this._existing.id,
            this._existing.date.slice(0, 7),
            txnData
          );
          toast('Transaction updated');
        } else {
          const txn = createTransaction({ ...txnData, source: data.source || 'manual' });
          await getStorage().addTransaction(txn);
          toast('Transaction saved');
        }

        this._modal.close();
        this._onSave?.();
      }
    });

    // Focus amount field
    content.querySelector('#f-amount')?.focus();
  }
}
