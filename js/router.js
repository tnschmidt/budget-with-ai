const routes = {};
let currentRoute = null;

export function registerRoute(hash, renderFn) {
  routes[hash] = renderFn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function currentHash() {
  return window.location.hash.slice(1).split('?')[0] || 'dashboard';
}

export function getHashParam(name) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  return params.get(name);
}

function render() {
  const hash = currentHash();
  const fn = routes[hash] || routes['dashboard'];
  if (!fn) return;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === hash);
  });

  const root = document.getElementById('app-root');
  root.innerHTML = '';
  fn(root);
  currentRoute = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  render();
}
