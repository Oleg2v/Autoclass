// "מהפגיעה ועד המפתחות" — scroll-driven restoration of the SVG car.
// One GSAP timeline (10 time units) scrubbed by ScrollTrigger over a sticky section.
import { morpher } from './morph.js';

const STEPS = [0, 2.5, 5, 8.5, 10]; // stage boundaries on the timeline

export function initStory(gsap, ScrollTrigger, { mobile }) {
  const sec = document.querySelector('[data-story]');
  if (!sec) return;
  sec.classList.add('is-live');

  const car = sec.querySelector('svg.car');
  const q = (s) => car.querySelectorAll(s);
  const morph = morpher(car);
  const state = { m: 0, scan: 100, wave: 1080, sweep: 1100 };

  const stepsEl = [...sec.querySelectorAll('[data-step]')];
  const rails = [...sec.querySelectorAll('[data-rail]')];
  const nowEl = sec.querySelector('[data-story-now]');
  const scan = sec.querySelector('.story__scan');
  const spots = [...sec.querySelectorAll('[data-spot]')];
  const claim = sec.querySelector('.story__claim');
  const claimItems = [...claim.querySelectorAll('li')];
  const paintTag = sec.querySelector('.story__tag--paint');
  const keysTag = sec.querySelector('.story__tag--keys');
  const bgBlue = sec.querySelector('.story__bg-blue');
  const bgBooth = sec.querySelector('.story__bg-booth');
  const bgGlow = sec.querySelector('.story__bg-glow');
  const wavePath = car.querySelector('[data-wave]');
  const sweep = car.querySelector('.car__sweep');
  const carBox = sec.querySelector('.story__car');

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

  // ── 1. Inspection: a scan line passes right → left, damage points light up as it passes
  tl.to(state, { scan: 0, duration: 1.7, ease: 'power1.inOut', onUpdate: () => {
    scan.style.setProperty('--scan', state.scan + '%');
  } }, 0.15);
  tl.fromTo(scan, { '--scan-o': 0 }, { '--scan-o': 1, duration: 0.2 }, 0.15);
  tl.to(scan, { '--scan-o': 0, duration: 0.25 }, 1.75);
  const spotX = [104, 150, 214, 432].map((x) => x / 1000);
  spots.forEach((el, i) => {
    const t = 0.15 + (1 - spotX[i]) * 1.7 * 0.92;
    tl.to(el, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, t);
  });
  tl.to(spots, { opacity: 0, scale: 0.6, duration: 0.3, stagger: 0.03 }, 2.45);

  // ── 2. Insurance: the car turns into an appraisal drawing, the claim file fills in
  tl.to([...q('.car__body'), ...q('.car__wheels')], { opacity: 0.1, duration: 0.5 }, 2.5);
  tl.to(q('.car__outline'), { opacity: 1, duration: 0.2 }, 2.5);
  tl.to(q('.car__outline'), { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' }, 2.55);
  tl.to(q('.car__blueprint'), { opacity: 0.55, duration: 0.6 }, 2.9);
  tl.to(bgBlue, { opacity: 1, duration: 0.6 }, 2.6);
  tl.to(claim, { opacity: 1, y: 0, rotate: -1.5, duration: 0.5, ease: 'power3.out' }, 2.9);
  claimItems.forEach((li, i) => {
    tl.call(() => li.classList.add('is-done'), null, 3.4 + i * 0.35);
    tl.call(() => li.classList.remove('is-done'), null, 3.39 + i * 0.35); // reversing support
  });
  tl.to(claim, { opacity: 0, y: -20, duration: 0.35 }, 4.7);
  tl.to([...q('.car__outline'), ...q('.car__blueprint')], { opacity: 0, duration: 0.4 }, 4.9);
  tl.to(bgBlue, { opacity: 0, duration: 0.4 }, 4.9);
  tl.to([...q('.car__body'), ...q('.car__wheels')], { opacity: 1, duration: 0.45 }, 4.95);

  // ── 3. Bodywork & paint: dents pulled, primer, a wave of lacquer, a gloss sweep
  tl.to(bgBooth, { opacity: 1, duration: 0.5 }, 5);
  tl.to(state, { m: 1, duration: 1.1, ease: 'power2.inOut', onUpdate: () => morph(state.m) }, 5.15);
  tl.to(q('.car__dent'), { opacity: 0, scale: 0.6, transformOrigin: '50% 50%', duration: 0.8, stagger: 0.12 }, 5.25);
  tl.to(q('.car__crease'), { opacity: 0, duration: 0.5 }, 5.9);
  tl.to(q('.car__scratch'), { strokeDashoffset: -1, duration: 0.7, stagger: 0.1 }, 5.3);
  tl.to(q('.car__cracks'), { opacity: 0, duration: 0.4 }, 5.6);
  tl.to(q('.car__primer'), { opacity: 1, duration: 0.5 }, 6.1);
  tl.to(paintTag, { opacity: 1, duration: 0.25 }, 6.55);
  tl.to(state, { wave: -90, duration: 1.4, ease: 'power1.inOut', onUpdate: () => {
    wavePath.setAttribute('transform', `translate(${state.wave.toFixed(1)} 0)`);
    paintTag.style.setProperty('--wave', `${Math.max(4, Math.min(96, state.wave / 10))}%`);
  } }, 6.6);
  tl.to(paintTag, { opacity: 0, duration: 0.25 }, 7.85);
  tl.to(sweep, { opacity: 1, duration: 0.1 }, 7.95);
  tl.to(state, { sweep: -260, duration: 0.6, ease: 'power2.inOut', onUpdate: () => {
    sweep.setAttribute('transform', `translate(${state.sweep.toFixed(1)} 0) skewX(-20)`);
  } }, 7.95);
  tl.to(sweep, { opacity: 0, duration: 0.1 }, 8.5);
  tl.to(bgBooth, { opacity: 0, duration: 0.5 }, 8.3);

  // ── 4. Delivery: lights on, the car rolls forward a little, keys handed over
  tl.to(q('.car__beam'), { opacity: 1, duration: 0.5 }, 8.6);
  tl.to(q('.car__head'), { attr: { 'fill-opacity': 1 }, fill: '#fbffe0', duration: 0.3 }, 8.6);
  tl.to(bgGlow, { opacity: 1, duration: 0.6 }, 8.6);
  tl.to(carBox, { xPercent: mobile ? -4 : -6, duration: 1.1, ease: 'power2.inOut' }, 8.7);
  tl.to(q('.car__rim'), { rotation: mobile ? -110 : -160, transformOrigin: '50% 50%', duration: 1.1, ease: 'power2.inOut' }, 8.7);
  tl.to(keysTag, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 9.2);
  tl.to({}, { duration: 0.01 }, 10);

  // ── Step text + rail follow the timeline
  let current = -1;
  const setStep = (time) => {
    let i = 0;
    while (i < 3 && time >= STEPS[i + 1]) i++;
    if (i !== current) {
      current = i;
      stepsEl.forEach((el, k) => el.classList.toggle('is-active', k === i));
      rails.forEach((el, k) => el.classList.toggle('is-active', k <= i));
      nowEl.textContent = `0${i + 1}`;
    }
    rails.forEach((el, k) => {
      const p = Math.max(0, Math.min(1, (time - STEPS[k]) / (STEPS[k + 1] - STEPS[k])));
      el.style.setProperty('--p', p.toFixed(3));
    });
  };

  ScrollTrigger.create({
    trigger: sec,
    start: 'top top',
    end: 'bottom bottom',
    scrub: mobile ? 0.5 : true,
    animation: tl,
    onUpdate: () => setStep(tl.time()),
    onRefresh: () => setStep(tl.time()),
  });
  setStep(0);

  // keyboard/AT users: focusing a step scrolls to its stage
  stepsEl.forEach((el, i) => {
    el.setAttribute('tabindex', '-1');
  });

  return { tl, isDone: () => tl.progress() > 0.86 };
}
