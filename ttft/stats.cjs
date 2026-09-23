// Extra stats from results.jsonl rows (stdin): spread, worst case, share under 1s/2s, generation time.
// Usage: tail -14 results.jsonl | node stats.cjs      (n is small: "worst" is the max sample)
const rows = require('fs').readFileSync(0, 'utf8').trim().split('\n').map(JSON.parse);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
console.log('model\tvis p50\tworst\tCV%\t<1s\t<2s\tgen p50\ttotal p50');
for (const x of rows.map((r) => ({ r, v: r.samples.visible, t: r.samples.total })).sort((a, b) => Math.max(...a.v) - Math.max(...b.v))) {
  const { r, v, t } = x, n = v.length, gen = t.map((x, i) => x - v[i]);
  console.log([r.label, q(v, 0.5), Math.max(...v), Math.round((100 * sd(v)) / mean(v)),
    `${v.filter((x) => x < 1000).length}/${n}`, `${v.filter((x) => x < 2000).length}/${n}`, q(gen, 0.5), q(t, 0.5)].join('\t'));
}
