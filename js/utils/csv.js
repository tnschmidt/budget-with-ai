export function exportCsv(transactions, filename = 'budget-export.csv') {
  const headers = ['Date', 'Merchant', 'Category', 'Type', 'Amount', 'Note'];
  const rows = transactions.map(t => [
    t.date,
    t.merchant || '',
    t.category,
    t.type,
    t.amount.toFixed(2),
    t.note || '',
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
