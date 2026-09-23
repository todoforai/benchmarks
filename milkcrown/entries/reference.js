// Reference entry. Not a fluid solver: a volume-conserving crater + rim model whose
// only job is to prove the benchmark is reachable and to pin the top of the scale.
// Everything it reports is driven by p, which is what the probe checks.
(() => {
  let P, U, R0, Wb, Re, Hs, T, t, N, drops, bFreeze;

  const reset = p => {
    P = p; t = 0; drops = []; N = 0; bFreeze = 0;
    U = p.impactV_mps; R0 = p.dropD_m / 2;
    Wb = p.rho_kgm3 * U * U * p.dropD_m / p.sigma_Npm;   // Weber number drives the splash
    Re = p.rho_kgm3 * U * p.dropD_m / p.mu_Pas;          // Reynolds: viscosity eats the sheet
    // a deep pool swallows the impact, a thin film throws it back out as a wall
    Hs = p.poolDepth_m / p.dropD_m;
    T = 2.2 * p.dropD_m / U;                             // crown lifetime ~ drop / speed
  };

  const f = () => t / T;   // past 1 the splash relaxes, it is not frozen

  // crater radius grows like t^0.5, depth swells and relaxes
  const craterR = () => R0 * (0.9 + 4.2 * Math.sqrt(Math.min(f(), 1)));
  const craterD = () => Math.min(0.9 * P.poolDepth_m, 0.55 * P.dropD_m * Math.pow(Wb / 300, 0.25))
                        * Math.max(0, Math.sin(Math.PI * Math.min(f(), 1) ** 0.8));
  // the sheet stretches as it rises, and it starts thinner when the impact is harder
  const sheetB = () => 0.30 * P.dropD_m * Math.pow(300 / Wb, 0.25) / (1 + 3 * Math.min(f(), 1));
  // what is left of the drop, still sitting on the axis
  const bumpV = () => Math.PI / 6 * Math.pow(P.dropD_m, 3) * Math.max(0, 1 - f() / 0.30);
  // The sheet is fed out of the crater at a fraction of the impact speed while the
  // crater is still opening. Once the feed stops, Taylor-Culick retraction pulls the
  // rim back down at sqrt(2 sigma / rho b), so the crown falls on a capillary clock.
  const wallH = () => {
    // the boundary layer robs the sheet: delta/D ~ Re^-1/2, and a deep pool
    // absorbs the momentum instead of turning it into a wall
    const u = 0.68 * U * Math.pow(Wb / 300, 0.15)
            * (1 - Math.min(0.85, 6 / Math.sqrt(Re)))
            * Math.pow(0.67 / Hs, 0.35);
    const rise = u * Math.min(t, T) - 0.5 * P.g_mps2 * Math.min(t, T) ** 2;
    const vtc = Math.sqrt(2 * P.sigma_Npm / (P.rho_kgm3 * sheetB()));
    return Math.max(0, rise - (vtc + P.g_mps2 * Math.max(0, t - T)) * Math.max(0, t - T));
  };

  const step = dt => {
    t += dt;
    const b = sheetB(), R = craterR();

    // Rayleigh-Plateau: the rim beads at ~4.5 diameters. The count is set once, at the
    // moment the instability has had one capillary time to grow on a sheet that thin.
    const tauCap = Math.sqrt(P.rho_kgm3 * b * b * b / P.sigma_Npm);
    if (!N && t > tauCap) { N = Math.max(4, Math.round(2 * Math.PI * R / (4.5 * b))); bFreeze = b; }

    // once beaded, every bead can pinch off
    const t0 = T * 0.45, every = T * 0.10;
    while (N && t > t0 && drops.length < 3 && drops.length < (t - t0) / every) {
      drops.push({ r: R, z: wallH(), a: 0.30 * bFreeze, n: N,
                   vr: 0.18 * U, vz: 0.42 * U * (1 - 0.15 * drops.length) });
    }
    for (const d of drops) { d.vz -= P.g_mps2 * dt; d.r += d.vr * dt; d.z += d.vz * dt; }
    // a droplet that lands is gone from the air and back in the pool, which the
    // level solve picks up on its own, so volume closes across the merge
    for (let i = drops.length; i--;) if (drops[i].z < drops[i].a) drops.splice(i, 1);
  };

  // ---- geometry. The wall height is not prescribed: it is whatever the liquid
  // that left the crater can build, so volume closes by construction.

  // L is the uniform level shift that closes the volume: liquid pushed out of the
  // crater has to stand somewhere, and at the end the pool is one drop deeper.
  const profile = (h, L) => {
    const R = craterR(), D = craterD(), b = sheetB(), Rd = P.domainR_m;
    const rc = 0.8 * P.dropD_m, zb = bumpV() / (Math.PI * rc * rc / 3);
    const eta = r => L + (r < rc ? zb * (1 - (r / rc) ** 2) ** 1.5 : 0)
                       - (r < R ? D * Math.cos(Math.PI * r / (2 * R)) ** 2 : 0);

    const q = [], inner = Math.max(1e-6, R - b / 2);
    for (let i = 0; i <= 48; i++) { const r = inner * i / 48; q.push([r, eta(r)]); }
    if (h > 1e-6) {                       // the wall, leaning outward as a crown does
      const tilt = 0.22 * h;
      for (let i = 1; i <= 8; i++) { const u = i / 8; q.push([inner + tilt * u * u, eta(inner) * (1 - u) + h * u]); }
      q.push([inner + tilt + b, h]);
      for (let i = 1; i <= 8; i++) { const u = 1 - i / 8; q.push([inner + b + tilt * u * u, h * u]); }
    }
    for (let i = 1; i <= 24; i++) { const r = inner + b + (Rd - inner - b) * i / 24; q.push([r, eta(r)]); }
    q[q.length - 1][0] = Rd;
    return q;
  };

  const state = () => {
    const d = drops.map(x => ({ r: x.r, z: x.z, a: x.a, n: x.n }));
    return { profile: LEVEL(profile(wallH(), 0), P, d), fingers: N, drops: d };
  };

  window.BENCH = { reset, step, state };
})();
