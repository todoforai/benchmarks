// Failure mode "nothing happens": ripples only, the pool never breaks the surface.
(() => { let P, t;
  const reset = p => { P = p; t = 0; };
  const step = dt => { t += dt; };
  const draw = ctx => { const { cx, surfaceY, w, h, pxPerMm } = P;
    ctx.fillStyle = '#eef2f7'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, surfaceY);
    for (let x = 0; x <= w; x += 2) { const u = (x - cx) / pxPerMm;
      ctx.lineTo(x, surfaceY + Math.cos(u * 1.2 - t * 600) * Math.exp(-Math.abs(u) / 8) * 4 * Math.min(t / 0.002, 1)); }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill(); };
  window.BENCH = { reset, step, draw }; })();
