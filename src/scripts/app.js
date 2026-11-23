// Entry point. Everything here is progressive enhancement: the page is complete without it.
import { initHeader } from './header.js';
import { initReveals, initCounters } from './reveal.js';
import { initSlider } from './slider.js';
import { initMap } from './map.js';

const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = matchMedia('(max-width: 900px)').matches;

const nextTask = () => new Promise((r) => setTimeout(r, 0));
const afterLoad = () => new Promise((r) => {
  const go = () => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 1200 }) : setTimeout(r, 150));
  document.readyState === 'complete' ? go() : addEventListener('load', go, { once: true });
});

initHeader();
initReveals();
initCounters(reduce);
initSlider(reduce);
initMap();

// Layout for the scroll-driven sections is switched on synchronously (they sit below the fold,
// so this causes no visible layout shift), the animation engine is loaded right after.
const story = document.querySelector('[data-story]');
const chat = document.querySelector('[data-chat]');
if (!reduce) {
  story?.classList.add('is-live');
  chat?.classList.add('is-live');
  boot().catch((err) => {
    console.error(err);
    story?.classList.remove('is-live');
    chat?.classList.remove('is-live');
  });
} else {
  chat?.classList.add('is-static');
}

async function boot() {
  const mods = Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  await afterLoad();
  const [{ gsap }, { ScrollTrigger }] = await mods;
  gsap.registerPlugin(ScrollTrigger);

  if (fine) {
    const { default: Lenis } = await import('lenis');
    const lenis = new Lenis({ lerp: 0.11, anchors: true, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }

  const { initStory } = await import('./story.js');
  await nextTask();
  const storyApi = initStory(gsap, ScrollTrigger, { mobile });

  const { initChat } = await import('./chat.js');
  await nextTask();
  initChat(ScrollTrigger);

  const { initGlint } = await import('./glint.js');
  initGlint({ fine, storyApi });

  if (fine) {
    const { initCursor } = await import('./cursor.js');
    initCursor();
    const { initServices } = await import('./services.js');
    initServices(gsap);
  }

  // fonts can change heights after the engine starts
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
