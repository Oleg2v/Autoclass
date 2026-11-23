// Tiny numeric path interpolator: both paths must share the same command structure.
const NUM = /-?\d*\.?\d+(?:e-?\d+)?/gi;

export function compile(a, b) {
  const na = a.match(NUM).map(Number);
  const nb = b.match(NUM).map(Number);
  if (na.length !== nb.length) throw new Error('morph: incompatible paths');
  const parts = a.split(NUM);
  return (t) => {
    let s = parts[0];
    for (let i = 0; i < na.length; i++) {
      const v = na[i] + (nb[i] - na[i]) * t;
      s += (Math.round(v * 10) / 10) + parts[i + 1];
    }
    return s;
  };
}

// Collect every [data-morph] element inside root and return a setter (0 = damaged, 1 = restored).
export function morpher(root) {
  const items = [...root.querySelectorAll('[data-morph]')].map((el) => ({ el, f: compile(el.dataset.a, el.dataset.b) }));
  let last = -1;
  return (t) => {
    t = Math.max(0, Math.min(1, t));
    if (Math.abs(t - last) < 0.0005) return;
    last = t;
    for (const it of items) it.el.setAttribute('d', it.f(t));
  };
}
