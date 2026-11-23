// Before → paint booth → after: a draggable repair timeline over three real photos.
// RTL: value grows from right (before) to left (after), arrow keys follow the visual direction.
export function initSlider(reduce) {
  document.querySelectorAll('[data-ba]').forEach((root) => {
    const handle = root.querySelector('[data-ba-handle]');
    const track = root.querySelector('[data-ba-track]');
    const frames = [...root.querySelectorAll('[data-ba-frame]')];
    const gos = [...root.querySelectorAll('[data-ba-go]')];
    const texts = JSON.parse(root.dataset.baText || '[]');
    let v = 0, anim = 0;

    const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
    const render = () => {
      const p = v / 100;
      const b = clamp(p * 2);
      const c = clamp(p * 2 - 1);
      frames[0].style.transform = `scale(${(1 + p * 0.18).toFixed(4)})`;
      frames[1].style.opacity = b.toFixed(3);
      frames[1].style.transform = `scale(${(1.14 - 0.14 * b + c * 0.1).toFixed(4)})`;
      frames[2].style.opacity = c.toFixed(3);
      frames[2].style.transform = `scale(${(1.4 - 0.4 * c).toFixed(4)})`;
      root.style.setProperty('--v', v.toFixed(2));
      const seg = v < 34 ? 0 : v < 67 ? 1 : 2;
      handle.setAttribute('aria-valuenow', String(Math.round(v)));
      if (texts[seg]) handle.setAttribute('aria-valuetext', texts[seg]);
      gos.forEach((g, i) => g.setAttribute('aria-pressed', String(i === seg)));
    };
    const set = (n) => { v = clamp(n, 0, 100); render(); };
    const tweenTo = (to, dur = 700) => {
      cancelAnimationFrame(anim);
      if (reduce) return set(to);
      const from = v, t0 = performance.now();
      const tick = (now) => {
        const k = clamp((now - t0) / dur);
        set(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) anim = requestAnimationFrame(tick);
      };
      anim = requestAnimationFrame(tick);
    };
    const fromPointer = (clientX) => {
      const r = track.getBoundingClientRect();
      return ((r.right - clientX) / r.width) * 100; // RTL
    };

    let dragging = false;
    const down = (e) => {
      dragging = true;
      cancelAnimationFrame(anim);
      root.classList.add('is-dragging');
      track.setPointerCapture?.(e.pointerId);
      set(fromPointer(e.clientX));
      handle.focus({ preventScroll: true });
    };
    const move = (e) => { if (dragging) set(fromPointer(e.clientX)); };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-dragging');
      const snap = [0, 50, 100].find((s) => Math.abs(s - v) < 7);
      if (snap !== undefined) tweenTo(snap, 300);
    };
    track.addEventListener('pointerdown', down);
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);

    handle.addEventListener('keydown', (e) => {
      const map = { ArrowLeft: 5, ArrowUp: 5, ArrowRight: -5, ArrowDown: -5, PageUp: 25, PageDown: -25 };
      if (e.key in map) { e.preventDefault(); set(v + map[e.key]); }
      else if (e.key === 'Home') { e.preventDefault(); tweenTo(0); }
      else if (e.key === 'End') { e.preventDefault(); tweenTo(100); }
    });
    gos.forEach((g) => g.addEventListener('click', () => tweenTo(Number(g.dataset.baGo))));

    render();

    // one gentle hint that the photo can be dragged
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setTimeout(() => { if (v === 0) { tweenTo(22, 650); setTimeout(() => { if (!dragging) tweenTo(0, 650); }, 800); } }, 400);
      }, { threshold: 0.6 });
      io.observe(root);
    }
  });
}
