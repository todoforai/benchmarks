#!/usr/bin/env node
// Score model submissions. One file per model in entries/<name>.js.
//   ./score.js                 all entries, seeds 1..5
//   ./score.js gpt-5.6-sol     one entry
//   SEEDS=1,2,3 ./score.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const dir = __dirname;
const seeds = (process.env.SEEDS || '1,2,3,4,5').split(',').map(Number);
const pick = process.argv.slice(2);
const entries = fs.readdirSync(path.join(dir, 'entries')).filter(f => f.endsWith('.js'))
  .map(f => f.replace(/\.js$/, '')).filter(n => !pick.length || pick.includes(n));

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const RUN_MS = 60000;

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const out = [];

  for (const name of entries) {
    const src = fs.readFileSync(path.join(dir, 'entries', name + '.js'), 'utf8');
    // One fresh page per entry: an entry can wreck the realm, and a hung page
    // is closed rather than waited on, so one bad submission can't stall the batch.
    const call = async expr => {
      const page = await browser.newPage();
      try {
        await page.goto('file://' + path.join(dir, 'harness.html'));
        await page.addScriptTag({ content: src });
        return await page.evaluate(expr).catch(e => ({ error: String(e.message).split('\n')[0] }));
      } catch (e) {
        return { error: String(e.message).split('\n')[0] };
      } finally { await page.close().catch(() => {}); }
    };
    const guarded = expr => Promise.race([call(expr),
      new Promise(r => setTimeout(() => r({ error: 'timeout' }), RUN_MS))]);

    const runs = [];
    for (const seed of seeds) {
      let r = await guarded(`(() => { try { return RUN(${seed}) } catch (e) { return { error: String(e && e.message || e) } } })()`);
      if (r.error) {
        console.log(`${name} seed ${seed}  ERROR  ${r.error}`);
        r = { seed, total: 0, error: r.error, crown: 0, sym: 0, droplets: 0, spread: 0, valid: false };
      } else {
        console.log(`${name} seed ${seed}  ${r.total.toFixed(3)}  crown ${r.crown.toFixed(2)} sym ${r.sym.toFixed(2)} drops ${r.maxDrops} spread ${r.spread.toFixed(2)}${r.valid ? '' : '  INVALID drift=' + r.drift.toFixed(2)}`);
      }
      runs.push(r);
    }

    // The physics probe runs once, on the first seed.
    const pr = await guarded(`(() => { try { return PROBE(${seeds[0]}) } catch (e) { return { error: String(e && e.message || e) } } })()`);
    const response = pr.error ? 0 : pr.response;
    console.log(`${name} probe  response ${response.toFixed(2)}  (lo ${(pr.lo || 0).toFixed(0)}px -> hi ${(pr.hi || 0).toFixed(0)}px)`);

    const frames = (runs.find(r => r.frames) || {}).frames || [];
    const e = { name, response,
      total: avg(runs.map(r => r.total)) + (runs.some(r => r.valid) ? 0.20 * response : 0),
      crown: avg(runs.map(r => r.crown)), sym: avg(runs.map(r => r.sym)),
      droplets: avg(runs.map(r => r.droplets)), spread: avg(runs.map(r => r.spread)),
      seeds: runs.map(r => ({ seed: r.seed, total: r.total, valid: !!r.valid, drift: r.drift, error: r.error || null })),
      error: runs.find(r => r.error)?.error || null, frames };
    out.push(e);
    console.log(`${name}  TOTAL ${e.total.toFixed(3)}\n`);
  }

  await browser.close();
  out.sort((a, b) => b.total - a.total);
  fs.mkdirSync(path.join(dir, 'results'), { recursive: true });
  const strip = e => ({ ...e, frames: undefined });
  fs.writeFileSync(path.join(dir, 'results/scores.json'),
    JSON.stringify({ seeds, entries: out.map(strip) }, null, 1));
  // view.html is opened over file://, where fetch() is blocked -> ship the data as a script
  fs.writeFileSync(path.join(dir, 'results/scores.js'),
    'window.SCORES=' + JSON.stringify({ seeds, entries: out }));
  console.log('-> results/scores.json, results/view.html');
})();
