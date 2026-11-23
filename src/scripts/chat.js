// WhatsApp-style status chat: messages "arrive" one by one as the section scrolls,
// shop messages are preceded by a typing indicator. Scrolling back hides them again.
export function initChat(ScrollTrigger) {
  const sec = document.querySelector('[data-chat]');
  if (!sec) return;
  const msgs = [...sec.querySelectorAll('[data-msg]')];
  const typing = sec.querySelector('[data-typing]');
  const status = sec.querySelector('[data-chat-status]');
  const N = msgs.length;
  let shown = 0, target = 0, timer = 0;

  const setTyping = (on) => {
    typing.classList.toggle('is-on', on);
    status?.classList.toggle('is-typing', on);
  };
  const step = () => {
    clearTimeout(timer);
    if (target < shown) {
      for (let i = target; i < shown; i++) msgs[i].classList.remove('is-shown');
      shown = target;
      setTyping(false);
      return;
    }
    if (target === shown) { setTyping(false); return; }
    const next = msgs[shown];
    if (next.dataset.from === 'shop') {
      setTyping(true);
      timer = setTimeout(() => {
        setTyping(false);
        next.classList.add('is-shown');
        shown++;
        timer = setTimeout(step, 260);
      }, 720);
    } else {
      next.classList.add('is-shown');
      shown++;
      timer = setTimeout(step, 420);
    }
  };

  ScrollTrigger.create({
    trigger: sec,
    start: 'top 35%',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const t = self.progress <= 0 ? 0 : Math.min(N, Math.floor(self.progress * N * 1.08) + 1);
      if (t !== target) { target = t; step(); }
    },
    onLeaveBack: () => { target = 0; step(); },
  });
}
