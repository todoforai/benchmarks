// milk.js -- axisymmetric milk crown, simulated.
//
// Four coupled pieces, every number driven by p, nothing posed on wall time.
//
//   pool     1-D radial shallow-water solver (h, u): donor-cell mass flux,
//            gravity, laminar bottom drag.  The drop hands it its own volume
//            and a radial impulse on the Yarin-Weiss contact ring
//            r_c(t) = sqrt(D U t), spread over the impact time D/U.  The
//            crater, its lip and the outgoing ridge are solved, not posed, and
//            the pool is also the mass ledger: liquid that leaves as sheet is
//            taken out of it and put back when the crown collapses.
//   sheet    the lip throws a free sheet of thickness b = BS D/We, at a speed
//            that decays like the contact line does, Ve ~ U sqrt(tau/2t).  The
//            boundary layer eats into it (exp(-K/sqrt(Re))) and so does the
//            pool depth: a deep pool spends the impact on opening a cavity,
//            a thin film has nowhere to put it but sideways.
//   rim      one Lagrangian ring.  It accretes the sheet, which decelerates it
//            as the feed slows, Taylor-Culick pulls it back down the sheet at
//            a = 2 sigma/(rho b L), and gravity does the rest.
//            Rise ~ Ve, fall ~ that retraction speed, both on the clock D/U:
//            hit harder and the crown goes higher AND peaks sooner.
//   fingers  Rayleigh-Taylor on the decelerating rim: k = sqrt(rho a/(3 sigma)),
//            N = k R.  With a ~ 2 sigma/(rho b L) this is N ~ R U/sqrt(sigma L):
//            more speed, more fingers; more surface tension, coarser beads and
//            fewer of them.  The beads pinch off once the feed dies, launched
//            at the fastest the rim ever went, since that is when the necks
//            were drawn out.
//
// Volume: every transfer is explicit (pool -> sheet -> rim -> droplets -> pool).
// The pool's depth floor and the reconstructed sheet geometry still leave a
// small mismatch between the tracked mass and the revolved profile, so LEVEL()
// is applied to the returned profile as the final correction.
(function (global) {
  "use strict";

  // Dimensionless, O(1), calibrated once on the canonical crown
  // (D = 3 mm, U = 2.2 m/s, h = 2 mm, We = 250, Re = 3400).
  var CHI   = 0.5,    // share of the drop's momentum that turns radial
      EJ    = 0.90,   // ejecta speed / momentum-flux estimate
      AL    = 0.20,   // ejecta speed exponent on We
      WE0   = 250,    // reference Weber number
      LS    = 0.25,   // length of the sheet at birth, in drop diameters
      BS    = 10.0,   // sheet thickness, b = BS * D / We
      KVIS  = 11.0,   // boundary-layer loss on the ejecta, exp(-KVIS/sqrt(Re))
      HD    = 0.85,   // film/cavity crossover depth, in drop diameters
      HP    = 0.9,    // how sharply a deep pool swallows the impact
      ANG   = 1.15,   // ejection angle above the horizontal (rad)
      TFEED = 2.2,    // the sheet is fed for TFEED * D/U
      VCAP  = 0.85,   // the lip stops feeding once the crown holds this many drops
      SHED  = 0.10,   // rim mass lost per shedding event
      NCELL = 160;

  var S = null;
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };

  // ------------------------------------------------------------------ reset
  function reset(p) {
    var n = NCELL, dr = p.domainR_m / n, i;
    S = { p: p, t: 0, n: n, dr: dr,
          r: new Float64Array(n), h: new Float64Array(n), u: new Float64Array(n),
          h2: new Float64Array(n), u2: new Float64Array(n), K: new Float64Array(n),
          F: new Float64Array(n),
          drops: [], rim: null, N: 0, k: 0, tFade: 0, shed: 0, tShed: 0, vPk: [0, 0], Vej: 0 };
    for (i = 0; i < n; i++) { S.r[i] = (i + 0.5) * dr; S.h[i] = p.poolDepth_m; }

    var D = p.dropD_m, U = p.impactV_mps, rho = p.rho_kgm3, h = p.poolDepth_m;
    S.D = D; S.U = U; S.rho = rho; S.g = p.g_mps2; S.sig = p.sigma_Npm;
    S.nu = p.mu_Pas / rho;
    S.Vd = Math.PI * D * D * D / 6;
    S.Vair = S.Vd;                                     // not yet merged: still a drop
    S.tau = D / U;                                     // impact clock
    S.We = rho * U * U * D / p.sigma_Npm;
    S.Re = rho * U * D / Math.max(p.mu_Pas, 1e-12);
    S.Jr = CHI * rho * S.Vd * U;                       // radial impulse budget
    // The impact stretches the sheet to b ~ sigma/(rho U^2) = BS D/We.  This is
    // what fixes the clock: a_tc = 2 sigma/(rho b L) = 2 U^2/(BS L), so the
    // retraction speed is ~U and the whole splash runs on D/U -- hit harder and
    // the crown goes higher AND peaks sooner, with no explicit time anywhere.
    S.bs = Math.max(BS * D / S.We, 3e-6);
    // what survives into the sheet: the boundary layer eats it, and a deep pool
    // spends the impact on a cavity instead of on a wall
    S.eff = Math.exp(-KVIS / Math.sqrt(S.Re)) / (1 + Math.pow(h / (HD * D), HP));
    S.t0 = 0.03 * S.tau;                               // regularises v_c at t=0
    S.hmin = 0.05 * h;
    S.nuA = 0.06 * dr * U;                             // stabiliser for the SWE
  }

  // ------------------------------------------------------- shallow water ---
  function pool(dt) {
    var n = S.n, dr = S.dr, r = S.r, h = S.h, u = S.u, hn = S.h2, un = S.u2,
        F = S.F, g = S.g, nu = S.nu, nuA = S.nuA, i, im, ip, uf, hf, fl, fr;

    for (i = 0; i < n - 1; i++) {
      uf = 0.5 * (u[i] + u[i + 1]);
      hf = uf > 0 ? h[i] : h[i + 1];
      F[i] = (r[i] + 0.5 * dr) * uf * hf;
    }
    // A cell may not export more than it holds: scale back the faces of any cell
    // the fluxes would drain past hmin.  Clamping h afterwards would conjure
    // liquid out of nothing, which on a micron-thin film is most of the pool.
    for (i = 0; i < n; i++) {
      fl = i === 0 ? 0 : F[i - 1];
      fr = i === n - 1 ? 0 : F[i];
      var out = Math.max(0, fr) + Math.max(0, -fl);
      S.K[i] = out > 0 ? Math.min(1, (h[i] - S.hmin) * r[i] * dr / (dt * out)) : 1;
    }
    for (i = 0; i < n - 1; i++) F[i] *= F[i] > 0 ? S.K[i] : S.K[i + 1];
    for (i = 0; i < n; i++) {
      fl = i === 0 ? 0 : F[i - 1];
      fr = i === n - 1 ? 0 : F[i];
      hn[i] = h[i] - dt * (fr - fl) / (r[i] * dr);
    }
    for (i = 0; i < n; i++) {
      im = i > 0 ? i - 1 : 0; ip = i < n - 1 ? i + 1 : n - 1;
      // Laminar drag is stiff for a thick liquid (rate 3 nu / h^2 can exceed
      // 1/dt), so it is integrated exponentially instead of explicitly: exact
      // for the linear part and unconditionally stable at any viscosity.
      un[i] = (u[i] + dt * (
        -(u[i] > 0 ? u[i] * (u[i] - u[im]) / dr : u[i] * (u[ip] - u[i]) / dr)
        - g * (h[ip] - h[im]) / ((ip - im) * dr)
        + nuA * (u[ip] - 2 * u[i] + u[im]) / (dr * dr)))
        * Math.exp(-3 * nu * dt / (h[i] * h[i]));
    }
    un[n - 1] = 0;
    S.h = hn; S.h2 = h; S.u = un; S.u2 = u;
  }

  // free surface height above the undisturbed level, interpolated
  function eta(rq) {
    var n = S.n, x = rq / S.dr - 0.5, i = Math.floor(x), f = x - i;
    if (i < 0) { i = 0; f = 0; }
    if (i >= n - 1) { i = n - 2; f = 1; }
    return S.h[i] * (1 - f) + S.h[i + 1] * f - S.p.poolDepth_m;
  }

  // Add (or, negative, remove) a volume of liquid to the pool around radius rq.
  // A thin film cannot give up more than it has, so the amount actually moved is
  // returned and the caller credits only that -- no liquid is invented.
  function deposit(rq, V, halfWidth) {
    var i, band = 0, moved = 0, dh, take, cell = clamp(Math.round(rq / S.dr - 0.5), 0, S.n - 1),
        w = Math.max(1, Math.round(halfWidth / S.dr));
    var j0 = Math.max(0, cell - w), j1 = Math.min(S.n - 1, cell + w);
    for (i = j0; i <= j1; i++) band += 2 * Math.PI * S.r[i] * S.dr;
    for (i = j0; i <= j1; i++) {
      dh = V / band;
      if (dh < 0) {
        dh = -Math.min(-dh, S.h[i] - S.hmin);
        S.u[i] *= Math.max(0, 1 + dh / S.h[i]);             // momentum leaves with it
      }
      S.h[i] += dh;
      moved += dh * 2 * Math.PI * S.r[i] * S.dr;
    }
    return moved;
  }

  // The foot of the sheet is the crater lip, and the solver already knows where
  // that is: the crest of the ridge the impact pushes outwards.  While the drop
  // is still coming in the Yarin-Weiss contact line sqrt(D U t) outruns it, so
  // take whichever is further out.  After the impact the lip is on the pool's
  // own clock -- a gravity wave, not sqrt(t) forever, which is what stops the
  // crown from opening without end.
  function lipR() {
    var i, best = 0, hb = -Infinity;
    for (i = 0; i < S.n; i++) if (S.h[i] > hb) { hb = S.h[i]; best = i; }
    var rl = S.r[best];
    if (S.t < S.tau) rl = Math.max(rl, Math.sqrt(S.D * S.U * (S.t + S.t0)));
    return clamp(rl, 0.25 * S.D, 0.45 * S.p.domainR_m);
  }

  // ------------------------------------------------------------- one substep
  function advance(dt) {
    var n = S.n, r = S.r, h = S.h, u = S.u, K = S.K, i, w, norm, e;
    var rc = lipR();
    // Triangular impact envelope 2(1 - t/tau)/tau, integrated EXACTLY over the
    // substep, so the drop delivers its volume and impulse once and in full
    // however coarsely the step lands on the impact time.
    var ta = Math.min(S.t, S.tau), tb = Math.min(S.t + dt, S.tau);
    var f = tb > ta ? ((tb - ta) - (tb * tb - ta * ta) / (2 * S.tau)) * 2 / S.tau / dt : 0;

    if (f > 0) {
      w = Math.max(0.55 * rc, 0.35 * S.D); norm = 0;
      for (i = 0; i < n; i++) {
        e = (r[i] - rc) / w; K[i] = Math.exp(-e * e);
        norm += K[i] * 2 * Math.PI * r[i] * S.dr;
      }
      for (i = 0; i < n; i++) {
        K[i] /= norm;
        h[i] += S.Vd * f * K[i] * dt;                     // the drop's own liquid...
        u[i] += S.Jr * f * K[i] / (S.rho * h[i]) * dt;    // ...shares the impulse
      }                                                   // so even a dry floor
      S.Vair = Math.max(0, S.Vair - S.Vd * f * dt);       // gets a finite speed
    }

    pool(dt);
    crown(dt, rc);
    ballistics(dt);          // the drops are in the air, not part of the rim
    S.t += dt;
  }

  // free droplets: ballistic, and back into the pool where they land
  function ballistics(dt) {
    for (var i = S.drops.length; i--;) {
      var d = S.drops[i];
      d.vz -= S.g * dt; d.r += d.vr * dt; d.z += d.vz * dt;
      if (d.r > S.p.domainR_m || d.z < eta(d.r) + d.a) {
        deposit(Math.min(d.r, S.p.domainR_m),
                d.n * 4 / 3 * Math.PI * d.a * d.a * d.a, 0.6 * S.D);
        S.drops.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- the rim
  // The sheet leaves the lip at B = (rc, eta(rc)) with speed Ve along ANG.  The
  // rim is one ring at X with velocity V, connected to B by a sheet of length L
  // and thickness b.  Per unit length of rim,
  //     d(m V)/dt = mdot * Ve_vec  +  m * g_vec  -  2 sigma * 2 pi R * s_hat
  // with mdot = rho b 2 pi rc Ve the liquid the lip keeps emitting.  m grows,
  // so sharing that momentum brakes the rim as the feed slows.  The capillary
  // term is evaluated as an acceleration on the sheet the rim has swept,
  // a = 2 sigma/(rho b L), which is strong while the sheet is short and fades
  // as the crown stretches; the rim's own accreted mass is tracked separately.
  function crown(dt, rc) {
    var rho = S.rho, sig = S.sig, i, d;
    var rim = S.rim;
    var Ve = S.eff * EJ * S.U * Math.pow(S.We / WE0, AL)
           * Math.sqrt(S.tau / (2 * (S.t + S.t0)));            // lip ejection speed
    var z0 = eta(rc), feeding = S.t < TFEED * S.tau && S.Vej < VCAP * S.Vd;
    var evr = Math.cos(ANG), evz = Math.sin(ANG);

    if (!rim) {
      if (!feeding || Ve < 0.2 * S.U) return;
      // born as a sheet one LS-th of a drop long, so Taylor-Culick starts finite
      var L0 = LS * S.D, m0 = -rho * deposit(rc, -S.bs * 2 * Math.PI * rc * L0, 0.5 * S.D);
      if (m0 <= 0) return;
      rim = S.rim = { R: rc + L0 * evr, Z: z0 + L0 * evz,
                      Vr: Ve * evr, Vz: Ve * evz, m: m0, a: 0 };
      S.Vej += m0 / rho;
      return;
    }

    var dx = rim.R - rc, dz = rim.Z - z0, L = Math.hypot(dx, dz);
    if (L < 1e-9) {                                  // collapsed onto its own base
      deposit(rim.R, rim.m / rho, 0.8 * S.D); S.rim = null; return;
    }
    var sr = dx / L, sz = dz / L;                    // unit vector base -> rim

    // The sheet is a conveyor: the lip emits rho b 2 pi rc Ve of liquid and the
    // rim sweeps all of it up.  Sharing its momentum with an ever-growing mass
    // is what decelerates the rim once the feed slows -- the rocket in reverse.
    var dm = 0;
    if (feeding) {
      dm = -rho * deposit(rc, -S.bs * 2 * Math.PI * rc * Ve * dt, 0.5 * S.D);
      S.Vej += dm / rho;
    }
    var fr = Ve * evr, fz = Ve * evz;                // velocity of arriving liquid
    var atc = 2 * sig / (rho * S.bs * L);            // Taylor-Culick, towards base
    var dvr = (dm * (fr - rim.Vr) / (rim.m + dm)) + (-atc * sr) * dt;
    var dvz = (dm * (fz - rim.Vz) / (rim.m + dm)) + (-atc * sz - S.g) * dt;
    var sp0 = Math.hypot(rim.Vr, rim.Vz);
    rim.m += dm;
    rim.Vr += dvr; rim.Vz += dvz;
    // Rayleigh-Taylor is driven by DEceleration only: the light air has to be
    // pushing the heavy rim, so take the drop in speed, not the whole |dv|.
    rim.a = Math.max(0, sp0 - Math.hypot(rim.Vr, rim.Vz)) / dt;

    // Rayleigh-Taylor on the decelerating rim: the most unstable wavenumber is
    // k = sqrt(rho a / 3 sigma), imprinted while the braking is strongest, and
    // the count is that wavelength wrapped around the rim, N = k R.  With
    // a ~ 2 sigma/(rho b L) and b ~ sigma/(rho U^2) this is N ~ R U/sqrt(sigma L)
    // ~ sqrt(We): faster impact, more fingers; more surface tension, fewer.
    // A finger also has to be at least as wide as the rim is thick: the rim is a
    // cylinder of radius ar, and surface tension will not let it bead finer than
    // the Rayleigh-Plateau wavelength 2 pi sqrt(2) ar.  Whichever mode is
    // coarser wins, so a stiffer liquid beads coarser and shows fewer fingers.
    var ar = Math.sqrt(rim.m / (rho * 2 * Math.PI * Math.PI * rim.R));
    var k = Math.min(Math.sqrt(rho * rim.a / (3 * sig)),
                     1 / (Math.SQRT2 * ar));
    if (k > S.k) S.k = k;                    // imprinted at the strongest braking
    S.N = Math.max(4, Math.round(S.k * rim.R));

    rim.R = clamp(rim.R + rim.Vr * dt, 0.3 * S.D, 0.92 * S.p.domainR_m);
    rim.Z += rim.Vz * dt;
    if (rim.Vz > S.vPk[1]) S.vPk = [rim.Vr, rim.Vz];

    // the crown has come back down: its liquid rejoins the pool, and the
    // crenellation the fingers cut into it smooths out only on the capillary
    // time of their own wavelength, tau = sqrt(rho lambda^3 / sigma), which is
    // longer than the splash itself -- so the ring stays scalloped after it lands
    if (rim.Vz < 0 && rim.Z <= Math.max(z0, eta(rim.R)) + 2 * S.bs) {
      deposit(rim.R, rim.m / rho, 0.8 * S.D);
      var lam = S.k > 0 ? 2 * Math.PI / S.k : 0;
      S.tFade = S.t + Math.sqrt(rho * lam * lam * lam / sig);
      S.rim = null; S.Vej = VCAP * S.Vd; return;
    }

    // the finger tips pinch off once the sheet stops feeding them
    if (dm === 0 && S.N > 3 && S.shed < 3 && S.t >= S.tShed && rim.Vz > 0) {
      var Vb = SHED * rim.m / rho / S.N;
      S.drops.push({ r: rim.R, z: rim.Z, a: Math.pow(3 * Vb / (4 * Math.PI), 1 / 3), n: S.N,
                     vr: 0.8 * S.vPk[0] + 0.1 * S.U, vz: 0.8 * S.vPk[1] });
      rim.m *= 1 - SHED;
      S.shed++; S.tShed = S.t + 0.45 * S.tau;
    }

  }

  // ------------------------------------------------------------------- step
  function step(dt) {
    var umax = 0, hmax = 0, i, a;
    for (i = 0; i < S.n; i++) {
      a = Math.abs(S.u[i]); if (a > umax) umax = a;
      if (S.h[i] > hmax) hmax = S.h[i];
    }
    var c = umax + Math.sqrt(S.g * hmax) + 0.5 * S.U;
    var ns = clamp(Math.ceil(dt / (0.25 * S.dr / c)), 1, 512);
    for (i = 0; i < ns; i++) advance(dt / ns);
  }

  // ------------------------------------------------------------- the profile
  // The wall is the sheet itself: a curved centreline from the lip up to the
  // rim, offset by half the sheet thickness, capped by the rim's own section.
  function wall() {
    var rim = S.rim; if (!rim) return null;
    var r0 = lipR(), z0 = eta(r0), b = S.bs;
    var L = Math.hypot(rim.R - r0, rim.Z - z0);
    if (rim.Z - z0 < 4 * b || L < 6 * b) return null;

    // The wall may only hold the liquid that actually left the pool.  The sheet
    // is b thick, and everything the sheet does not hold sits in the rim bead,
    // so solve the bead radius ar from the volume; if even a bare edge is too
    // much liquid the sheet itself is thinner than b and it is scaled instead.
    var M = 14, cx = r0 + 0.10 * (rim.R - r0), cy = z0 + 0.75 * (rim.Z - z0);
    var C = [], i, s, t1, Cr, Cz, Tr, Tz, nl;
    for (i = 0; i <= M; i++) {
      s = i / M; t1 = 1 - s;
      Cr = t1 * t1 * r0 + 2 * t1 * s * cx + s * s * rim.R;
      Cz = t1 * t1 * z0 + 2 * t1 * s * cy + s * s * rim.Z;
      Tr = 2 * (t1 * (cx - r0) + s * (rim.R - cx));
      Tz = 2 * (t1 * (cy - z0) + s * (rim.Z - cy));
      nl = Math.hypot(Tr, Tz) || 1;
      C.push([Cr, Cz, Tz / nl, -Tr / nl, s]);
    }

    function shape(f, ar) {
      var inn = [], out = [], j, c, hw, nr = 0, nz = 0, ph0, ph, at = ar, pts;
      for (j = 0; j <= M; j++) {
        c = C[j]; nr = c[2]; nz = c[3]; hw = f * (0.5 * b * (1 - c[4]) + ar * c[4]);
        inn.push([Math.max(1e-5, c[0] - nr * hw), c[1] - nz * hw]);
        out.push([c[0] + nr * hw, c[1] + nz * hw]);
      }
      pts = inn.slice(); ph0 = Math.atan2(-nz, -nr);         // tip normal, last loop
      for (j = 1; j < 9; j++) {                              // arc over the tip
        ph = ph0 - Math.PI * j / 9;
        pts.push([rim.R + at * Math.cos(ph), rim.Z + at * Math.sin(ph)]);
      }
      for (j = M; j >= 0; j--) pts.push(out[j]);
      return { pts: pts, rIn: inn[0][0], rOut: out[0][0] };
    }

    var target = rim.m / S.rho, lo = 0, hi = 0.4 * L, mid, k;
    if (revolved(shape(1, 0.5 * b).pts) > target) {          // even a bare edge: scale
      lo = 0; hi = 1;
      for (k = 0; k < 40; k++) {
        mid = 0.5 * (lo + hi);
        if (revolved(shape(mid, 0.5 * mid * b).pts) < target) lo = mid; else hi = mid;
      }
      mid = 0.5 * (lo + hi);
      return shape(mid, 0.5 * mid * b);
    }
    for (k = 0; k < 40; k++) {                               // otherwise: bead radius
      mid = 0.5 * (lo + hi);
      if (revolved(shape(1, mid).pts) < target) lo = mid; else hi = mid;
    }
    return shape(1, 0.5 * (lo + hi));
  }

  // volume swept by revolving a closed polygon, same formula the harness uses
  function revolved(q) {
    var m = 0, i, n = q.length, a, b;
    for (i = 0; i < n; i++) {
      a = q[i]; b = q[(i + 1) % n];
      m += (a[0] + b[0]) * (a[0] * b[1] - b[0] * a[1]);
    }
    return Math.abs(m) * Math.PI / 3;
  }

  function state() {
    var p = S.p, prof = [], w = wall(), placed = false, i, rq, q;
    prof.push([0, eta(0)]);
    for (i = 0; i < S.n; i++) {
      rq = S.r[i];
      if (w && !placed && rq > w.rIn) {
        for (q = 0; q < w.pts.length; q++) prof.push(w.pts[q]);
        placed = true;
      }
      if (w && rq > w.rIn && rq < w.rOut) continue;
      prof.push([rq, eta(rq)]);
    }
    if (w && !placed) for (q = 0; q < w.pts.length; q++) prof.push(w.pts[q]);
    prof.push([p.domainR_m, eta(p.domainR_m)]);

    var drops = S.drops.map(function (d) { return { r: d.r, z: d.z, a: d.a, n: d.n }; });
    // The part of the drop that has not merged yet is exactly that: a drop, on
    // the axis, just touching the surface.  It keeps the volume books straight
    // from the very first state() instead of leaving it to LEVEL to invent.
    if (S.Vair > 1e-9 * S.Vd) {
      var ad = Math.cbrt(0.75 * S.Vair / Math.PI);
      drops.push({ r: 0, z: eta(0) + ad, a: ad, n: 1 });
    }
    var L = (typeof LEVEL === "function") ? LEVEL
          : (global && typeof global.LEVEL === "function") ? global.LEVEL : null;
    if (L) { var q2 = L(prof, p, drops); if (q2 && q2.length) prof = q2; }
    return { profile: prof, fingers: (S.rim || S.t < S.tFade) ? S.N : 0, drops: drops };
  }

  global.BENCH = { reset: reset, step: step, state: state };
})(typeof window !== "undefined" ? window : this);
