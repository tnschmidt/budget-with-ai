import { getStorage } from '../app.js';
import { monthKey, monthLabel, prevMonth, nextMonth, formatDate } from '../utils/dates.js';
import { formatCurrency } from '../utils/currency.js';
import { renderBudgetBar } from '../components/BudgetBar.js';
import { exportCsv } from '../utils/csv.js';
import { TransactionForm } from '../components/TransactionForm.js';
import { getHashParam } from '../router.js';

export class MonthlyView {
  constructor(root) {
    this._root = root;
    this._mk = getHashParam('m') || monthKey();
    this._render();
  }

  _render() {
    this._root.innerHTML = `
      <div class="month-nav">
        <button class="btn-icon" id="prev-month"><span class="material-symbols-outlined">chevron_left</span></button>
        <span class="month-nav-label" id="month-label">${monthLabel(this._mk)}</span>
        <button class="btn-icon" id="next-month"><span class="material-symbols-outlined">chevron_right</span></button>
      </div>

      <div id="summary-row"></div>
      <div id="budget-table"></div>
      <div class="export-row">
        <button class="btn btn-secondary" id="export-btn">Export CSV</button>
      </div>
      <div class="section-header">Transactions</div>
      <div id="txn-list"><div class="loading-spinner"><div class="spinner"></div></div></div>
    `;

    this._wireNav();
    this._load();
  }

  _wireNav() {
    this._root.querySelector('#prev-month').addEventListener('click', () => {
      this._mk = prevMonth(this._mk);
      this._root.querySelector('#month-label').textContent = monthLabel(this._mk);
      this._load();
    });

    this._root.querySelector('#next-month').addEventListener('click', () => {
      if (this._mk >= monthKey()) return;
      this._mk = nextMonth(this._mk);
      this._root.querySelector('#month-label').textContent = monthLabel(this._mk);
      this._load();
    });

    this._root.querySelector('#export-btn').addEventListener('click', async () => {
      const txns = await getStorage().getTransactions(this._mk);
      exportCsv(txns, `budget-${this._mk}.csv`);
    });
  }

  async _load() {
    const [txns, categories] = await Promise.all([
      getStorage().getTransactions(this._mk),
      getStorage().getCategories(),
    ]);

    const totalIncome  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalExpense;

    this._root.querySelector('#summary-row').innerHTML = `
      <div class="summary-cards">
        <div class="summary-card">
          <div class="label">Income</div>
          <div class="value income">${formatCurrency(totalIncome)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Expenses</div>
          <div class="value expense">${formatCurrency(totalExpense)}</div>
        </div>
        <div class="summary-card">
          <div class="label">Net</div>
          <div class="value ${net >= 0 ? 'net-pos' : 'net-neg'}">${formatCurrency(net)}</div>
        </div>
      </div>
    `;

    const spendByCat = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      spendByCat[t.category] = (spendByCat[t.category] || 0) + t.amount;
    });

    const expenseCats = categories.filter(c => c.type === 'expense' && spendByCat[c.name]);
    const tableEl = this._root.querySelector('#budget-table');
    tableEl.innerHTML = '';

    if (expenseCats.length) {
      const label = document.createElement('div');
      label.className = 'section-header';
      label.textContent = 'By Category';
      tableEl.appendChild(label);

      const table = document.createElement('div');
      table.className = 'budget-table';

      expenseCats.sort((a, b) => (spendByCat[b.name] || 0) - (spendByCat[a.name] || 0)).forEach(cat => {
        const spent = spendByCat[cat.name] || 0;
        const row = document.createElement('div');
        row.className = 'budget-row';

        const pct = cat.monthlyBudget ? Math.round((spent / cat.monthlyBudget) * 100) : null;
        row.innerHTML = `
          <div class="budget-row-header">
            <div class="budget-row-name">
              <span class="material-symbols-outlined" style="font-size:18px">${cat.icon}</span>
              <span>${cat.name}</span>
            </div>
            <div class="budget-row-amounts">
              <span class="spent">${formatCurrency(spent)}</span>
              ${cat.monthlyBudget ? ` <span>/ ${formatCurrency(cat.monthlyBudget)} (${pct}%)</span>` : ''}
            </div>
          </div>
          ${cat.monthlyBudget ? `<div id="bar-${cat.id}"></div>` : ''}
        `;
        table.appendChild(row);

        if (cat.monthlyBudget) {
          renderBudgetBar(row.querySelector(`#bar-${cat.id}`), { spent, budget: cat.monthlyBudget, showLabel: false });
        }
      });

      tableEl.appendChild(table);
    }

    const listEl = this._root.querySelector('#txn-list');
    txns.sort((a, b) => b.date.localeCompare(a.date));

    if (!txns.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">inbox</span></div><p>No transactions</p></div>`;
      return;
    }

    const catMap = Object.fromEntries(categories.map(c => [c.name, c]));
    const groups = {};
    txns.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });

    listEl.innerHTML = '';
    for (const date of Object.keys(groups).sort().reverse()) {
      const label = document.createElement('div');
      label.className = 'txn-date-group';
      label.textContent = formatDate(date);
      listEl.appendChild(label);

      for (const txn of groups[date]) {
        const cat = catMap[txn.category] || {};
        const row = document.createElement('div');
        row.className = 'txn-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
          <span class="material-symbols-outlined" style="font-size:22px">${cat.icon || 'category'}</span>
          <div class="txn-info">
            <div class="txn-merchant">${txn.merchant || txn.category}</div>
            <div class="txn-meta"><span class="txn-date">${txn.category}</span></div>
          </div>
          <div class="txn-amount ${txn.type}">${txn.type === 'expense' ? '-' : '+'}${formatCurrency(txn.amount)}</div>
        `;
        row.addEventListener('click', async () => {
          const form = new TransactionForm({ existing: txn, onSave: () => this._load() });
          await form.open(txn);
        });
        listEl.appendChild(row);
      }
    }
  }
}
