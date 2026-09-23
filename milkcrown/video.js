#!/usr/bin/env node
// Render an mp4 from entries. Needs ffmpeg.
//   ./video.js                  every entry side by side -> results/milkcrown.mp4
//   ./video.js reference        one entry                -> results/reference.mp4
//   SEED=3 SECONDS=20 ./video.js
//
// The impact lasts 10 ms, so the 201 simulation frames are stretched over
// SECONDS and the last one is held, which is what makes it readable.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

const dir = __dirname, out = path.join(dir, 'results');
const seed = +(process.env.SEED || 1), seconds = +(process.env.SECONDS || 16);
const FPS = 30, HOLD = 2 * FPS;
const pick = process.argv.slice(2);
const names = fs.readdirSync(path.join(dir, 'entries')).filter(f => f.endsWith('.js'))
  .map(f => f.replace(/\.js$/, '')).filter(n => !pick.length || pick.includes(n));

const LW = 480, LH = 300, PAD = 12, HEAD = 32, TOP = 46;

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });

  const lanes = [];
  for (const name of names) {
    const page = await browser.newPage();
    await page.goto('file://' + path.join(dir, 'harness.html'));
    await page.addScriptTag({ content: fs.readFileSync(path.join(dir, 'entries', name + '.js'), 'utf8') });
    const frames = await page.evaluate(s => { try { return FILM(s) } catch { return [] } }, seed).catch(() => []);
    await page.close();
    if (frames.length) { lanes.push({ name, frames }); console.log(`${name}  ${frames.length} frames`); }
    else console.log(`${name}  no frames, skipped`);
  }
  if (!lanes.length) { await browser.close(); console.log('nothing to render'); process.exit(1); }

  const scores = (() => { try { return require('./results/scores.json').entries } catch { return [] } })();
  const rank = n => { const s = scores.find(e => e.name === n); return s ? -s.total : 1; };
  lanes.sort((a, b) => rank(a.name) - rank(b.name));   // best lane first
  const cols = Math.min(lanes.length, 3), rows = Math.ceil(lanes.length / cols);
  const W = cols * LW + (cols + 1) * PAD, H = TOP + rows * (LH + HEAD + PAD) + PAD;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'milkcrown-'));

  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(grid(cols), { waitUntil: 'load' });
  await page.evaluate(d => __load(d), { lanes, scores, seed });

  const n = Math.max(...lanes.map(l => l.frames.length));
  const shots = Math.round(seconds * FPS);
  for (let k = 0; k < shots + HOLD; k++) {
    await page.evaluate(i => __frame(i), Math.min(Math.floor(k / shots * n), n - 1));
    await page.screenshot({ path: path.join(tmp, 'f' + String(k).padStart(5, '0') + '.png') });
  }
  await browser.close();

  const mp4 = path.join(out, (pick.length === 1 ? pick[0] : 'milkcrown') + '.mp4');
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.png'),
    '-vf', 'format=yuv420p,pad=ceil(iw/2)*2:ceil(ih/2)*2', '-movflags', '+faststart', mp4],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('-> ' + mp4);
})();

const grid = cols => `<!doctype html><meta charset=utf-8><style>
  body{margin:0;background:#06080c;color:#e7e7e7;font:14px/1.4 ui-sans-serif,system-ui;overflow:hidden}
  h1{font-size:17px;letter-spacing:2px;margin:${PAD}px 0 0 ${PAD}px;display:inline-block}
  .q{font-size:11px;opacity:.45;margin-left:12px}
  .g{display:grid;grid-template-columns:repeat(${cols},${LW}px);gap:${PAD}px;margin:8px ${PAD}px}
  .l{background:#0b0e14;border-radius:8px;overflow:hidden}
  .h{display:flex;justify-content:space-between;padding:7px 10px;font-size:13px;font-weight:600}
  .l img{width:${LW}px;height:${LH}px;display:block}
  .p{color:#5ec26a}.f{color:#8b95a3}
</style><h1>MILKCROWN</h1><span class=q id=q></span><div class=g id=g></div><script>
  let D;
  window.__load = d => { D = d;
    q.textContent = '"Drop milk into milk. Make a crown."   seed ' + d.seed;
    g.innerHTML = d.lanes.map((l, i) => {
      const s = d.scores.find(e => e.name === l.name);
      return '<div class=l><div class=h><span>' + l.name + '</span><span class="' +
        (s && s.total > .6 ? 'p' : 'f') + '">' + (s ? s.total.toFixed(3) : '') +
        '</span></div><img id=i' + i + '></div>';
    }).join(''); };
  window.__frame = k => D.lanes.forEach((l, i) =>
    document.getElementById('i' + i).src = l.frames[Math.min(k, l.frames.length - 1)]);
<\/script>`;
