import { getStorage } from '../app.js';
import { SpeechCapture } from '../components/SpeechCapture.js';
import { ClaudeService } from '../services/ClaudeService.js';
import { TransactionForm } from '../components/TransactionForm.js';
import { formatCurrency } from '../utils/currency.js';
import { monthKey, monthLabel, prevMonth, nextMonth, today, formatDate } from '../utils/dates.js';
import { toast } from '../utils/notify.js';
import { navigate } from '../router.js';

export class TransactionsView {
  constructor(root) {
    this._root = root;
    this._mk = monthKey();
    this._speech = new SpeechCapture({
      onError: (err) => {
        if (err === 'not-allowed') {
          this._showMicBanner('Microphone access denied. Please allow microphone access in your browser settings.');
        } else {
          toast('Speech error: ' + err, 'error');
        }
        this._setMicState('idle');
      },
    });
    this._claude = new ClaudeService();
    this._pendingTranscript = '';
    this._render();
  }

  _render() {
    this._root.innerHTML = `
      <div class="page-header">
        <div class="page-title">Transactions</div>
      </div>

      ${!this._speech.supported ? `
        <div class="mic-unavailable-banner">
          Voice input is not supported in this browser. Use manual entry below.
        </div>
      ` : ''}

      <div id="mic-banner" style="display:none" class="mic-unavailable-banner"></div>

      ${this._speech.supported ? `
        <div class="mic-section">
          <button class="mic-btn" id="mic-btn" title="Tap to speak"><span class="material-symbols-outlined" style="font-size:36px">mic</span></button>
          <div class="mic-status" id="mic-status">Tap to speak an expense</div>
          <div class="mic-transcript" id="mic-transcript"></div>
        </div>
      ` : ''}

      <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg)">
        <button class="btn btn-secondary btn-full" id="manual-btn">+ Add Manually</button>
      </div>

      <div class="month-nav">
        <button class="btn-icon" id="prev-month"><span class="material-symbols-outlined">chevron_left</span></button>
        <span class="month-nav-label" id="month-label">${monthLabel(this._mk)}</span>
        <button class="btn-icon" id="next-month"><span class="material-symbols-outlined">chevron_right</span></button>
      </div>

      <div id="txn-list">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    `;

    this._wireMic();
    this._wireNav();
    this._loadList();
  }

  _wireMic() {
    const btn = this._root.querySelector('#mic-btn');
    if (!btn) return;

    const statusEl = this._root.querySelector('#mic-status');
    const transcriptEl = this._root.querySelector('#mic-transcript');

    this._speech.onStateChange((state) => {
      btn.className = `mic-btn ${state === 'listening' ? 'listening' : state === 'loading' ? 'loading' : ''}`;
      statusEl.textContent = state === 'listening' ? 'Listening...' : state === 'loading' ? 'Parsing...' : 'Tap to speak an expense';
    });

    this._speech.onTranscript(async (text, isFinal) => {
      transcriptEl.textContent = text;
      if (isFinal) {
        this._pendingTranscript = text;
        await this._parseSpeech(text);
      }
    });

    btn.addEventListener('click', () => {
      if (this._speech.listening) {
        this._speech.stop();
      } else {
        transcriptEl.textContent = '';
        this._speech.start();
      }
    });
  }

  async _parseSpeech(transcript) {
    const statusEl = this._root.querySelector('#mic-status');
    const btn = this._root.querySelector('#mic-btn');
    btn?.classList.add('loading');
    if (statusEl) statusEl.textContent = 'Parsing with AI...';

    try {
      const categories = await getStorage().getCategories();
      const parsed = await this._claude.parseTransaction(transcript, categories);
      const form = new TransactionForm({ onSave: () => this._loadList() });
      await form.open(parsed);
    } catch (err) {
      if (err.message === 'NO_API_KEY') {
        toast('Add your Claude API key in Settings first', 'warning');
        navigate('settings');
      } else if (err.message === 'PARSE_ERROR') {
        toast('Could not parse — opening manual form', 'warning');
        const form = new TransactionForm({ onSave: () => this._loadList() });
        await form.open({ note: transcript, source: 'speech' });
      } else if (err.message === 'NETWORK_ERROR') {
        toast('Cannot reach Claude API — set a Proxy URL in Settings or disable browser extensions', 'error');
        const form = new TransactionForm({ onSave: () => this._loadList() });
        await form.open({ note: transcript, source: 'speech' });
      } else {
        toast('AI error: ' + err.message, 'error');
        const form = new TransactionForm({ onSave: () => this._loadList() });
        await form.open({ note: transcript, source: 'speech' });
      }
    } finally {
      btn?.classList.remove('loading');
      const s = this._root.querySelector('#mic-status');
      if (s) s.textContent = 'Tap to speak an expense';
    }
  }

  _showMicBanner(msg) {
    const el = this._root.querySelector('#mic-banner');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  _wireNav() {
    this._root.querySelector('#prev-month')?.addEventListener('click', () => {
      this._mk = prevMonth(this._mk);
      this._root.querySelector('#month-label').textContent = monthLabel(this._mk);
      this._loadList();
    });

    this._root.querySelector('#next-month')?.addEventListener('click', () => {
      if (this._mk >= monthKey()) return;
      this._mk = nextMonth(this._mk);
      this._root.querySelector('#month-label').textContent = monthLabel(this._mk);
      this._loadList();
    });

    this._root.querySelector('#manual-btn')?.addEventListener('click', () => {
      const form = new TransactionForm({ onSave: () => this._loadList() });
      form.open();
    });
  }

  async _loadList() {
    const listEl = this._root.querySelector('#txn-list');
    if (!listEl) return;

    const txns = await getStorage().getTransactions(this._mk);
    txns.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt?.localeCompare(a.createdAt || '') || 0);

    if (!txns.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon"><span class="material-symbols-outlined">inbox</span></div><p>No transactions this month</p></div>`;
      return;
    }

    // Group by date
    const groups = {};
    txns.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });

    listEl.innerHTML = '';
    const categories = await getStorage().getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.name, c]));

    for (const date of Object.keys(groups).sort().reverse()) {
      const label = document.createElement('div');
      label.className = 'txn-date-group';
      label.textContent = formatDate(date);
      listEl.appendChild(label);

      for (const txn of groups[date]) {
        const cat = catMap[txn.category] || {};
        const row = document.createElement('div');
        row.className = 'txn-row';
        row.innerHTML = `
          <span class="material-symbols-outlined" style="font-size:22px">${cat.icon || 'category'}</span>
          <div class="txn-info">
            <div class="txn-merchant">${txn.merchant || txn.category}</div>
            <div class="txn-meta">
              <span class="txn-date">${txn.category}</span>
              ${txn.note ? `<span class="txn-date">· ${txn.note}</span>` : ''}
            </div>
          </div>
          <div class="txn-amount ${txn.type}">${txn.type === 'expense' ? '-' : '+'}${formatCurrency(txn.amount)}</div>
        `;
        row.addEventListener('click', async () => {
          const form = new TransactionForm({ existing: txn, onSave: () => this._loadList() });
          await form.open(txn);
        });
        listEl.appendChild(row);
      }
    }
  }
}
