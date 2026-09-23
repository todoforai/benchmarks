// Failure mode "unstable solver": volume blows up, the run is rejected.
(() => { let P, t;
  const reset = p => { P = p; t = 0; };
  const step = dt => { t += dt; };
  const draw = ctx => { const { cx, surfaceY, w, h, pxPerMm } = P; const g = 1 + t * 900;
    ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, surfaceY, w, h - surfaceY);
    for (let i = 0; i < 24; i++) { const a = i / 24 * 7;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 20 * g, surfaceY - Math.abs(Math.sin(a)) * 18 * g, 6 * g, 0, 7); ctx.fill(); } };
  window.BENCH = { reset, step, draw }; })();
