(() => {
  const key = 'study-guides-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => value === 'dark' || value === 'light';
  let preference;
  try { preference = localStorage.getItem(key); } catch {}
  function apply() {
    const dark = valid(preference) ? preference === 'dark' : media.matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#171b19' : '#ffffff';
    const toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', String(dark));
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-toggle').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
  });
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = event.newValue; apply(); }
  });
})();
