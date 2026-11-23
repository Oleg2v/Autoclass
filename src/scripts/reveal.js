// Fade/raise elements with [data-reveal] once they enter the viewport.
export function initReveals() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  els.forEach((e) => io.observe(e));
}

// Count numbers up ([data-count="5"]) and trigger micro-animations ([data-micro]) when visible.
export function initCounters(reduce) {
  const nums = document.querySelectorAll('[data-count]');
  const micro = document.querySelectorAll('[data-micro]');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      el.classList.add('is-on');
      if (!el.dataset.count) continue;
      const to = Number(el.dataset.count);
      const from = Number(el.dataset.from || 0);
      if (reduce) { el.textContent = String(to); continue; }
      const dur = 1400;
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const v = from + (to - from) * (1 - Math.pow(1 - k, 4));
        el.textContent = String(Math.round(v));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));
  micro.forEach((n) => io.observe(n));
}
