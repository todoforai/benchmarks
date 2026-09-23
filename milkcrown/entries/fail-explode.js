// Negative control: a crown that grows without bound. Volume gate must kill it.
(() => { let P, t;
  const reset = p => { P = p; t = 0; };
  const step = dt => { t += dt; };
  const state = () => { const R = 0.002 + 0.5 * t, H = 0.002 + 0.8 * t, b = 0.0006, q = [];
    for (let i = 0; i <= 40; i++) q.push([Math.min(R, P.domainR_m) * i / 40, 0]);
    for (let i = 1; i <= 8; i++) q.push([Math.min(R, P.domainR_m), H * i / 8]);
    for (let i = 1; i <= 8; i++) q.push([Math.min(R + b, P.domainR_m), H * (1 - i / 8)]);
    for (let i = 1; i <= 24; i++) q.push([Math.min(R + b, P.domainR_m)
      + (P.domainR_m - Math.min(R + b, P.domainR_m)) * i / 24, 0]);
    return { profile: q, fingers: 30, drops: [] }; };
  window.BENCH = { reset, step, state }; })();
