#!/usr/bin/env node
// Put an entry next to the real high-speed film, aligned on the film's own clock.
//   ./film.js claude-opus-5.5        -> results/film-claude-opus-5.5.mp4
// Both panes advance in tau = t V / D, so the same column is the same instant of
// the splash in both, and the height/timing claims are checkable by eye.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const dir = __dirname, out = path.join(dir, 'results');
const FRAMES = path.join(dir, 'filmframes');     // h%04d.png, 24fps, from the source clip
const I0 = 65.53, FPT = 20.27;                   // contact frame, frames per tau (see truth.js)
const name = process.argv[2] || 'claude-opus-5.5';
const seed = +(process.env.SEED || 1), seconds = +(process.env.SECONDS || 14);
const TAU_MAX = 7, FPS = 30, HOLD = 2 * FPS;
const LW = 560, LH = 420, PAD = 12;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page0 = await browser.newPage();
  // shot from near the surface, like the film, so the two crowns are comparable
  await page0.goto('file://' + path.join(dir, 'harness.html') + '?el=0.10&viewr=0.0075');
  await page0.addScriptTag({ content: fs.readFileSync(path.join(dir, 'entries', name + '.js'), 'utf8') });
  const sim = await page0.evaluate(s => ({ frames: FILM(s), p: __params(s) }), seed);
  await page0.close();
  const { dropD_m: D, impactV_mps: V } = sim.p;
  const perTau = D / (V * 5e-5);                 // sim steps per unit tau

  // the film pane: crop to the splash and scale to the sim pane
  const film = tau => {
    const k = Math.round(I0 + tau * FPT);
    return path.join(FRAMES, 'h' + String(Math.max(1, Math.min(192, k))).padStart(4, '0') + '.png');
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'milkfilm-'));
  const W = 2 * LW + 3 * PAD, H = 46 + LH + 32 + PAD;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html(name, sim.scoreLabel), { waitUntil: 'load' });

  const shots = Math.round(seconds * FPS);
  for (let k = 0; k < shots + HOLD; k++) {
    const tau = Math.min(k / shots, 1) * TAU_MAX;
    const i = Math.min(Math.round(tau * perTau), sim.frames.length - 1);
    const buf = fs.readFileSync(film(tau)).toString('base64');
    await page.evaluate(d => __set(d), { film: 'data:image/png;base64,' + buf, sim: sim.frames[i], tau });
    await page.screenshot({ path: path.join(tmp, 'f' + String(k).padStart(5, '0') + '.png') });
  }
  await browser.close();

  const mp4 = path.join(out, 'film-' + name + '.mp4');
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.png'),
    '-vf', 'format=yuv420p,pad=ceil(iw/2)*2:ceil(ih/2)*2', '-movflags', '+faststart', mp4],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('-> ' + mp4);
})();

const score = n => { try { return require('./results/scores.json').entries.find(e => e.name === n) } catch { return null } };

function html(name) {
  const s = score(name);
  return `<!doctype html><meta charset=utf-8><style>
  body{margin:0;background:#06080c;color:#e7e7e7;font:14px/1.4 ui-sans-serif,system-ui;overflow:hidden}
  h1{font-size:17px;letter-spacing:2px;margin:${PAD}px 0 0 ${PAD}px;display:inline-block}
  .q{font-size:11px;opacity:.45;margin-left:12px}
  .g{display:grid;grid-template-columns:repeat(2,${LW}px);gap:${PAD}px;margin:8px ${PAD}px}
  .l{background:#0b0e14;border-radius:8px;overflow:hidden}
  .h{display:flex;justify-content:space-between;padding:7px 10px;font-size:13px;font-weight:600}
  .l img,.l canvas{width:${LW}px;height:${LH}px;display:block;object-fit:cover}
  .p{color:#5ec26a}
</style><h1>MILKCROWN</h1><span class=q id=q></span><div class=g>
  <div class=l><div class=h><span>real high-speed film</span><span class=q>Beyond 1000FPS</span></div>
    <img id=a></div>
  <div class=l><div class=h><span>${name}</span><span class=p>${s ? s.total.toFixed(3) : ''}</span></div>
    <img id=b></div>
</div><script>
  window.__set = d => { a.src = d.film; b.src = d.sim;
    q.textContent = 'same clock: tau = t V / D = ' + d.tau.toFixed(2); };
<\/script>`;
}
