// Negative control: a frozen picture of a crown, never moving. Must score ~0.
// If this ever scores well, the scorer is measuring a drawing, not a splash.
(() => { let P;
  const reset = p => { P = p; };
  const step = () => {};
  const draw = ctx => { const { cx, surfaceY, w, h, pxPerMm } = P;
    ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, surfaceY, w, h - surfaceY);
    const R = 3 * pxPerMm, H = 3.5 * pxPerMm, T = pxPerMm * 0.6;
    for (const s of [-1, 1]) { ctx.fillRect(cx + s * R - T, surfaceY - H, T * 2, H);
      for (let k = 0; k < 3; k++) { ctx.beginPath();
        ctx.arc(cx + s * (R + k * 8), surfaceY - H - 10 - k * 6, 3, 0, 7); ctx.fill(); } } };
  window.BENCH = { reset, step, draw }; })();
