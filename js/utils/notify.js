let container;

function getContainer() {
  if (!container) {
    container = document.getElementById('toast-container');
  }
  return container;
}

export function toast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  getContainer().appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
