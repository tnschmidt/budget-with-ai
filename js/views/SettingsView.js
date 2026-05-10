import { getStorage, getConfig, saveConfig } from '../app.js';
import { createCategory, createRecurring } from '../models/models.js';
import { Modal, confirm } from '../components/Modal.js';
import { formatCurrency } from '../utils/currency.js';
import { toast } from '../utils/notify.js';

const CAT_COLORS = [
  '#4fc3f7','#2ecc71','#e74c3c','#f39c12','#9b59b6',
  '#1abc9c','#e67e22','#3498db','#e91e63','#00bcd4','#8bc34a','#ff5722',
];

const CAT_ICONS = ['🛒','🍽️','🚗','🏠','⚡','🎬','❤️','🛍️','💆','📱','💰','📦','☕','✈️','🎓','🏋️','🐾','🎁'];

export class SettingsView {
  constructor(root) {
    this._root = root;
    this._tab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'categories';
    this._render();
  }

  _render() {
    this._root.innerHTML = `
      <div class="page-header"><div class="page-title">Settings</div></div>
      <div class="tab-bar">
        <div class="tab-item ${this._tab === 'categories' ? 'active' : ''}" data-tab="categories">Categories</div>
        <div class="tab-item ${this._tab === 'recurring' ? 'active' : ''}" data-tab="recurring">Recurring</div>
        <div class="tab-item ${this._tab === 'general' ? 'active' : ''}" data-tab="general">General</div>
      </div>
      <div id="tab-content"></div>
    `;

    this._root.querySelectorAll('.tab-item').forEach(el => {
      el.addEventListener('click', () => {
        this._tab = el.dataset.tab;
        this._root.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.tab === this._tab));
        this._renderTab();
      });
    });

    this._renderTab();
  }

  _renderTab() {
    if (this._tab === 'categories') this._renderCategories();
    else if (this._tab === 'recurring') this._renderRecurring();
    else this._renderGeneral();
  }

  async _renderCategories() {
    const el = this._root.querySelector('#tab-content');
    const categories = await getStorage().getCategories();

    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Expense Categories</div>
        <div id="cat-list-expense"></div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Income Categories</div>
        <div id="cat-list-income"></div>
      </div>
      <button class="btn btn-secondary btn-full" id="add-cat-btn">+ Add Category</button>
    `;

    const expList = el.querySelector('#cat-list-expense');
    const incList = el.querySelector('#cat-list-income');

    categories.forEach(cat => {
      const item = this._catItem(cat, categories);
      (cat.type === 'income' ? incList : expList).appendChild(item);
    });

    el.querySelector('#add-cat-btn').addEventListener('click', () => {
      this._openCatForm(null, categories);
    });
  }

  _catItem(cat, allCats) {
    const el = document.createElement('div');
    el.className = 'cat-item';
    el.innerHTML = `
      <div class="cat-color-dot" style="background:${cat.color}"></div>
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-info">
        <div class="cat-name">${cat.name}</div>
        <div class="cat-budget">${cat.monthlyBudget ? 'Budget: ' + formatCurrency(cat.monthlyBudget) + '/mo' : 'No budget'}</div>
      </div>
      <div class="cat-actions">
        <button class="btn-icon" style="font-size:16px" data-action="edit">✏️</button>
        <button class="btn-icon" style="font-size:16px" data-action="delete">🗑️</button>
      </div>
    `;
    el.querySelector('[data-action="edit"]').addEventListener('click', () => this._openCatForm(cat, allCats));
    el.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      const ok = await confirm({ title: 'Delete Category', message: `Delete "${cat.name}"? Existing transactions won't be changed.`, confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      const updated = allCats.filter(c => c.id !== cat.id);
      await getStorage().saveCategories(updated);
      toast('Category deleted');
      this._renderCategories();
    });
    return el;
  }

  _openCatForm(cat, allCats) {
    let selectedColor = cat?.color || CAT_COLORS[0];
    let selectedIcon = cat?.icon || '📦';

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="field">
        <label>Name</label>
        <input type="text" id="cat-name" placeholder="Category name" value="${cat?.name || ''}">
      </div>
      <div class="field">
        <label>Type</label>
        <div class="type-toggle">
          <button type="button" data-type="expense" class="${(cat?.type || 'expense') === 'expense' ? 'active-expense' : ''}">Expense</button>
          <button type="button" data-type="income" class="${cat?.type === 'income' ? 'active-income' : ''}">Income</button>
        </div>
      </div>
      <div class="field">
        <label>Monthly Budget (optional)</label>
        <input type="number" id="cat-budget" inputmode="decimal" step="0.01" min="0"
          placeholder="Leave blank for none" value="${cat?.monthlyBudget || ''}">
      </div>
      <div class="field">
        <label>Color</label>
        <div class="color-picker" id="color-picker">
          ${CAT_COLORS.map(c => `<button class="color-swatch ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}"></button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Icon</label>
        <div class="color-picker" id="icon-picker">
          ${CAT_ICONS.map(i => `<button class="color-swatch" style="background:var(--bg-input);font-size:18px;display:flex;align-items:center;justify-content:center;border:2px solid ${i === selectedIcon ? '#fff' : 'transparent'}" data-icon="${i}">${i}</button>`).join('')}
        </div>
      </div>
      <div class="row" style="gap:var(--space-sm);margin-top:var(--space-md)">
        <button class="btn btn-secondary btn-full" data-action="cancel">Cancel</button>
        <button class="btn btn-primary btn-full" data-action="save">${cat ? 'Update' : 'Add'}</button>
      </div>
    `;

    let selectedType = cat?.type || 'expense';

    const modal = new Modal({ title: cat ? 'Edit Category' : 'New Category', content }).open();

    content.querySelectorAll('[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = btn.dataset.type;
        content.querySelectorAll('[data-type]').forEach(b => {
          b.className = '';
          if (b.dataset.type === selectedType) b.className = selectedType === 'expense' ? 'active-expense' : 'active-income';
        });
      });
    });

    content.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        content.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('selected', b.dataset.color === selectedColor));
      });
    });

    content.querySelectorAll('[data-icon]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedIcon = btn.dataset.icon;
        content.querySelectorAll('[data-icon]').forEach(b => b.style.borderColor = b.dataset.icon === selectedIcon ? '#fff' : 'transparent');
      });
    });

    content.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') { modal.close(); return; }
      if (action === 'save') {
        const name = content.querySelector('#cat-name').value.trim();
        if (!name) { toast('Enter a category name', 'error'); return; }
        const budget = parseFloat(content.querySelector('#cat-budget').value) || null;
        const updated = cat
          ? allCats.map(c => c.id === cat.id ? { ...c, name, type: selectedType, color: selectedColor, icon: selectedIcon, monthlyBudget: budget } : c)
          : [...allCats, createCategory({ name, type: selectedType, color: selectedColor, icon: selectedIcon, monthlyBudget: budget })];
        await getStorage().saveCategories(updated);
        toast(cat ? 'Category updated' : 'Category added');
        modal.close();
        this._renderCategories();
      }
    });
  }

  async _renderRecurring() {
    const el = this._root.querySelector('#tab-content');
    const recurring = await getStorage().getRecurringExpenses();

    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Monthly Recurring</div>
        <div id="rec-list"></div>
      </div>
      <button class="btn btn-secondary btn-full" id="add-rec-btn">+ Add Recurring</button>
    `;

    const list = el.querySelector('#rec-list');
    recurring.forEach(rec => list.appendChild(this._recItem(rec, recurring)));

    el.querySelector('#add-rec-btn').addEventListener('click', () => this._openRecForm(null, recurring));
  }

  _recItem(rec, allRec) {
    const el = document.createElement('div');
    el.className = 'rec-item';
    el.innerHTML = `
      <div class="rec-info">
        <div class="rec-name">${rec.name}</div>
        <div class="rec-meta">${rec.category} · Day ${rec.dayOfMonth}</div>
      </div>
      <div class="rec-amount">${formatCurrency(rec.amount)}</div>
      <label class="toggle">
        <input type="checkbox" ${rec.active ? 'checked' : ''}>
        <div class="toggle-track"></div>
      </label>
      <button class="btn-icon" style="font-size:16px" data-action="edit">✏️</button>
      <button class="btn-icon" style="font-size:16px" data-action="delete">🗑️</button>
    `;

    el.querySelector('input[type=checkbox]').addEventListener('change', async (e) => {
      const updated = allRec.map(r => r.id === rec.id ? { ...r, active: e.target.checked } : r);
      await getStorage().saveRecurringExpenses(updated);
    });

    el.querySelector('[data-action="edit"]').addEventListener('click', () => this._openRecForm(rec, allRec));
    el.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      const ok = await confirm({ title: 'Delete Recurring', message: `Delete "${rec.name}"?`, confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      await getStorage().saveRecurringExpenses(allRec.filter(r => r.id !== rec.id));
      toast('Deleted');
      this._renderRecurring();
    });

    return el;
  }

  async _openRecForm(rec, allRec) {
    const categories = await getStorage().getCategories();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="field">
        <label>Name</label>
        <input type="text" id="rec-name" placeholder="e.g. Netflix" value="${rec?.name || ''}">
      </div>
      <div class="field">
        <label>Amount</label>
        <input type="number" id="rec-amount" inputmode="decimal" step="0.01" min="0" value="${rec?.amount || ''}">
      </div>
      <div class="field">
        <label>Category</label>
        <select id="rec-category">
          ${categories.map(c => `<option value="${c.name}" ${c.name === (rec?.category || '') ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Merchant</label>
        <input type="text" id="rec-merchant" placeholder="Optional" value="${rec?.merchant || ''}">
      </div>
      <div class="field">
        <label>Day of Month</label>
        <input type="number" id="rec-day" min="1" max="28" value="${rec?.dayOfMonth || 1}">
      </div>
      <div class="row" style="gap:var(--space-sm);margin-top:var(--space-md)">
        <button class="btn btn-secondary btn-full" data-action="cancel">Cancel</button>
        <button class="btn btn-primary btn-full" data-action="save">${rec ? 'Update' : 'Add'}</button>
      </div>
    `;

    const modal = new Modal({ title: rec ? 'Edit Recurring' : 'New Recurring', content }).open();

    content.addEventListener('click', async (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') { modal.close(); return; }
      if (action === 'save') {
        const name = content.querySelector('#rec-name').value.trim();
        const amount = parseFloat(content.querySelector('#rec-amount').value);
        if (!name || !amount) { toast('Name and amount required', 'error'); return; }
        const updated = rec
          ? allRec.map(r => r.id === rec.id ? { ...r, name, amount, category: content.querySelector('#rec-category').value, merchant: content.querySelector('#rec-merchant').value.trim(), dayOfMonth: parseInt(content.querySelector('#rec-day').value) || 1 } : r)
          : [...allRec, createRecurring({ name, amount, category: content.querySelector('#rec-category').value, merchant: content.querySelector('#rec-merchant').value.trim(), dayOfMonth: parseInt(content.querySelector('#rec-day').value) || 1 })];
        await getStorage().saveRecurringExpenses(updated);
        toast(rec ? 'Updated' : 'Added');
        modal.close();
        this._renderRecurring();
      }
    });
  }

  async _renderGeneral() {
    const el = this._root.querySelector('#tab-content');
    const config = getConfig();

    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Claude API</div>
        <div class="field">
          <label>API Key</label>
          <input type="password" id="api-key" placeholder="sk-ant-..." value="${config.claudeApiKey || ''}">
        </div>
        <div class="field">
          <label>Proxy URL (optional)</label>
          <input type="url" id="proxy-url" placeholder="https://your-proxy.com/api" value="${config.claudeProxyUrl || ''}">
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:-8px 0 12px">
          The API key is stored in your browser only. Cost: ~$0.001 per voice entry.
        </p>
        <button class="btn btn-primary btn-full" id="save-api">Save API Settings</button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Storage</div>
        <div class="field">
          <label>Backend</label>
          <select id="storage-backend">
            <option value="localStorage" ${config.storageBackend !== 'firebase' ? 'selected' : ''}>Local Storage (this device only)</option>
            <option value="firebase" ${config.storageBackend === 'firebase' ? 'selected' : ''}>Firebase (shared across devices)</option>
          </select>
        </div>
        <div id="firebase-config" style="${config.storageBackend === 'firebase' ? '' : 'display:none'}">
          <div class="field">
            <label>Firebase API Key</label>
            <input type="text" id="fb-api-key" value="${config.firebaseConfig?.apiKey || ''}">
          </div>
          <div class="field">
            <label>Firebase Project ID</label>
            <input type="text" id="fb-project-id" value="${config.firebaseConfig?.projectId || ''}">
          </div>
          <div class="field">
            <label>Firebase App ID</label>
            <input type="text" id="fb-app-id" value="${config.firebaseConfig?.appId || ''}">
          </div>
        </div>
        <button class="btn btn-secondary btn-full" id="save-storage">Save Storage Settings</button>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Danger Zone</div>
        <div class="danger-zone">
          <div class="danger-zone-title">Reset App Data</div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-md)">
            Deletes all transactions, categories, and settings from this device.
          </p>
          <button class="btn btn-danger btn-full" id="reset-btn">Reset Everything</button>
        </div>
      </div>
    `;

    el.querySelector('#storage-backend').addEventListener('change', (e) => {
      el.querySelector('#firebase-config').style.display = e.target.value === 'firebase' ? '' : 'none';
    });

    el.querySelector('#save-api').addEventListener('click', async () => {
      await saveConfig({
        claudeApiKey: el.querySelector('#api-key').value.trim(),
        claudeProxyUrl: el.querySelector('#proxy-url').value.trim(),
      });
      toast('API settings saved');
    });

    el.querySelector('#save-storage').addEventListener('click', async () => {
      const backend = el.querySelector('#storage-backend').value;
      const updates = { storageBackend: backend };
      if (backend === 'firebase') {
        updates.firebaseConfig = {
          apiKey: el.querySelector('#fb-api-key').value.trim(),
          projectId: el.querySelector('#fb-project-id').value.trim(),
          appId: el.querySelector('#fb-app-id').value.trim(),
          authDomain: `${el.querySelector('#fb-project-id').value.trim()}.firebaseapp.com`,
          storageBucket: `${el.querySelector('#fb-project-id').value.trim()}.appspot.com`,
          messagingSenderId: '',
        };
      }
      await saveConfig(updates);
      toast('Storage settings saved. Reload to apply.', 'warning');
    });

    el.querySelector('#reset-btn').addEventListener('click', async () => {
      const ok = await confirm({ title: 'Reset Everything', message: 'This will delete ALL your data. This cannot be undone.', confirmLabel: 'Yes, Reset', danger: true });
      if (!ok) return;
      await getStorage().clearAll();
      toast('All data cleared', 'warning');
    });
  }
}
