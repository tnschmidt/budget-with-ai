import { DEFAULT_CATEGORIES } from '../models/models.js';
import { monthRange } from '../utils/dates.js';

const PREFIX = 'budget';
const key = (suffix) => `${PREFIX}:${suffix}`;
const txKey = (monthKey) => `${PREFIX}:transactions:${monthKey}`;

function load(k, fallback) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function save(k, value) {
  localStorage.setItem(k, JSON.stringify(value));
}

export class LocalStorageAdapter {
  // Transactions
  async getTransactions(mk) {
    return load(txKey(mk), []);
  }

  async addTransaction(txn) {
    const list = await this.getTransactions(txn.date.slice(0, 7));
    list.push(txn);
    save(txKey(txn.date.slice(0, 7)), list);
    return txn;
  }

  async updateTransaction(id, mk, changes) {
    const list = await this.getTransactions(mk);
    const idx = list.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');

    const updated = { ...list[idx], ...changes };

    // If date changed to a different month, move it
    const newMk = updated.date.slice(0, 7);
    if (newMk !== mk) {
      list.splice(idx, 1);
      save(txKey(mk), list);
      const newList = await this.getTransactions(newMk);
      newList.push(updated);
      save(txKey(newMk), newList);
    } else {
      list[idx] = updated;
      save(txKey(mk), list);
    }
    return updated;
  }

  async deleteTransaction(id, mk) {
    const list = await this.getTransactions(mk);
    save(txKey(mk), list.filter(t => t.id !== id));
  }

  async getTransactionsRange(startKey, endKey) {
    const months = monthRange(startKey, endKey);
    const arrays = await Promise.all(months.map(m => this.getTransactions(m)));
    return arrays.flat();
  }

  // Categories
  async getCategories() {
    const cats = load(key('categories'), null);
    if (!cats) {
      await this.saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return cats;
  }

  async saveCategories(categories) {
    save(key('categories'), categories);
  }

  // Recurring
  async getRecurringExpenses() {
    return load(key('recurring'), []);
  }

  async saveRecurringExpenses(expenses) {
    save(key('recurring'), expenses);
  }

  // Config
  async getConfig() {
    return load(key('config'), {});
  }

  async saveConfig(config) {
    save(key('config'), config);
  }

  // Utility
  async clearAll() {
    const toRemove = Object.keys(localStorage).filter(k => k.startsWith(PREFIX + ':'));
    toRemove.forEach(k => localStorage.removeItem(k));
  }

  // Migration helper
  async getAllData() {
    const config = await this.getConfig();
    const categories = await this.getCategories();
    const recurring = await this.getRecurringExpenses();
    const txKeys = Object.keys(localStorage)
      .filter(k => k.startsWith(`${PREFIX}:transactions:`))
      .map(k => k.replace(`${PREFIX}:transactions:`, ''));
    const transactions = {};
    for (const mk of txKeys) {
      transactions[mk] = await this.getTransactions(mk);
    }
    return { config, categories, recurring, transactions };
  }
}
