import { LocalStorageAdapter } from './services/LocalStorageAdapter.js';
import { FirebaseAdapter } from './services/FirebaseAdapter.js';
import { initRouter, registerRoute } from './router.js';
import { DashboardView } from './views/DashboardView.js';
import { TransactionsView } from './views/TransactionsView.js';
import { MonthlyView } from './views/MonthlyView.js';
import { SettingsView } from './views/SettingsView.js';
import { createTransaction } from './models/models.js';
import { monthKey } from './utils/dates.js';
import { toast } from './utils/notify.js';

let storage;
let config = {};

export function getStorage() { return storage; }
export function getConfig()  { return config; }

export async function saveConfig(updates) {
  config = { ...config, ...updates };
  await storage.saveConfig(config);
}

// Check if recurring expenses need to be applied for the current month.
// Shows a one-time prompt if any haven't been added yet.
async function checkRecurring() {
  const mk = monthKey();
  if (config.lastRecurringCheck === mk) return;

  const recurring = await storage.getRecurringExpenses();
  const active = recurring.filter(r => r.active);
  if (!active.length) return;

  const txns = await storage.getTransactions(mk);
  const missing = active.filter(r => !txns.some(t => t.recurringId === r.id));
  if (!missing.length) {
    await saveConfig({ lastRecurringCheck: mk });
    return;
  }

  // Show non-blocking toast with action
  const toastEl = document.createElement('div');
  toastEl.className = 'toast warning';
  toastEl.style.pointerEvents = 'auto';
  toastEl.style.cursor = 'pointer';
  toastEl.innerHTML = `Apply ${missing.length} recurring expense${missing.length > 1 ? 's' : ''} for this month? <strong>Tap to apply</strong>`;
  document.getElementById('toast-container').appendChild(toastEl);

  toastEl.addEventListener('click', async () => {
    toastEl.remove();
    for (const rec of missing) {
      const txn = createTransaction({
        date: `${mk}-${String(rec.dayOfMonth).padStart(2, '0')}`,
        amount: rec.amount,
        type: 'expense',
        category: rec.category,
        merchant: rec.merchant || rec.name,
        note: rec.note || rec.name,
        source: 'recurring',
        recurringId: rec.id,
      });
      await storage.addTransaction(txn);
    }
    await saveConfig({ lastRecurringCheck: mk });
    toast(`Applied ${missing.length} recurring expense${missing.length > 1 ? 's' : ''}`);
  });

  setTimeout(() => toastEl.remove(), 10000);
}

async function init() {
  // Config is always in localStorage (it's meta-config, not app data)
  const raw = localStorage.getItem('budget:config');
  config = raw ? JSON.parse(raw) : {};

  // Select storage backend
  if (config.storageBackend === 'firebase' && config.firebaseConfig) {
    storage = new FirebaseAdapter(config.firebaseConfig);
  } else {
    storage = new LocalStorageAdapter();
  }

  // Register routes
  registerRoute('dashboard',    root => new DashboardView(root));
  registerRoute('transactions', root => new TransactionsView(root));
  registerRoute('monthly',      root => new MonthlyView(root));
  registerRoute('settings',     root => new SettingsView(root));

  initRouter();
  checkRecurring();
}

document.addEventListener('DOMContentLoaded', init);
