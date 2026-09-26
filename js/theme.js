(() => {
  'use strict';
  const key = 'lt-words-theme';
  const root = document.documentElement;
  let theme = 'light';
  try {
    if (localStorage.getItem(key) === 'dark') theme = 'dark';
  } catch { /* The toggle still works when storage is unavailable. */ }

  function apply(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'dark' ? '#111827' : '#f7f9fc'
    );
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
      button.querySelector('span').textContent = theme === 'dark' ? '☀' : '☾';
    }
  }

  // Run before the stylesheet and first paint to avoid a light flash.
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    apply(theme);
    button.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); } catch { /* Session-only choice. */ }
    });
  }, { once: true });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      // Re-read to handle clear() and rapid changes in other tabs.
      try { apply(localStorage.getItem(key)); } catch { /* Keep this tab's choice. */ }
    }
  });
})();
