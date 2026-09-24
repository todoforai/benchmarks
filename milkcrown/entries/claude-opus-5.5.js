/* milk.js — axisymmetric milk-drop crown, reduced-order model in the (r, z) half-plane.
 *
 * Clock: tau = t V / D. Every rate below is set by D, V and the dimensionless groups
 *   We = rho V^2 D / sigma,  Re = rho V D / mu,  h = poolDepth / D.
 *
 *   drop     sinks into the pool at V (top at z = D - V t), hidden once inside the crater
 *   crater   depth grows ~sqrt(tau), capped by the floor (a thin film cannot dig deep)
 *   spread   crown radius, Yarin-Weiss kinematic discontinuity: R/D ~ (2/3h)^(1/4) sqrt(tau)
 *   lip      flat ejecta lip until the wall is launched at tau_on
 *   rim      launched at W0 ~ V We^(1/4) (viscous boundary-layer loss 1/(1+c/sqrt Re),
 *            deep-pool loss h^(-1/4)); decelerated by momentum dilution from slower sheet
 *            liquid (rate V/D, so a harder hit peaks sooner in wall time) plus the
 *            Taylor-Culick pull (~1/We) and gravity
 *   collapse after the rim stalls the sheet ruptures and drains back
 *   fingers  Rayleigh-Taylor on the decelerating rim: N = R sqrt(rho a / 3 sigma)
 *   drops    fingers pinch off rings of droplets (radius ~ wavelength/4), then fly
 *            ballistically and are re-absorbed when they land
 * Volume closes exactly through LEVEL (the pool absorbs the bookkeeping).
 */
(function (G) {
  'use strict';
  const TAU_ON = 1.8, K_DIL = 0.6, COLLAPSE_DELAY = 0.5, K_COLLAPSE = 0.45, H_RES = 0.48;
  const H_LIP = 0.2, TAN_LEAN = Math.tan(8 * Math.PI / 180), RIM_B = 0.07, WALL_E = 0.12;
  let p, S;

  function reset(q) {
    p = q;
    const D = p.dropD_m, V = p.impactV_mps;
    const We = p.rho_kgm3 * V * V * D / p.sigma_Npm, Re = p.rho_kgm3 * V * D / p.mu_Pas;
    const h = p.poolDepth_m / D;
    const W0 = 3.2 * Math.pow(We / 288, 0.25) * (1 + 6 / Math.sqrt(3400)) / (1 + 6 / Math.sqrt(Re))
             * Math.pow(h / (2 / 3), -0.25);
    const A = 0.04 + 7.5 / We + p.g_mps2 * D / (V * V);
    S = { t: 0, tau: 0, We, h, W0, A, H: H_LIP, W: 0, launched: false, peak: -1,
          fingers: 0, rings: [], shed: 0 };
  }

  const spread = tau => 0.566 + 0.73 * Math.pow(2 / (3 * S.h), 0.25) * Math.sqrt(tau);

  function shed(Rt, dRdt) {
    const D = p.dropD_m, V = p.impactV_mps, N = S.fingers;
    const lam = 2 * Math.PI * Rt * D / N;
    S.rings.push({ r: Rt * D, z: S.H * D, vr: (dRdt + 0.15) * V, vz: (Math.max(S.W, 0) + 0.15) * V,
                   a: 0.25 * lam, n: N });
    S.shed++;
  }

  function step(dt) {
    const D = p.dropD_m, V = p.impactV_mps, n = 5, h = dt / n, dtau = h * V / D;
    for (let i = 0; i < n; i++) {
      S.t += h; S.tau += dtau;
      if (!S.launched && S.tau >= TAU_ON) {
        S.launched = true; S.W = S.W0;
        const a0 = S.W0 / K_DIL + S.A;                       // rim deceleration, V^2/D units
        S.fingers = Math.max(1, Math.round(spread(S.tau) * Math.sqrt(S.We * a0 / 3)));
      }
      if (S.launched) {
        if (S.peak < 0) {
          S.W += (-S.W / K_DIL - S.A) * dtau; S.H += S.W * dtau;
          if (S.W <= 0) { S.peak = S.tau; shed(spread(S.tau), 0.365 / Math.sqrt(S.tau)); }
        } else if (S.tau < S.peak + COLLAPSE_DELAY) {
          S.W -= S.A * dtau; S.H += S.W * dtau;
        } else {
          if (S.shed < 2) shed(spread(S.tau), 0.365 / Math.sqrt(S.tau));
          S.H += -(S.H - H_RES) / K_COLLAPSE * dtau;
        }
      }
      for (const d of S.rings) { d.vz -= p.g_mps2 * h; d.r += d.vr * h; d.z += d.vz * h; }
      S.rings = S.rings.filter(d => d.z > 0);
    }
  }

  function profile() {
    const D = p.dropD_m, R = p.domainR_m, tau = S.tau, pts = [];
    const Rt = spread(tau) * D, H = Math.max(S.H, H_LIP) * D, b = RIM_B * D, e = WALL_E * D;
    const rIn = Math.max(0.05 * D, Rt - b - (H - b) * TAN_LEAN - e / 2);
    const rOut = Rt + b - (H - b) * TAN_LEAN + e / 2;
    const depth = Math.min(0.85 * p.poolDepth_m, 0.9 * D * Math.sqrt(Math.min(1, tau / 2)));
    const zc = D / 2 - p.impactV_mps * S.t;                // drop centre, sinking at V
    for (let i = 0; i < 50; i++) {                          // drop + crater
      const r = rIn * i / 50, x = r / rIn;
      let z = -depth * (1 - x * x);
      if (r < D / 2) z = Math.max(z, zc + Math.sqrt(D * D / 4 - r * r));
      pts.push([r, z]);
    }
    for (let i = 0; i <= 30; i++) {                         // inner wall up to the rim
      const f = i / 30;
      pts.push([rIn + f * (Rt - b - rIn), f * (H - b)]);
    }
    for (let i = 1; i < 20; i++) {                          // rim, round top at (Rt, H)
      const th = Math.PI * (1 - i / 20);
      pts.push([Rt + b * Math.cos(th), H - b + b * Math.sin(th)]);
    }
    for (let i = 0; i <= 30; i++) {                         // outer wall down
      const f = i / 30;
      pts.push([Rt + b + f * (rOut - Rt - b), (1 - f) * (H - b)]);
    }
    for (let i = 1; i <= 60; i++) {                         // outer pool, denser near the crown
      const f = (i / 60) ** 2;
      pts.push([rOut + f * (R - rOut), 0]);
    }
    return pts;
  }

  function state() {
    const drops = S.rings.map(d => ({ r: d.r, z: d.z, a: d.a, n: d.n }));
    return { profile: G.LEVEL(profile(), p, drops), fingers: S.fingers, drops };
  }

  G.BENCH = { reset, step, state };
})(typeof window !== 'undefined' ? window : globalThis);
