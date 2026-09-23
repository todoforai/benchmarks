// Negative control: the drop just sinks in and the pool bulges. No crown ever.
(() => { let P, t;
  const reset = p => { P = p; t = 0; };
  const step = dt => { t += dt; };
  const state = () => { const rc = 0.003, V = Math.PI / 6 * P.dropD_m ** 3;
    const zb = V / (Math.PI * rc * rc / 3) * Math.exp(-t / 0.004);
    const q = [];
    for (let i = 0; i <= 80; i++) { const r = P.domainR_m * i / 80;
      q.push([r, r < rc ? zb * (1 - (r / rc) ** 2) ** 1.5 : 0]); }
    return { profile: LEVEL(q, P), fingers: 0, drops: [] }; };
  window.BENCH = { reset, step, state }; })();
