// Negative control: droplets everywhere, no wall. Droplets alone must not score.
(() => { let P, t;
  const reset = p => { P = p; t = 0; };
  const step = dt => { t += dt; };
  const state = () => { const q = [];
    for (let i = 0; i <= 80; i++) q.push([P.domainR_m * i / 80, 0]);
    const drops = [];
    for (let k = 0; k < 4; k++) drops.push({ r: 0.002 + 0.3 * t + k * 0.001,
      z: 0.5 * t + k * 0.0005, a: 0.0002, n: 12 });
    return { profile: LEVEL(q, P, drops), fingers: 0, drops }; };
  window.BENCH = { reset, step, state }; })();
