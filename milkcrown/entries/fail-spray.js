// Failure mode "spray": the drop shatters into unstructured particles.
(() => { let P, t, ps;
  const reset = p => { P = p; t = 0; let s = p.seed * 7919 % 2147483647;
    const r = () => (s = s * 16807 % 2147483647) / 2147483647;
    ps = Array.from({ length: 40 }, () => { const a = r() * Math.PI * 2, v = 200 + r() * 900;
      return { x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v, r: 2 + r() * 3 }; }); };
  const step = dt => { t += dt; for (const q of ps) { q.vy -= 9810 * dt * 3; q.x += q.vx * dt; q.y += q.vy * dt; } };
  const draw = ctx => { const { cx, surfaceY, w, h } = P;
    ctx.fillStyle = '#eef2f7'; ctx.fillRect(0, surfaceY, w, h - surfaceY);
    for (const q of ps) { const y = surfaceY - q.y; if (y > surfaceY) continue;
      ctx.beginPath(); ctx.arc(cx + q.x, y, q.r, 0, 7); ctx.fill(); } };
  window.BENCH = { reset, step, draw }; })();
