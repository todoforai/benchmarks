// MILKCROWN — axisymmetric reduced-order model of a milk drop hitting a shallow pool.
//
// One ring of liquid carries the splash: radius r, height z. Everything is integrated
// in the film's own variables — lengths in drop diameters D, time in tau = t*V/D — so
// the only inputs are the dimensionless groups
//   We = rho V^2 D / sigma   Re = rho V D / mu   Oh = sqrt(We)/Re
//   Fr = V^2/(g D)           hbar = poolDepth/D
// and every constant in K is a pure number. Change any p and the physics moves.
//
// CRATER  (tau < tauL)  The cavity opens inertially: x^3 grows linearly in tau, slowed
//         by the hydrostatic head (1/Fr) and by shear over the pool floor (~1/(Re h^2)),
//         which is why a deep pool and a thick liquid behave differently. The crest
//         rides the lip and THINS as it spreads, z ~ x^-q, so the surface reads flat.
// CROWN   (tau > tauL)  The ejecta sheet turns up with w0 ~ We^nWe, cut by viscosity
//         (Oh) and by a deep pool that swallows the impulse downward. The rim then
//         decelerates by entraining the sheet it flies through — drag proportional to
//         the sheet LEFT, so the wall shoots up, saturates, then drifts on once the
//         sheet is spent. Meanwhile Taylor-Culick retraction eats the sheet from the
//         rim at v = sqrt(2 sigma/(rho h)); when it has eaten the whole sheet the wall
//         ruptures. That sets the collapse time in tau, and it is a function of We.
// FALL    The wall's downward momentum turns outward into the spreading ring surge.
//
// Fingers are Rayleigh-Taylor on the decelerating rim, N = kN * r * sqrt(rho*a/sigma)
// with `a` the entrainment deceleration only: surface tension is the restoring force
// there, not the driver, so more sigma gives a coarser rim and fewer fingers.

(function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const K = {
    x0: 0.566, xd0: 1.96, kGrav: 0.9, kVis: 2.0,     // crater
    z0: 0.687, q: 1.75, tauL: 1.80,                  // crest, launch time
    w0: 1.02, nWe: 0.245, kMu: 7.0, kH: 0.42, pH: 0.70,
    fC: 0.66, cS: 3.2, cRes: 0.10,                   // sheet entrainment drag
    kTC: 1.00, kRup: 1.00,                           // retraction / rupture
    kColl: 2.6, kTurn: 1.3, cU: 1.1, uLean: 0.10,
    zRest: 0.45, cRest: 2.5, cUend: 1.2,
    kN: 1.35, shed: [0.7, 1.3, 1.9, 2.5], fShed: 0.035, uShed: 0.35, wShed: 0.30,
    lean: 0.20, tWall: 0.7, dBowl: 0.55, surgeH: 0.30, surgeL: 1.0,
  };

  let P, G, S;

  function reset(p) {
    P = p;
    const D = p.dropD_m, V = p.impactV_mps, rho = p.rho_kgm3;
    const We = rho * V * V * D / p.sigma_Npm, Re = rho * V * D / p.mu_Pas;
    G = { D, V, T: D / V, We, Re, Oh: Math.sqrt(We) / Re,
          Fr: V * V / (p.g_mps2 * D), hbar: p.poolDepth_m / D, Rd: p.domainR_m / D };

    S = { tau: 0, x: K.x0, xd: K.xd0, r: K.x0, z: K.z0, u: K.xd0, w: 0,
          Vc: 0, cut: 0, phase: 0, fingers: 0, nShed: 0, drops: [] };
  }

  // Vertical impulse handed to the ejecta sheet, in units of V.
  const launchW = () => K.w0 * Math.pow(G.We, K.nWe)
    / (1 + K.kMu * G.Oh) / (1 + K.kH * Math.pow(G.hbar, K.pH));

  function advance(h) {
    // crater: d(x^3)/dtau = const, less gravity and floor shear
    const xdd = -2 * S.xd * S.xd / S.x - K.kGrav / G.Fr
                - K.kVis * S.xd / (G.Re * G.hbar * G.hbar);
    S.xd = Math.max(0.02, S.xd + xdd * h);
    S.x += S.xd * h;
    S.tau += h;

    if (S.phase === 0) {                              // crest riding the crater lip
      S.r = S.x; S.u = S.xd;
      S.z = K.z0 * Math.pow(K.x0 / S.x, K.q);
      if (S.tau >= K.tauL) { S.phase = 1; S.w = launchW(); S.Vc = K.fC * Math.PI / 6; }
      return;
    }

    const L = Math.max(0.15, Math.hypot(S.r - S.x, S.z));      // sheet length, base -> rim
    const sz = S.z / L;
    const hs = Math.max(2e-4, S.Vc / (2 * Math.PI * S.r * L)); // sheet thickness
    const vTC = Math.sqrt(2 / (G.We * hs));                    // Taylor-Culick speed

    if (S.phase === 1) {
      S.cut += K.kTC * vTC / L * h;                            // fraction of sheet eaten
      const left = Math.max(0, 1 - S.cut);
      const drag = K.cS * (left + K.cRes) * S.w;               // entrainment of the sheet
      S.w += (-drag - 1 / G.Fr - vTC * vTC / L * sz) * h;
      S.z += S.w * h;
      S.u += (K.uLean * S.w - K.cU * (S.u - S.xd)) * h;
      S.r += S.u * h;

      if (!S.fingers) {                                        // RT on the decelerating rim
        const aI = K.cS * (1 + K.cRes) * S.w * G.V * G.V / G.D;
        S.fingers = clamp(Math.round(K.kN * (S.r * G.D)
          * Math.sqrt(P.rho_kgm3 * Math.abs(aI) / P.sigma_Npm)), 3, 220);
      }
      if (S.cut >= K.kRup) S.phase = 2;                        // the wall ruptures
    } else if (S.phase === 2) {
      S.w -= (K.kColl * vTC * vTC / L * sz + 1 / G.Fr) * h;    // runaway retraction
      S.z += S.w * h;
      S.u += (-K.kTurn * S.w - K.cU * 0.3 * (S.u - S.xd)) * h; // momentum turns outward
      S.r += S.u * h;
      if (S.z <= K.zRest) { S.z = K.zRest; S.w = 0; S.phase = 3; }
    } else {
      S.z += (K.zRest - S.z) * K.cRest * h;                    // spreading ring wave
      S.u -= K.cUend * S.u * h;
      S.r += S.u * h;
    }
    S.r = clamp(S.r, S.x, 0.75 * G.Rd);

    const dt0 = S.tau - K.tauL;
    while (S.nShed < K.shed.length && dt0 >= K.shed[S.nShed] && S.fingers) {
      const v = K.fShed * S.Vc;
      S.Vc -= v;
      S.drops.push({
        r: (S.r + 0.15) * G.D, z: S.z * G.D,
        a: Math.cbrt(3 * v / (4 * Math.PI * S.fingers)) * G.D, n: S.fingers,
        vr: (S.u + K.uShed) * G.V, vz: (Math.max(S.w, 0) + K.wShed) * G.V,
      });
      S.nShed++;
    }
  }

  function step(dt) {
    const n = 6, h = dt / G.T / n;
    for (let i = 0; i < n; i++) advance(h);
    for (const d of S.drops) {
      d.r = Math.min(d.r + d.vr * dt, P.domainR_m * 0.97);
      d.z += d.vz * dt; d.vz -= P.g_mps2 * dt;
    }
  }

  // ---- shape ---------------------------------------------------------------
  // bowl on the axis, wall up to the rim, a bulb over the top, then the outer surface
  // relaxing to flat at domainR. LEVEL then fixes the volume exactly; the domain is
  // ~5D wide, so that shift is ~1e-3 D and never distorts the crown.
  function profile() {
    const D = G.D, zr = S.z, rr = S.r;
    const A = Math.max(1e-5, S.Vc / (2 * Math.PI * rr));          // rim cross-section
    const b = clamp(Math.sqrt(A / Math.PI), 0.02, 0.35 * Math.max(zr, 0.06));
    const lean = K.lean * zr;
    const fi = clamp(rr - b - lean, 0.1, rr - b - 0.02);          // inner foot
    const fo = Math.min(rr + b + K.tWall * b + 0.6 * lean, 0.95 * G.Rd);
    const dc = Math.min(K.dBowl * (Math.PI / 6 + S.Vc) * 3 / (Math.PI * fi * fi),
                        0.85 * G.hbar);
    const zf = -0.25 * Math.min(zr, 0.3);                          // wall foot

    const pts = [], add = (r, z) => pts.push([r * D, z * D]);
    for (let i = 0; i <= 42; i++) { const s = i / 42;              // bowl
      add(s * fi, zf - (dc + zf) * (1 - s * s) ** 2); }
    for (let i = 1; i <= 36; i++) { const s = i / 36;              // inner wall
      add(fi + (rr - b - fi) * s ** 1.4,
          zf + (zr - b - zf) * Math.sin(s * Math.PI / 2) ** 1.2); }
    for (let i = 1; i < 18; i++) { const a = Math.PI * i / 18;     // rim bulb
      add(rr - b * Math.cos(a), zr - b + b * Math.sin(a)); }
    for (let i = 0; i <= 32; i++) { const s = i / 32;              // outer wall
      add(rr + b + (fo - rr - b) * s ** 1.3,
          (zr - b) * (1 - Math.sin(s * Math.PI / 2) ** 1.2)); }
    const ah = Math.min(K.surgeH, 0.35 * Math.max(zr, 0.05));      // outward ring wave
    for (let i = 1; i <= 56; i++) { const s = i / 56;
      const r = fo + (G.Rd - fo) * s ** 1.7;
      add(r, ah * Math.exp(-(r - fo) / K.surgeL) * (1 - s * s)); }
    pts[pts.length - 1] = [P.domainR_m, 0];
    return pts;
  }

  window.BENCH = {
    reset, step,
    state() {
      const drops = S.drops.map(d => ({ r: d.r, z: d.z, a: d.a, n: d.n }));
      return { profile: window.LEVEL(profile(), P, drops), fingers: S.fingers, drops };
    },
  };
  window.__K = K;
})();
