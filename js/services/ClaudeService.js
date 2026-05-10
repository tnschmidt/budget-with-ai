import { getConfig } from '../app.js';
import { today } from '../utils/dates.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

function systemPrompt(categoryNames, todayDate) {
  return `You are a financial transaction parser. Extract transaction details from the user's spoken input and return ONLY a valid JSON object. No explanation, no markdown, no code fences.

Return exactly this JSON structure:
{"date":"YYYY-MM-DD","amount":0.00,"type":"expense","category":"Name","merchant":"","note":""}

Rules:
- date: resolve relative dates ("yesterday", "last Tuesday") using today's date: ${todayDate}. Default to today if unclear.
- amount: ALWAYS a positive number (never a string). Convert spoken amounts: "six fifty" = 6.50, "twelve dollars" = 12.00, "a dollar twenty five" = 1.25, "forty" = 40.00, "five bucks" = 5.00. Never put the dollar amount in the note field.
- type: "expense" or "income"
- category: pick the best match from this list (or "Uncategorized"): ${categoryNames.join(', ')}
- merchant: business/store name, or empty string
- note: any additional context EXCEPT the amount — never include the dollar amount here`;
}

export class ClaudeService {
  async parseTransaction(transcript, categories) {
    const config = getConfig();
    const apiKey = config.claudeApiKey;
    const proxyUrl = config.claudeProxyUrl;

    if (!apiKey && !proxyUrl) {
      throw new Error('NO_API_KEY');
    }

    const url = proxyUrl || ANTHROPIC_URL;
    const categoryNames = categories.map(c => c.name);
    const todayDate = today();

    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-request-source': 'user-triggered',
    };

    if (!proxyUrl && apiKey) {
      headers['x-api-key'] = apiKey;
    }

    const body = {
      model: MODEL,
      max_tokens: 256,
      system: systemPrompt(categoryNames, todayDate),
      messages: [{ role: 'user', content: transcript }],
    };

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('NETWORK_ERROR');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text || '';

    // Strip accidental markdown fences
    const cleaned = raw.replace(/```(?:json)?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('PARSE_ERROR');
    }

    // Coerce amount to number in case Claude returned a string
    if (typeof parsed.amount === 'string') {
      parsed.amount = parseFloat(parsed.amount.replace(/[^0-9.]/g, ''));
    }

    // Validate required fields
    if (typeof parsed.amount !== 'number' || isNaN(parsed.amount) || parsed.amount <= 0) {
      throw new Error('PARSE_ERROR');
    }

    return {
      date: parsed.date || todayDate,
      amount: parsed.amount,
      type: parsed.type === 'income' ? 'income' : 'expense',
      category: parsed.category || 'Uncategorized',
      merchant: parsed.merchant || '',
      note: parsed.note || '',
      source: 'speech',
    };
  }
}
