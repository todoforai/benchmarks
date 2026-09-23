#!/usr/bin/env bun
// Deterministic frame-by-frame render of a GSAP page → mp4 (+ audio).
// Contract: the page puts ALL motion on one GSAP timeline `window.tl` (no CSS
// animations / rAF loops outside GSAP). We pause it, seek to i/fps, screenshot.
// Not real-time, so frame drops/jank can't happen; the result is reproducible.
//   bun frames.ts <index.html> <out.mp4> [--fps 30] [--w 1920 --h 1080] [--audio music.mp3] [--secs N]
import { chromium } from "playwright-core";
import { parseArgs } from "node:util";

const { values: o, positionals: [html, out] } = parseArgs({ allowPositionals: true, options: {
  fps: { type: "string", default: "30" }, w: { type: "string", default: "1920" }, h: { type: "string", default: "1080" },
  audio: { type: "string" }, secs: { type: "string" } } });
if (!html || !out) { console.error("usage: frames.ts <index.html> <out.mp4> [...]"); process.exit(2); }
const [W, H, FPS] = [+o.w!, +o.h!, +o.fps!];
const fail = (m: string) => { console.error(`   FAIL ${m}`); process.exit(1); };

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"] });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(html.startsWith("/") ? `file://${html}` : html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const dur = await page.evaluate(() => { const tl = (window as any).tl; if (!tl?.seek) return -1; tl.pause(0); return tl.duration(); });
  if (dur < 0) fail("page has no window.tl (GSAP timeline)");
  const secs = o.secs ? +o.secs : dur, n = Math.ceil(secs * FPS);

  const ff = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    ...(o.audio ? ["-i", o.audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdin: "pipe" });
  for (let i = 0; i < n; i++) {
    // seek + force GSAP to render this exact time; wait a paint so CSS/WebGL catch up
    await page.evaluate(t => new Promise(r => { (window as any).tl.seek(t, false); requestAnimationFrame(() => requestAnimationFrame(r)); }), i / FPS);
    ff.stdin.write(await page.screenshot({ type: "jpeg", quality: 92 }));
    await ff.stdin.flush();
  }
  ff.stdin.end();
  if ((await ff.exited) !== 0) fail("ffmpeg");
  if (errors.length) await Bun.write(out.replace(/\.mp4$/, ".errors.txt"), errors.join("\n"));
  console.log(`   ${out} ${n} frames, ${secs.toFixed(2)}s${errors.length ? `, ${errors.length} page errors` : ""}`);
} finally { await browser.close(); }
