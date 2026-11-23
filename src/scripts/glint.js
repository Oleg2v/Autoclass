// Lacquer glint: a light band that follows the cursor (desktop), the finger or device tilt (phone).
export function initGlint({ fine, storyApi }) {
  const stages = document.querySelectorAll('[data-glint]');
  const tilt = [];

  stages.forEach((stage) => {
    const svg = stage.querySelector('svg.car');
    const sweep = svg?.querySelector('.car__sweep');
    if (!sweep) return;
    const isStory = !!stage.closest('[data-story]');
    let target = 1100, cur = 1100, op = 0, opT = 0, raf = 0;

    const loop = () => { if (!raf) raf = requestAnimationFrame(step); };
    function step() {
      raf = 0;
      if (isStory && !storyApi?.isDone()) return; // the story timeline owns the sweep until the end
      cur += (target - cur) * 0.16;
      op += (opT - op) * 0.14;
      sweep.setAttribute('transform', `translate(${cur.toFixed(1)} 0) skewX(-20)`);
      sweep.setAttribute('opacity', op.toFixed(3));
      if (Math.abs(target - cur) > 0.5 || Math.abs(opT - op) > 0.005) loop();
    }
    const toSvgX = (clientX) => {
      const r = svg.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * 1000;
    };
    const aim = (x, o = 0.8) => { target = x; opT = o; loop(); };

    if (fine) {
      stage.addEventListener('pointermove', (e) => aim(toSvgX(e.clientX)));
      stage.addEventListener('pointerleave', () => aim(target, 0));
    } else {
      stage.addEventListener('touchmove', (e) => aim(toSvgX(e.touches[0].clientX)), { passive: true });
      stage.addEventListener('touchend', () => aim(target, 0));
      tilt.push(aim);
    }
  });

  // Phones: device tilt moves the glint where the browser allows it without a permission prompt.
  if (tilt.length && 'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let last = 0;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      const now = performance.now();
      if (now - last < 32) return;
      last = now;
      const g = Math.max(-30, Math.min(30, e.gamma));
      const x = 500 - (g / 30) * 520; // tilt right → light moves left (towards the nose)
      tilt.forEach((aim) => aim(x, 0.55));
    }, { passive: true });
  }

  // Hero light follows the pointer
  const hero = document.querySelector('.hero');
  if (fine && hero) {
    let raf = 0, mx = 30, my = 75;
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 100;
      my = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        hero.style.setProperty('--mx', mx.toFixed(1) + '%');
        hero.style.setProperty('--my', my.toFixed(1) + '%');
      });
    });
  }
}
