// Negative control: nothing happens at all.
(() => { let P;
  const reset = p => { P = p; };
  const step = () => {};
  const state = () => { const q = [];
    for (let i = 0; i <= 80; i++) q.push([P.domainR_m * i / 80, 0]);
    return { profile: q, fingers: 0, drops: [] }; };
  window.BENCH = { reset, step, state }; })();
