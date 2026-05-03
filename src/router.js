// Page render functions - set by main.js
const pages = {};

export function register(name, renderFn) {
  pages[name] = renderFn;
}

export function navigate(hash) {
  const name = hash.replace('#', '') || 'home';

  const app = document.getElementById('app');
  if (!app) return;

  if (pages[name]) {
    pages[name](app);
  } else {
    pages['home'](app);
  }
}

export function initRouter() {
  window.addEventListener('hashchange', () => {
    navigate(window.location.hash);
  });

  // Initial route
  navigate(window.location.hash || '#home');
}
