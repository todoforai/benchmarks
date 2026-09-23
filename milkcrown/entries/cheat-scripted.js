// Negative control: walls animated outward as sqrt(t), no physics, no parameters used.
// Scores whatever a canned animation is worth - the floor an actual solver must beat.
(() => { let P, t;
  const reset = p => { P = p; t = 0; };
  const step = dt => { t += dt; };
  const draw = ctx => { const { cx, surfaceY, w, h, pxPerMm } = P, f = Math.min(t / 0.010, 1);
    ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, surfaceY, w, h - surfaceY);
    const R = pxPerMm * (1 + 3 * Math.sqrt(f)), H = pxPerMm * 3 * f, T = pxPerMm * 0.5;
    if (H < 1) { ctx.beginPath(); ctx.arc(cx, surfaceY - 20, 20, 0, 7); ctx.fill(); return; }
    for (const s of [-1, 1]) ctx.fillRect(cx + s * R - T, surfaceY - H, T * 2, H); };
  window.BENCH = { reset, step, draw }; })();
