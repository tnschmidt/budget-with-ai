import { DEFAULT_CATEGORIES } from '../models/models.js';
import { monthRange } from '../utils/dates.js';

// Firestore schema:
// /transactions/{monthKey}/items/{id}
// /categories  (single doc "list")
// /recurring   (single doc "list")
// /config      (single doc "data")

export class FirebaseAdapter {
  constructor(firebaseConfig) {
    this._config = firebaseConfig;
    this._db = null;
    this._cache = new Map(); // monthKey → Transaction[]
  }

  async _init() {
    if (this._db) return;
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, collection, doc, getDoc, setDoc, getDocs, deleteDoc, writeBatch }
      = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const app = getApps().length ? getApps()[0] : initializeApp(this._config);
    this._db = getFirestore(app);
    this._fs = { collection, doc, getDoc, setDoc, getDocs, deleteDoc, writeBatch };
  }

  async getTransactions(mk) {
    if (this._cache.has(mk)) return this._cache.get(mk);
    await this._init();
    const { collection, getDocs } = this._fs;
    const snap = await getDocs(collection(this._db, 'transactions', mk, 'items'));
    const list = snap.docs.map(d => d.data());
    this._cache.set(mk, list);
    return list;
  }

  async addTransaction(txn) {
    await this._init();
    const { doc, setDoc } = this._fs;
    const mk = txn.date.slice(0, 7);
    await setDoc(doc(this._db, 'transactions', mk, 'items', txn.id), txn);
    this._cache.delete(mk);
    return txn;
  }

  async updateTransaction(id, mk, changes) {
    await this._init();
    const { doc, getDoc, setDoc, deleteDoc } = this._fs;
    const ref = doc(this._db, 'transactions', mk, 'items', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Transaction not found');
    const updated = { ...snap.data(), ...changes };
    const newMk = updated.date.slice(0, 7);
    if (newMk !== mk) {
      await deleteDoc(ref);
      await setDoc(doc(this._db, 'transactions', newMk, 'items', id), updated);
      this._cache.delete(mk);
      this._cache.delete(newMk);
    } else {
      await setDoc(ref, updated);
      this._cache.delete(mk);
    }
    return updated;
  }

  async deleteTransaction(id, mk) {
    await this._init();
    const { doc, deleteDoc } = this._fs;
    await deleteDoc(doc(this._db, 'transactions', mk, 'items', id));
    this._cache.delete(mk);
  }

  async getTransactionsRange(startKey, endKey) {
    const months = monthRange(startKey, endKey);
    const arrays = await Promise.all(months.map(m => this.getTransactions(m)));
    return arrays.flat();
  }

  async _getDoc(path, fallback) {
    await this._init();
    const { doc, getDoc } = this._fs;
    const snap = await getDoc(doc(this._db, ...path.split('/')));
    return snap.exists() ? snap.data().value : fallback;
  }

  async _setDoc(path, value) {
    await this._init();
    const { doc, setDoc } = this._fs;
    await setDoc(doc(this._db, ...path.split('/')), { value });
  }

  async getCategories() {
    const cats = await this._getDoc('meta/categories', null);
    if (!cats) { await this.saveCategories(DEFAULT_CATEGORIES); return DEFAULT_CATEGORIES; }
    return cats;
  }

  async saveCategories(categories) { await this._setDoc('meta/categories', categories); }

  async getRecurringExpenses() { return this._getDoc('meta/recurring', []); }
  async saveRecurringExpenses(expenses) { await this._setDoc('meta/recurring', expenses); }

  async getConfig() { return this._getDoc('meta/config', {}); }
  async saveConfig(config) { await this._setDoc('meta/config', config); }

  async clearAll() {
    await this._init();
    const { collection, getDocs, writeBatch, doc } = this._fs;
    const batch = writeBatch(this._db);
    const mSnap = await getDocs(collection(this._db, 'transactions'));
    for (const mDoc of mSnap.docs) {
      const iSnap = await getDocs(collection(this._db, 'transactions', mDoc.id, 'items'));
      iSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(mDoc.ref);
    }
    batch.delete(doc(this._db, 'meta', 'categories'));
    batch.delete(doc(this._db, 'meta', 'recurring'));
    batch.delete(doc(this._db, 'meta', 'config'));
    await batch.commit();
    this._cache.clear();
  }
}
