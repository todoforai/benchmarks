// Reference entry. Not a fluid solver: an analytic crater + rim model whose only
// job is to prove the benchmark is reachable and to pin the top of the scale.
// It does respond to the parameters, which is what the probe checks.
(() => {
  let P, T, t, dropR, drops, craterR, wallH, wallT, We;

  const reset = p => {
    P = p; t = 0; drops = [];
    dropR = p.dropD_mm / 2 * p.pxPerMm;
    const D = p.dropD_mm / 1000, U = p.impactV_mps;
    We = p.rho_kgm3 * U * U * D / p.sigma_Npm;      // Weber number drives the splash
    T = 2.2 * D / U;                                // crown lifetime ~ drop / speed
    craterR = 0; wallH = 0; wallT = 0;
  };

  const step = dt => {
    t += dt;
    const f = Math.min(t / T, 1);
    craterR = dropR * (0.9 + 4.2 * Math.sqrt(f));
    wallH = dropR * 0.09 * Math.sqrt(We) * Math.sin(Math.PI * Math.pow(f, 0.75));
    wallT = Math.max(3, dropR * 0.42 * (1 - 0.35 * f));

    // Plateau-Rayleigh: a thin tall rim beads up and throws droplets
    const t0 = T * 0.35, every = T * 0.07;
    while (t > t0 && drops.length < 10 && drops.length < (t - t0) / every) {
      const k = drops.length;
      drops.push({ x: craterR, y: wallH, vx: dropR * 55 * (0.9 + 0.05 * (k % 3)),
                   vy: -dropR * 130 * (0.8 + 0.08 * (k % 4)), r: Math.max(2, dropR * 0.20) });
    }
    for (const d of drops) { d.vy += P.g_mps2 * P.pxPerMm * 1000 * dt; d.x += d.vx * dt; d.y -= d.vy * dt; }
  };

  // depression profile that returns exactly the liquid standing above the surface,
  // measured the way the harness measures it: in pixels
  const crater = () => {
    if (craterR < 1) return 0;
    let above = 2 * wallH * wallT * 0.78;                 // the two curved sheets
    for (const d of drops) if (d.y > d.r) above += 2 * Math.PI * d.r * d.r;
    above -= Math.PI * dropR * dropR;                     // the drop was already liquid
    const maxD = P.poolDepth_mm * P.pxPerMm * 0.95;
    return Math.max(0, Math.min(above / (craterR * 0.55), maxD));
  };

  const draw = ctx => {
    const { cx, surfaceY, w, h } = P, R = craterR, D = crater();
    ctx.fillStyle = '#eef2f7';

    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, surfaceY);
    for (let x = 0; x <= w; x += 2) {
      const u = Math.abs(x - cx);
      ctx.lineTo(x, surfaceY + (u < R ? D * Math.cos(Math.PI * u / (2 * R)) ** 2 : 0));
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();

    if (wallH > 1) for (const s of [-1, 1]) {
      const x0 = cx + s * R, tip = x0 + s * wallH * 0.20;
      ctx.beginPath();
      ctx.moveTo(x0 - wallT, surfaceY);
      ctx.quadraticCurveTo(tip - wallT * 0.7, surfaceY - wallH * 0.55, tip - wallT * 0.5, surfaceY - wallH);
      ctx.lineTo(tip + wallT * 0.5, surfaceY - wallH);
      ctx.quadraticCurveTo(tip + wallT * 0.7, surfaceY - wallH * 0.55, x0 + wallT, surfaceY);
      ctx.closePath(); ctx.fill();
      if (!drops.length) { ctx.beginPath(); ctx.arc(tip, surfaceY - wallH, wallT * 0.75, 0, 7); ctx.fill(); }
    }

    for (const d of drops) for (const s of [-1, 1]) {
      const y = surfaceY - d.y;
      if (y > surfaceY - d.r - 3) continue;
      ctx.beginPath(); ctx.arc(cx + s * d.x, y, d.r, 0, 7); ctx.fill();
    }

    if (t < 1e-6) { ctx.beginPath(); ctx.arc(cx, surfaceY - dropR, dropR, 0, 7); ctx.fill(); }
  };

  window.BENCH = { reset, step, draw };
})();
