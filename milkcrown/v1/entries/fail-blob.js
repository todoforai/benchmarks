// Failure mode "mushroom": a blob rises over the impact point, no rim, no crown.
(() => { let P, t, R;
  const reset = p => { P = p; t = 0; R = p.dropD_mm / 2 * p.pxPerMm; };
  const step = dt => { t += dt; };
  const draw = ctx => { const f = Math.min(t / 0.010, 1), { cx, surfaceY, w, h } = P;
    ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, surfaceY, w, h - surfaceY);
    const r = R * (1 + f * 1.6), y = surfaceY - r * 0.9 * Math.sin(Math.PI * f);
    ctx.beginPath(); ctx.ellipse(cx, y, r, r * 0.8, 0, 0, 7); ctx.fill(); };
  window.BENCH = { reset, step, draw }; })();
