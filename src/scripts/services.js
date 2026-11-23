// Desktop: the service photo floats after the cursor while hovering a row.
export function initServices(gsap) {
  const list = document.querySelector('[data-services]');
  const float = document.querySelector('[data-service-float]');
  if (!list || !float) return;
  const imgs = [...float.querySelectorAll('[data-float-img]')];
  const xTo = gsap.quickTo(float, 'x', { duration: 0.6, ease: 'power3' });
  const yTo = gsap.quickTo(float, 'y', { duration: 0.6, ease: 'power3' });
  const rTo = gsap.quickTo(float, 'rotation', { duration: 0.8, ease: 'power3' });
  let lastX = 0;

  list.addEventListener('pointermove', (e) => {
    const r = list.getBoundingClientRect();
    const x = e.clientX - r.left;
    xTo(x - float.offsetWidth / 2);
    yTo(e.clientY - r.top - float.offsetHeight / 2);
    rTo(Math.max(-8, Math.min(8, (e.clientX - lastX) * 0.4)));
    lastX = e.clientX;
  });
  list.querySelectorAll('[data-service]').forEach((row) => {
    row.addEventListener('pointerenter', () => {
      const id = row.dataset.service;
      imgs.forEach((im) => im.classList.toggle('is-on', im.dataset.floatImg === id));
      float.classList.add('is-on');
    });
  });
  list.addEventListener('pointerleave', () => float.classList.remove('is-on'));
}
