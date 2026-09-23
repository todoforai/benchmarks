// Negative control: a frozen crown, never moving, ignoring p. Must score ~0.
// If this ever scores well, the scorer is rewarding a shape instead of a splash.
(() => { let P;
  const reset = p => { P = p; };
  const step = () => {};
  const state = () => { const q = [], R = 0.004, H = 0.003, b = 0.0004;
    for (let i = 0; i <= 40; i++) q.push([R * i / 40, -0.0012]);
    for (let i = 1; i <= 8; i++) q.push([R, -0.0012 + (H + 0.0012) * i / 8]);
    q.push([R + b, H]);
    for (let i = 1; i <= 8; i++) q.push([R + b, H * (1 - i / 8)]);
    for (let i = 1; i <= 20; i++) q.push([R + b + (P.domainR_m - R - b) * i / 20, 0]);
    const d = [{ r: R, z: H + 0.002, a: 0.0003, n: 24 }];
    return { profile: LEVEL(q, P, d), fingers: 24, drops: d }; };
  window.BENCH = { reset, step, state }; })();
