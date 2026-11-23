// Google Maps iframe is loaded only after an explicit click (privacy + performance).
export function initMap() {
  document.querySelectorAll('[data-map]').forEach((box) => {
    const btn = box.querySelector('[data-map-load]');
    btn?.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = box.dataset.map;
      f.title = box.dataset.mapTitle || '';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.allowFullscreen = true;
      box.append(f);
      box.classList.add('is-loaded');
      btn.remove();
      f.focus();
    }, { once: true });
  });
}
