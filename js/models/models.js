export function createTransaction(data = {}) {
  return {
    id: data.id || `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: data.date || new Date().toISOString().slice(0, 10),
    amount: data.amount || 0,
    type: data.type || 'expense',
    category: data.category || 'Uncategorized',
    merchant: data.merchant || '',
    note: data.note || '',
    createdAt: data.createdAt || new Date().toISOString(),
    source: data.source || 'manual',
    recurringId: data.recurringId || null,
  };
}

export function createCategory(data = {}) {
  return {
    id: data.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name || 'New Category',
    type: data.type || 'expense',
    color: data.color || '#4fc3f7',
    icon: data.icon || 'category',
    monthlyBudget: data.monthlyBudget ?? null,
    order: data.order ?? 99,
  };
}

export function createRecurring(data = {}) {
  return {
    id: data.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name || '',
    amount: data.amount || 0,
    category: data.category || 'Uncategorized',
    merchant: data.merchant || '',
    note: data.note || '',
    dayOfMonth: data.dayOfMonth || 1,
    active: data.active !== false,
  };
}

export const DEFAULT_CATEGORIES = [
  { name: 'Groceries',     type: 'expense', color: '#4fc3f7', icon: 'shopping_cart',  order: 1 },
  { name: 'Dining',        type: 'expense', color: '#f39c12', icon: 'restaurant',     order: 2 },
  { name: 'Transport',     type: 'expense', color: '#3498db', icon: 'directions_car', order: 3 },
  { name: 'Housing',       type: 'expense', color: '#9b59b6', icon: 'home',           order: 4 },
  { name: 'Utilities',     type: 'expense', color: '#1abc9c', icon: 'bolt',           order: 5 },
  { name: 'Entertainment', type: 'expense', color: '#e91e63', icon: 'movie',          order: 6 },
  { name: 'Health',        type: 'expense', color: '#2ecc71', icon: 'favorite',       order: 7 },
  { name: 'Shopping',      type: 'expense', color: '#e67e22', icon: 'shopping_bag',   order: 8 },
  { name: 'Personal Care', type: 'expense', color: '#00bcd4', icon: 'spa',            order: 9 },
  { name: 'Subscriptions', type: 'expense', color: '#ff5722', icon: 'smartphone',     order: 10 },
  { name: 'Income',        type: 'income',  color: '#2ecc71', icon: 'payments',       order: 11 },
  { name: 'Uncategorized', type: 'expense', color: '#666',    icon: 'category',       order: 12 },
].map(createCategory);
