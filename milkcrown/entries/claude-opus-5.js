// Axisymmetric milk-crown splash, reduced-order model in the (r, z) half-plane.
//
// Physics (dimensionless time tau = V t / D):
//  * Crown radius (Yarin & Weiss kinematic discontinuity): R = beta D sqrt(tau),
//    beta = (2 / 3H)^(1/4), H = poolDepth / D.
//  * The wall is fed by a sheet ejected upward at u ~ kappa dR/dt (~ tau^-1/2),
//    cut off after tau ~ 3 (drop momentum spent), slowed by viscosity
//    (factor 1 / (1 + 25 / sqrt(Re))).
//  * The free edge retracts at the Taylor-Culick speed sqrt(2 sigma / rho e) of a
//    sheet that thins by stretching, e = D c / (sqrt(Re) tau); gravity decelerates
//    the sheet. Rim height: dH/dt = u - v_TC - g t, so it rises, peaks and falls.
//  * The retracted sheet collects into a rim of section A (dA/dt = e v_TC).
//  * Finger count from Rayleigh-Plateau scaling N = sqrt(We) Re^(1/4) / (4 sqrt 3).
//  * Fingers pinch off droplet rings (radius ~ rim radius) on the capillary time,
//    above the Cossali splash parameter; droplets fly ballistically and rejoin.
//  * The crater (bounded by the floor) and the outer displaced swell carry the
//    volume; the residual is closed exactly by a uniform level shift.
(function () {
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  let P, C, S;

  // exact volume of revolution of a polyline over the floor at z = -h
  function segVol(r1, z1, r2, z2) {
    const dr = r2 - r1, dz = z2 - z1;
    return 2 * Math.PI * dr * (r1 * z1 + (r1 * dz + dr * z1) / 2 + dr * dz / 3);
  }
  function revolve(prof, h) {
    let v = 0;
    for (let i = 1; i < prof.length; i++)
      v += segVol(prof[i - 1][0], prof[i - 1][1] + h, prof[i][0], prof[i][1] + h);
    return v;
  }
  const dropsVolume = drops => drops.reduce((s, d) => s + d.n * 4 / 3 * Math.PI * d.a ** 3, 0);

  function reset(p) {
    P = p;
    const D = p.dropD_m, V = p.impactV_mps, rho = p.rho_kgm3, sig = p.sigma_Npm, mu = p.mu_Pas;
    const We = rho * V * V * D / sig, Re = rho * V * D / mu, Fr = V * V / (p.g_mps2 * D);
    const Oh = mu / Math.sqrt(rho * sig * D), Hs = p.poolDepth_m / D;
    const beta = Math.pow(2 / (3 * clamp(Hs, 0.05, 5)), 0.25);
    const ce = 20;
    C = {
      D, V, We, Re, Fr, beta, ce,
      a: 1.25 * beta / 2 / (1 + 25 / Math.sqrt(Re)),        // sheet feed coefficient
      bTC: Math.sqrt(2 * Math.sqrt(Re) / (We * ce)),         // retraction coefficient
      tau0: 0.02, tauF: 3,
      N: Math.max(0, Math.round(Math.sqrt(We) * Math.pow(Re, 0.25) / (4 * Math.sqrt(3)))),
      splash: We * Math.pow(Oh, -0.4) > 1000,
      dMax: Math.max(0, Math.min(p.poolDepth_m - Math.min(0.1 * p.poolDepth_m, 0.02 * D),
                                 0.35 * D * Math.pow(Fr, 0.25))),
      Vtarget: Math.PI * p.domainR_m ** 2 * p.poolDepth_m + Math.PI / 6 * D ** 3,
    };
    S = { t: 0, H: 0, rose: false, collapsed: false, tCol: 0, dCol: 0,
          A: 1e-3 * D * D, drops: [], shedClock: 0 };
  }

  const tauOf = t => C.V * t / C.D;
  function heightRate(tau) {   // dH/dt
    return C.V * (feed(tau) - C.bTC * Math.sqrt(tau) - tau / C.Fr);
  }
  // sheet ejection speed / V: Yarin-Weiss tau^-1/2, cut off once the drop's momentum is spent
  const feed = tau => C.a / Math.sqrt(tau + C.tau0) / (1 + tau / C.tauF);
  const crownR = tau => Math.min(C.beta * C.D * Math.sqrt(tau), 0.6 * P.domainR_m);
  const rimRadius = () => Math.min(Math.sqrt(S.A / Math.PI), 0.25 * C.D);
  const sheetThick = tau => C.D * C.ce / (Math.sqrt(C.Re) * (tau + 1));
  const crownUp = () => !S.collapsed && S.H > Math.max(2 * rimRadius(), 0.15 * C.D);

  function step(dt) {
    const n = 4, h = dt / n, g = P.g_mps2;
    for (let k = 0; k < n; k++) {
      S.t += h;
      const tau = tauOf(S.t), D = C.D;
      if (!S.collapsed) {
        const e = sheetThick(tau);
        S.A += e * Math.sqrt(2 * P.sigma_Npm / (P.rho_kgm3 * e)) * h;
        S.H += heightRate(tau) * h;
        if (S.H > 0.05 * D) S.rose = true;
        if (S.H <= 0 && (S.rose || tau > 1)) {
          S.collapsed = true; S.H = 0; S.tCol = S.t;
          S.dCol = crater(S.t);
        }
        S.H = Math.max(0, S.H);
      }
      shed(h, tau);
      for (const d of S.drops) { d.vz -= g * h; d.r += d.vr * h; d.z += d.vz * h; }
      S.drops = S.drops.filter(d => !(d.vz < 0 && d.z < 0) && d.r < P.domainR_m);
    }
  }

  function shed(h, tau) {
    if (!C.splash || !crownUp() || C.N === 0 || S.H < 0.3 * C.D) return;
    const R = crownR(tau), b = rimRadius();
    const a = clamp(0.6 * b, 0.01 * C.D, 0.15 * C.D);
    const ringV = C.N * 4 / 3 * Math.PI * a ** 3, rimV = S.A * 2 * Math.PI * R;
    S.shedClock += h;
    if (S.shedClock < 2.5 * Math.sqrt(P.rho_kgm3 * a ** 3 / P.sigma_Npm) || rimV < 1.5 * ringV) return;
    S.shedClock = 0;
    S.A -= ringV / (2 * Math.PI * R);
    const u = C.V * feed(tau);
    S.drops.push({ r: R, z: S.H + a, a, n: C.N,
                   vr: C.beta * C.V / (2 * Math.sqrt(tau)) + 0.25 * u,
                   vz: Math.max(0, heightRate(tau)) + 0.5 * u });
  }

  function crater(t) {
    const tau = tauOf(t);
    if (S.collapsed) {
      const tFill = Math.max(S.tCol * 0.5, 1e-4);
      return S.dCol * Math.exp(-(t - S.tCol) / tFill);
    }
    return C.dMax * (1 - Math.exp(-tau / 1.5));
  }

  function state() {
    const D = C.D, Rd = P.domainR_m, h0 = P.poolDepth_m, t = S.t, tau = tauOf(t);
    const pts = [];
    // 1. remnant of the drop above the surface
    const Rdrop = D / 2, zc = Rdrop - C.V * t;
    let r0 = 0, rDropMax = 0;
    if (zc + Rdrop > 0) {
      const thMax = zc - Rdrop >= 0 ? Math.PI : Math.acos(clamp(-zc / Rdrop, -1, 1));
      for (let i = 0; i <= 30; i++) {
        const th = thMax * i / 30;
        pts.push([Rdrop * Math.sin(th), zc + Rdrop * Math.cos(th)]);
      }
      r0 = pts[pts.length - 1][0];
      rDropMax = zc > 0 ? Rdrop : r0;
    }
    // 2. crown geometry
    const H = S.H, b = rimRadius(), be = Math.min(b, H / 4);
    const et = Math.min(clamp(sheetThick(tau), 0.005 * D, 0.2 * D), 2 * be);
    let Rtop = crownR(tau), rbase = Rtop - Math.min(0.12 * Rtop, 0.5 * H);
    const eb = Math.max(et, Math.min(0.12 * D + et, 0.5 * rbase, H / 2));
    let rin = rbase - eb / 2;
    const minRin = rDropMax + 0.02 * D;
    if (rin < minRin) { const s = minRin - rin; rin += s; rbase += s; Rtop += s; }
    const rout = rbase + eb / 2;
    // 3. crater floor
    const dc = crater(t);
    const i0 = r0 > 0 ? 1 : 0;
    for (let i = i0; i <= 30; i++) {
      const r = r0 + (rin - r0) * i / 30;
      pts.push([r, -dc * (1 - (r / rin) ** 2)]);
    }
    // 4. wall and rim
    if (H > 0) {
      const Tr = Rtop, Tz = H - be, dr = Tr - rbase;
      const e = s => eb + (et - eb) * s;
      const face = sgn => s => [rbase + dr * s + sgn * e(s) / 2, Tz * s];
      const inner = face(-1), outer = face(1);
      for (let i = 1; i <= 20; i++) pts.push(inner(i / 20));
      for (let i = 0; i <= 20; i++) {                     // rim: upper half circle
        const ph = Math.PI * (1 - i / 20);
        pts.push([Tr + be * Math.cos(ph), Tz + be * Math.sin(ph)]);
      }
      for (let i = 20; i >= 1; i--) pts.push(outer(i / 20));
    }
    pts.push([rout, 0]);
    // 5. outer surface with the displaced swell
    const iOut = pts.length - 1, w = 0.6 * D + 0.3 * Rtop, bump = [0];
    for (let i = 1; i <= 100; i++) {
      const r = rout + (Rd - rout) * (i / 100) ** 1.5;
      const x = (r - rout) / w;
      bump.push(x * Math.exp(1 - x));
      pts.push([r, 0]);
    }
    pts[pts.length - 1][0] = Rd;
    // 6. volume: swell takes the surplus, uniform level shift closes the rest exactly
    const V0 = revolve(pts, h0);
    let Ib = 0;
    for (let i = 1; i < bump.length; i++)
      Ib += segVol(pts[iOut + i - 1][0], bump[i - 1], pts[iOut + i][0], bump[i]);
    const dV = C.Vtarget - dropsVolume(S.drops) - V0;
    const A = clamp(dV / Ib, 0, 0.3 * D);
    const shift = (dV - A * Ib) / (Math.PI * Rd * Rd);
    for (let i = 0; i < bump.length; i++) pts[iOut + i][1] += A * bump[i];
    for (const q of pts) q[1] += shift;
    return {
      profile: pts,
      fingers: crownUp() ? C.N : 0,
      drops: S.drops.map(d => ({ r: d.r, z: d.z, a: d.a, n: d.n })),
    };
  }

  window.BENCH = { reset, step, state };
})();
