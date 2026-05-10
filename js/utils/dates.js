export function monthKey(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function prevMonth(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return monthKey(d);
}

export function nextMonth(key) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month, 1);
  return monthKey(d);
}

export function monthRange(startKey, endKey) {
  const months = [];
  let current = startKey;
  while (current <= endKey) {
    months.push(current);
    current = nextMonth(current);
  }
  return months;
}

export function daysInMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
