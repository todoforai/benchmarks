#!/usr/bin/env bun
// Deterministic render of a real-time (rAF-driven, e.g. three.js) page → mp4.
// Injects a virtual clock (performance.now / Date.now / requestAnimationFrame /
// setTimeout-free), advances it exactly 1/fps per frame, screenshots each frame.
// Slow GPU/SwiftShader only makes rendering slower, never janky.
//   bun vclock.ts <index.html> <out.mp4> [--secs 10] [--start 0] [--fps 30] [--w 1920 --h 1080] [--gpu]
import { chromium } from "playwright-core";
import { parseArgs } from "node:util";

const { values: o, positionals: [html, out] } = parseArgs({ allowPositionals: true, options: {
  secs: { type: "string", default: "10" }, start: { type: "string", default: "0" }, fps: { type: "string", default: "30" },
  w: { type: "string", default: "1920" }, h: { type: "string", default: "1080" }, gpu: { type: "boolean", default: false } } });
if (!html || !out) { console.error("usage: vclock.ts <index.html> <out.mp4> [...]"); process.exit(2); }
const [W, H, FPS, SECS, START] = [+o.w!, +o.h!, +o.fps!, +o.secs!, +o.start!];

const gl = o.gpu ? (process.platform === "win32" ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-gl=angle", "--use-angle=vulkan", "--enable-gpu", "--ignore-gpu-blocklist"])
                 : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--mute-audio", ...gl] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors: string[] = [];
page.on("pageerror", e => errors.push(String(e)));

await page.addInitScript(() => {
  const w = window as any; let now = 0; const epoch = Date.now();
  let q: [number, FrameRequestCallback][] = []; let id = 0;
  performance.now = () => now;
  const RD = Date; w.Date = class extends RD { constructor(...a: any[]) { a.length ? super(...(a as [])) : super(epoch + now); } static now() { return epoch + now; } };
  w.requestAnimationFrame = (cb: FrameRequestCallback) => { q.push([++id, cb]); return id; };
  w.cancelAnimationFrame = (h: number) => { q = q.filter(([i]) => i !== h); };
  // advance virtual time by dt ms, running rAF callbacks once per step
  w.__advance = (dt: number) => { now += dt; const run = q; q = []; for (const [, cb] of run) { try { cb(now); } catch (e) { console.error(e); } } };
});
await page.goto(html.startsWith("/") ? `file://${html}` : html, { waitUntil: "load", timeout: 90000 }).catch(e => errors.push(String(e)));
await page.waitForTimeout(1500);                                   // CDN modules, shader compile

const dt = 1000 / FPS;
for (let t = 0; t < START * 1000; t += dt) await page.evaluate(d => (window as any).__advance(d), dt);   // skip intro

const ff = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdin: "pipe" });
const N = Math.round(SECS * FPS), t0 = Date.now();
for (let i = 0; i < N; i++) {
  await page.evaluate(d => (window as any).__advance(d), dt);
  ff.stdin.write(await page.screenshot({ type: "jpeg", quality: 92 }));
  if (i % FPS === 0) process.stderr.write(`\r   ${i}/${N} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end(); await ff.exited; await browser.close();
process.stderr.write("\n");
if (errors.length) await Bun.write(out.replace(/\.mp4$/, ".errors.txt"), errors.join("\n"));
console.log(`   ${out} (${N} frames${errors.length ? `, ${errors.length} page errors` : ""})`);
