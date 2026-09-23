// Drop impact on a shallow pool, 2D cross-section.
// Model: Yarin–Weiss kinematic discontinuity (crown base R = C·sqrt(D·V·t)) feeds a
// Lagrangian liquid sheet; its free edge is a Taylor–Culick rim (pulled back by 2σ,
// collecting sheet mass) that sheds droplets on the capillary time. Only the right
// half is simulated; the left half is its exact mirror. The pool surface (crater +
// uniform level) is set every frame so drawn liquid area equals the initial area.
(function () {
  const MM = 1e-3, ALPHA = 0.5, BETA = 0.8;    // sheet launch direction, relative to base speed
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let P, S;

  function reset(p) {
    P = p;
    const D = p.dropD_mm * MM, V = p.impactV_mps, h = p.poolDepth_mm * MM;
    const rho = p.rho_kgm3, sig = p.sigma_Npm, mu = p.mu_mPas * 1e-3, g = p.g_mps2;
    const k = p.pxPerMm * 1000;                                  // px per metre
    const bottomPx = Math.min(p.h, p.surfaceY + h * k);
    const AdropPx = Math.PI * (D / 2 * k) ** 2;
    S = {
      t: 0, D, V, h, rho, sig, g, k,
      C: clamp(Math.pow(2 * D / (3 * h), 0.25), 0.7, 1.6),       // Yarin–Weiss crown constant
      eb: 0.2 * h * D / (h + D),                                  // sheet thickness at the base
      speed: 1 / (1 + 5 * mu / Math.sqrt(rho * sig * D)),         // viscous loss (Ohnesorge)
      tau0: 0.6 * D / V,                                          // crown emerges once the drop is in
      emitting: true, R: 0, rim: null, sheet: [], drops: [],
      uStop: 0.5 * Math.sqrt(2 * sig / (rho * 0.2 * h * D / (h + D))), // Taylor–Culick speed of the base film
      bottomPx, AdropPx, A0: p.w * (bottomPx - p.surfaceY) + AdropPx,
    };
  }

  const Rof = t => S.C * Math.sqrt(S.D * S.V * t);
  const Rdot = t => 0.5 * S.C * Math.sqrt(S.D * S.V / t);
  const rimR = A => Math.sqrt(A / Math.PI);

  function emit(t) {
    const R1 = Rof(t), u = Rdot(t) * S.speed;
    if (!S.rim) {
      S.rim = { x: R1, y: 0, vx: ALPHA * u, vy: BETA * u, A: Math.PI * S.eb * S.eb / 4, pinch: t, rel: 0 };
    } else {
      S.sheet.push({ x: R1, y: 0, vx: ALPHA * u, vy: BETA * u, m: S.eb * (R1 - S.R) });
    }
    S.R = R1;
    if (u < S.uStop) S.emitting = false;        // base no longer outruns capillary retraction
  }

  function absorbCrown() {
    S.rim = null; S.sheet = []; S.emitting = false;
  }

  function sub(dt) {
    S.t += dt;
    const t = S.t, g = S.g;
    if (S.emitting && t >= S.tau0) emit(t);
    for (const q of S.sheet) { q.vy -= g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    S.sheet = S.sheet.filter(q => q.y > 0);

    const r = S.rim;
    if (r) {
      const nx0 = S.sheet.length ? S.sheet[0] : { x: S.R, y: 0 };
      let dx = nx0.x - r.x, dy = nx0.y - r.y, L = Math.hypot(dx, dy) || 1;
      dx /= L; dy /= L;
      const a = 2 * S.sig / (S.rho * r.A);                       // Taylor–Culick pull
      r.vx += a * dx * dt; r.vy += (a * dy - g) * dt;
      r.x += r.vx * dt; r.y += r.vy * dt;
      let rr = rimR(r.A);
      while (S.sheet.length && Math.hypot(S.sheet[0].x - r.x, S.sheet[0].y - r.y) < rr) {
        const q = S.sheet.shift(), M = r.A + q.m;
        r.rel = (q.vx - r.vx) * -dx + (q.vy - r.vy) * -dy;
        r.vx = (r.A * r.vx + q.m * q.vx) / M; r.vy = (r.A * r.vy + q.m * q.vy) / M;
        r.A = M; rr = rimR(M);
      }
      // Rayleigh–Plateau / Rayleigh–Taylor: the decelerating rim pinches off a droplet
      const tc = Math.sqrt(S.rho * rr ** 3 / S.sig), Ad = 0.3 * r.A, rd = rimR(Ad);
      if (t - r.pinch > 3 * tc && r.rel > 0.1 && rd * S.k > 1.2) {
        r.A -= Ad; r.pinch = t;
        const off = rimR(r.A) + rd + 1.5 / S.k;
        S.drops.push({ x: r.x - dx * off, y: r.y - dy * off, vx: r.vx, vy: r.vy, A: Ad });
      }
      if (r.y < 0) absorbCrown();
      else if (!S.emitting && !S.sheet.length) {                 // sheet drained: rim flies free as a drop
        S.drops.push({ x: r.x, y: r.y, vx: r.vx, vy: r.vy, A: r.A }); absorbCrown();
      }
    }
    for (const d of S.drops) { d.vy -= g * dt; d.x += d.vx * dt; d.y += d.vy * dt; }
    S.drops = S.drops.filter(d => d.y > 0);
  }

  function step(dt) {
    const n = 4;
    for (let i = 0; i < n; i++) sub(dt / n);
  }

  // area of a disc of radius a above a horizontal line lying u above its centre
  const capArea = (a, u) => u <= -a ? Math.PI * a * a : u >= a ? 0 : a * a * Math.acos(u / a) - u * Math.sqrt(a * a - u * u);

  function draw(ctx) {
    const k = S.k, cx = P.cx, W = P.w, wmin = 1.5;
    // liquid thrown off the canvas cannot be drawn; it is booked back into the pool
    const onCanvas = (x, y) => x < W - cx && x < cx && y < P.surfaceY;
    const segs = [];
    let Ahalf = 0;
    if (S.rim) {
      const nodes = [{ x: S.rim.x, y: S.rim.y, m: 0 }, ...S.sheet, { x: S.R, y: 0, m: 0 }];
      for (let i = 0; i + 1 < nodes.length; i++) {
        const a = nodes[i], b = nodes[i + 1];
        const ds = Math.hypot(b.x - a.x, b.y - a.y) * k;
        const m = (a.m + b.m) / 2 * k * k;
        const w = clamp(ds > 0 ? m / ds : wmin, wmin, 3 * S.eb * k);
        segs.push([a.x * k, -a.y * k, b.x * k, -b.y * k, w]);
        if (onCanvas(b.x * k, b.y * k)) Ahalf += w * ds;
      }
    }
    const blobs = [];
    if (S.rim) blobs.push([S.rim.x * k, -S.rim.y * k, Math.max(rimR(S.rim.A) * k, wmin / 2)]);
    for (const d of S.drops) blobs.push([d.x * k, -d.y * k, Math.max(rimR(d.A) * k, 1)]);
    for (const b of blobs) if (onCanvas(b[0], -b[1])) Ahalf += Math.PI * b[2] * b[2];

    const Rd = S.D / 2 * k, yc = (S.D / 2 - S.V * S.t) * k;       // drop centre height, px
    const Aseg = capArea(Rd, -yc);
    const Aair = 2 * Ahalf + Aseg;

    // pool: crater absorbs what the crown took, uniform level absorbs the rest
    const Rc = S.R * k, depth0 = S.bottomPx - P.surfaceY;
    const dmax = Math.max(0, Math.min((S.h - Math.max(0.15 * S.h, 2 / k)) * k, depth0 - 2));
    const dc = Rc > 1 ? clamp((Aair - S.AdropPx) / (1.6 * Rc), 0, dmax) : 0;
    const lift = (S.A0 - Aair - (W * depth0 - 1.6 * Rc * dc)) / W;
    const Y0 = P.surfaceY - lift;

    ctx.save();
    ctx.fillStyle = ctx.strokeStyle = '#f5f2ea';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, S.bottomPx);
    for (let X = 0; X <= W; X++) {
      const s = Math.abs(X - cx) / Rc;
      ctx.lineTo(X, Y0 + (s < 1 ? dc * (1 - s ** 4) : 0));
    }
    ctx.lineTo(W, S.bottomPx);
    ctx.closePath();
    ctx.fill();

    if (Aseg > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, Y0 + 0.5); ctx.clip();
      ctx.beginPath(); ctx.arc(cx, Y0 - yc, Rd, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();
    }

    for (const sx of [1, -1]) {
      ctx.save();
      ctx.translate(cx, Y0); ctx.scale(sx, 1);
      for (const [x1, y1, x2, y2, w] of segs) {
        ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
  }

  window.BENCH = { reset, step, draw };
})();
