export function initHeader() {
  const hdr = document.querySelector('[data-header]');
  const menu = document.getElementById('menu');
  // close the popover menu after choosing a section
  menu?.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu-link]')) menu.hidePopover?.();
  });
  if (!hdr) return;
  let lastY = scrollY;
  let ticking = false;
  const update = () => {
    const y = scrollY;
    hdr.classList.toggle('is-solid', y > 40);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > innerHeight * 0.6 && !menu?.matches(':popover-open')) hdr.classList.add('is-hidden');
    else if (goingUp || y < 80) hdr.classList.remove('is-hidden');
    lastY = y;
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  hdr.addEventListener('focusin', () => hdr.classList.remove('is-hidden'));
  update();

  // current-section highlight in the nav
  const links = [...hdr.querySelectorAll('[data-nav]')];
  const map = new Map(links.map((a) => [a.dataset.nav, a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        links.forEach((a) => a.classList.remove('is-current'));
        map.get(e.target.id)?.classList.add('is-current');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
