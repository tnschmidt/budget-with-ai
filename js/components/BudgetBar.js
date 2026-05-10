import { formatCurrency } from '../utils/currency.js';

export function renderBudgetBar(container, { spent, budget, showLabel = true }) {
  const pct = budget ? Math.min((spent / budget) * 100, 100) : 0;
  const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : '';

  container.innerHTML = `
    <div class="budget-bar-wrap">
      ${showLabel ? `<div class="row-between" style="font-size:12px;color:var(--text-muted)">
        <span>${formatCurrency(spent)} spent</span>
        ${budget ? `<span>${formatCurrency(budget - spent)} left</span>` : ''}
      </div>` : ''}
      <div class="budget-bar-track">
        <div class="budget-bar-fill ${status}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}
