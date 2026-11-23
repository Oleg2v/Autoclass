// Desktop-only cursor: a precise dot plus a trailing ring that labels interactive targets.
export function initCursor() {
  const root = document.querySelector('.cursor');
  if (!root) return;
  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');
  const label = ring.querySelector('span');
  document.documentElement.classList.add('has-cursor');

  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0, shown = false;
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!shown) { shown = true; root.style.opacity = '1'; rx = x; ry = y; }
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { root.style.opacity = '0'; shown = false; });

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, [role="slider"], [data-cursor-label]');
    const lbl = t?.closest('[data-cursor-label]')?.dataset.cursorLabel;
    root.classList.toggle('is-hover', !!t && !lbl);
    root.classList.toggle('is-label', !!lbl);
    if (lbl) label.textContent = lbl;
    root.classList.toggle('is-light', !!e.target.closest('.on-light'));
  });
  addEventListener('pointerdown', () => ring.animate([{ scale: 1 }, { scale: 0.85 }, { scale: 1 }], { duration: 300 }));
}
