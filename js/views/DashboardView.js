import { getStorage } from '../app.js';
import { monthKey, monthLabel, prevMonth, daysInMonth } from '../utils/dates.js';
import { formatCurrency } from '../utils/currency.js';
import { drawSparkline } from '../components/MiniChart.js';
import { renderBudgetBar } from '../components/BudgetBar.js';
import { TransactionForm } from '../components/TransactionForm.js';
import { navigate } from '../router.js';

export class DashboardView {
  constructor(root) {
    this._root = root;
    this._render();
  }

  async _render() {
    this._root.innerHTML = `
      <div class="page-header">
        <div class="page-title">Dashboard</div>
        <button class="btn-icon" id="dash-month-label" style="font-size:14px;width:auto;padding:0 var(--space-sm)">
          ${monthLabel(monthKey())}
        </button>
      </div>
      <div id="insights" class="insight-cards">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
      <button class="fab" id="fab" title="Add transaction">+</button>
    `;

    this._root.querySelector('#fab').addEventListener('click', () => {
      const form = new TransactionForm({ onSave: () => this._render() });
      form.open();
    });

    const currentMk = monthKey();
    const today = new Date();
    const dayOfMonth = today.getDate();
    const totalDays = daysInMonth(currentMk);

    // Load current + last 6 months
    const months = [];
    let mk = currentMk;
    for (let i = 0; i < 6; i++) { months.unshift(mk); mk = prevMonth(mk); }

    const [currentTxns, categories, ...historicalTxns] = await Promise.all([
      getStorage().getTransactions(currentMk),
      getStorage().getCategories(),
      ...months.slice(0, 5).map(m => getStorage().getTransactions(m)),
    ]);

    const allMonthTxns = [...historicalTxns, currentTxns]; // index 0 = oldest, last = current
    const monthlyExpenses = allMonthTxns.map(txns =>
      txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    );

    const currentExpenses = monthlyExpenses[monthlyExpenses.length - 1];
    const currentIncome = currentTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const lastMonthExpenses = monthlyExpenses[monthlyExpenses.length - 2] || 0;
    const delta = currentExpenses - lastMonthExpenses;

    // Spend by category (current month)
    const spendByCat = {};
    currentTxns.filter(t => t.type === 'expense').forEach(t => {
      spendByCat[t.category] = (spendByCat[t.category] || 0) + t.amount;
    });

    // Anomalies: compare current to 3-month average
    const anomalies = [];
    const catHistory = {}; // cat → [spend per prior month]
    historicalTxns.slice(-3).forEach(txns => {
      const m = {};
      txns.filter(t => t.type === 'expense').forEach(t => { m[t.category] = (m[t.category] || 0) + t.amount; });
      Object.entries(m).forEach(([cat, amt]) => { (catHistory[cat] = catHistory[cat] || []).push(amt); });
    });
    Object.entries(spendByCat).forEach(([cat, spend]) => {
      const history = catHistory[cat] || [];
      if (history.length >= 2) {
        const avg = history.reduce((s, v) => s + v, 0) / history.length;
        if (spend > avg * 1.5 && spend - avg > 20) {
          anomalies.push({ cat, spend, avg, pct: Math.round(((spend - avg) / avg) * 100) });
        }
      }
    });

    // Projected spend
    const dailyRate = dayOfMonth > 0 ? currentExpenses / dayOfMonth : 0;
    const projected = dailyRate * totalDays;

    // Savings rate
    const savingsRate = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome * 100) : null;

    // Top categories
    const expenseCats = categories.filter(c => c.type === 'expense');
    const catMap = Object.fromEntries(categories.map(c => [c.name, c]));
    const topCats = Object.entries(spendByCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Budget over-limit cats
    const overBudget = expenseCats.filter(c => c.monthlyBudget && (spendByCat[c.name] || 0) > c.monthlyBudget);

    const insightsEl = this._root.querySelector('#insights');
    insightsEl.innerHTML = '';

    // 1. Total this month
    const totalCard = this._card(`
      <div class="insight-card-header">
        <div class="insight-card-title">${monthLabel(currentMk)}</div>
        ${delta !== 0 ? `<span style="font-size:12px;color:${delta > 0 ? 'var(--negative)' : 'var(--positive)'}">
          ${delta > 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(delta))} vs last month
        </span>` : ''}
      </div>
      <div class="insight-card-value">${formatCurrency(currentExpenses)}</div>
      ${currentIncome ? `<div class="insight-card-sub">Income: ${formatCurrency(currentIncome)}</div>` : ''}
    `);
    insightsEl.appendChild(totalCard);

    // 2. Sparkline trend
    if (months.length >= 2) {
      const trendCard = this._card(`
        <div class="insight-card-title">6-Month Trend</div>
        <div class="sparkline-wrap">
          <canvas class="sparkline-canvas" id="sparkline" height="60"></canvas>
          <div class="sparkline-labels">
            ${months.map(m => `<span class="sparkline-label">${m.slice(5)}</span>`).join('')}
          </div>
        </div>
      `);
      insightsEl.appendChild(trendCard);
      requestAnimationFrame(() => {
        const canvas = insightsEl.querySelector('#sparkline');
        if (canvas) drawSparkline(canvas, monthlyExpenses);
      });
    }

    // 3. Budget health (categories with budgets)
    const budgetedCats = expenseCats.filter(c => c.monthlyBudget);
    if (budgetedCats.length) {
      const budgetCard = this._card(`
        <div class="insight-card-title" style="margin-bottom:var(--space-md)">Budget Health</div>
        <div id="budget-bars"></div>
      `);
      insightsEl.appendChild(budgetCard);

      const barsEl = budgetCard.querySelector('#budget-bars');
      budgetedCats.forEach(cat => {
        const spent = spendByCat[cat.name] || 0;
        const wrap = document.createElement('div');
        wrap.style.marginBottom = 'var(--space-md)';
        wrap.innerHTML = `
          <div class="row-between" style="margin-bottom:4px">
            <span style="font-size:14px"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">${cat.icon}</span> ${cat.name}</span>
            <span style="font-size:13px;color:var(--text-secondary)">${formatCurrency(spent)} / ${formatCurrency(cat.monthlyBudget)}</span>
          </div>
        `;
        const barWrap = document.createElement('div');
        renderBudgetBar(barWrap, { spent, budget: cat.monthlyBudget, showLabel: false });
        wrap.appendChild(barWrap);
        barsEl.appendChild(wrap);
      });
    }

    // 4. Over-budget alerts
    overBudget.forEach(cat => {
      const spent = spendByCat[cat.name] || 0;
      insightsEl.appendChild(this._card(`
        <div class="insight-card-header">
          <div class="insight-card-title" style="color:var(--negative)"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-2px">warning</span> Over Budget</div>
        </div>
        <div style="font-size:15px;font-weight:600"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">${cat.icon}</span> ${cat.name}</div>
        <div class="insight-card-sub">${formatCurrency(spent)} spent · ${formatCurrency(cat.monthlyBudget)} budget · ${formatCurrency(spent - cat.monthlyBudget)} over</div>
      `, 'over-budget-card'));
    });

    // 5. Anomalies
    anomalies.forEach(({ cat, spend, avg, pct }) => {
      insightsEl.appendChild(this._card(`
        <div class="insight-card-title">Spending Spike</div>
        <div style="font-size:15px;font-weight:600;margin-top:4px"><span class="material-symbols-outlined" style="font-size:16px;vertical-align:-3px">${catMap[cat]?.icon || 'category'}</span> ${cat} is ${pct}% above average</div>
        <div class="insight-card-sub">${formatCurrency(spend)} this month vs ${formatCurrency(avg)} avg</div>
      `, 'anomaly-card'));
    });

    // 6. Top categories
    if (topCats.length) {
      const topCard = this._card(`
        <div class="insight-card-title" style="margin-bottom:var(--space-sm)">Top Spending</div>
        <div class="top-cats">
          ${topCats.map(([name, amt], i) => {
            const cat = catMap[name] || {};
            const pct = currentExpenses ? Math.round((amt / currentExpenses) * 100) : 0;
            return `
              <div class="top-cat-row">
                <span class="top-cat-rank">#${i + 1}</span>
                <span class="material-symbols-outlined" style="font-size:20px">${cat.icon || 'category'}</span>
                <span class="top-cat-name">${name}</span>
                <span class="top-cat-amount">${formatCurrency(amt)}</span>
                <span style="font-size:12px;color:var(--text-muted);width:34px;text-align:right">${pct}%</span>
              </div>
            `;
          }).join('')}
        </div>
      `);
      insightsEl.appendChild(topCard);
    }

    // 7. Projected spend
    if (dayOfMonth > 3 && currentExpenses > 0) {
      insightsEl.appendChild(this._card(`
        <div class="insight-card-title">Projected Month-End</div>
        <div class="insight-card-value" style="font-size:22px">${formatCurrency(projected)}</div>
        <div class="insight-card-sub">At ${formatCurrency(dailyRate)}/day · Day ${dayOfMonth} of ${totalDays}</div>
      `));
    }

    // 8. Savings rate
    if (savingsRate !== null) {
      insightsEl.appendChild(this._card(`
        <div class="insight-card-title">Savings Rate</div>
        <div class="insight-card-value" style="font-size:28px;color:${savingsRate >= 0 ? 'var(--positive)' : 'var(--negative)'}">
          ${savingsRate.toFixed(1)}%
        </div>
        <div class="insight-card-sub">${formatCurrency(currentIncome - currentExpenses)} saved this month</div>
      `));
    }

    if (!insightsEl.children.length) {
      insightsEl.innerHTML = `<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">bar_chart</span></div><p>Add some transactions to see insights</p></div>`;
    }
  }

  _card(html, extraClass = '') {
    const el = document.createElement('div');
    el.className = `insight-card ${extraClass}`;
    el.innerHTML = html;
    return el;
  }
}
