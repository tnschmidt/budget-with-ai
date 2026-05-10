import { today } from '../utils/dates.js';

export function createTransaction(data = {}) {
  return {
    id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: data.date || today(),
    amount: parseFloat(data.amount) || 0,
    type: data.type || 'expense',
    category: data.category || 'Uncategorized',
    merchant: data.merchant || '',
    note: data.note || '',
    createdAt: new Date().toISOString(),
    source: data.source || 'manual',
    recurringId: data.recurringId || null,
    ...data,
  };
}

export function createCategory(data = {}) {
  return {
    id: data.id || `cat_${data.name?.toLowerCase().replace(/\s+/g, '_') || Date.now()}`,
    name: data.name || 'New Category',
    type: data.type || 'expense',
    color: data.color || '#4fc3f7',
    icon: data.icon || '📦',
    monthlyBudget: data.monthlyBudget ?? null,
    order: data.order ?? 99,
  };
}

export function createRecurring(data = {}) {
  return {
    id: data.id || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: data.name || '',
    amount: parseFloat(data.amount) || 0,
    category: data.category || 'Uncategorized',
    merchant: data.merchant || '',
    note: data.note || '',
    dayOfMonth: data.dayOfMonth || 1,
    active: data.active !== false,
  };
}

export const DEFAULT_CATEGORIES = [
  { name: 'Groceries',     type: 'expense', color: '#4fc3f7', icon: '🛒', order: 1 },
  { name: 'Dining',        type: 'expense', color: '#f39c12', icon: '🍽️', order: 2 },
  { name: 'Transport',     type: 'expense', color: '#3498db', icon: '🚗', order: 3 },
  { name: 'Housing',       type: 'expense', color: '#9b59b6', icon: '🏠', order: 4 },
  { name: 'Utilities',     type: 'expense', color: '#1abc9c', icon: '⚡', order: 5 },
  { name: 'Entertainment', type: 'expense', color: '#e91e63', icon: '🎬', order: 6 },
  { name: 'Health',        type: 'expense', color: '#2ecc71', icon: '❤️', order: 7 },
  { name: 'Shopping',      type: 'expense', color: '#e67e22', icon: '🛍️', order: 8 },
  { name: 'Personal Care', type: 'expense', color: '#00bcd4', icon: '💆', order: 9 },
  { name: 'Subscriptions', type: 'expense', color: '#ff5722', icon: '📱', order: 10 },
  { name: 'Income',        type: 'income',  color: '#2ecc71', icon: '💰', order: 11 },
  { name: 'Uncategorized', type: 'expense', color: '#666',    icon: '📦', order: 12 },
].map(createCategory);
