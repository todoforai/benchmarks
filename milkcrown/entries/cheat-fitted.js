// Adversarial probe: a canned shape with all three probe trends written in by hand.
// It knows the answers without solving anything, so it is the hardest cheat to catch
// and the honest ceiling on what the probe alone can prove.
(() => { let P, t, T, N;
  const reset = p => { P = p; t = 0;
    T = 0.010 * (2.2 / p.impactV_mps);                       // sooner: clock is D/V
    N = Math.round(20 * (p.impactV_mps / 2.2) * Math.sqrt(0.052 / p.sigma_Npm)); };
  const step = dt => { t += dt; };
  const state = () => { const k = P.impactV_mps / 2.2, f = Math.min(t / T, 1);
    const R = 0.001 + 0.004 * k * Math.sqrt(f), H = 0.004 * k * Math.sin(Math.PI * f), b = 0.0004;
    const q = [];
    for (let i = 0; i <= 40; i++) q.push([R * i / 40, -0.0015 * Math.sin(Math.PI * f)]);
    for (let i = 1; i <= 8; i++) q.push([R, H * i / 8]);
    for (let i = 1; i <= 8; i++) q.push([R + b, H * (1 - i / 8)]);
    for (let i = 1; i <= 20; i++) q.push([R + b + (P.domainR_m - R - b) * i / 20, 0]);
    const d = f > 0.5 ? [{ r: R, z: H + 0.001, a: 0.0003, n: N }] : [];
    return { profile: LEVEL(q, P, d), fingers: H > 0.001 ? N : 0, drops: d }; };
  window.BENCH = { reset, step, state }; })();
