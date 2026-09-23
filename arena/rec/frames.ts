#!/usr/bin/env bun
// Deterministic frame-by-frame render of a GSAP page → mp4 (+ audio).
// Seek modes: GSAP page → `window.tl` (all motion on one timeline);
// otherwise SVG SMIL (svg.setCurrentTime) + CSS/WAAPI (document.getAnimations)
// — pass --secs for those. We pause, seek to i/fps, screenshot.
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
  const dur = await page.evaluate(() => {
    const w = window as any, tl = w.tl;
    if (tl?.seek) { tl.pause(0); w.__seek = (t: number) => tl.seek(t, false); return tl.duration(); }
    const svgs = [...document.querySelectorAll("svg")] as any[];
    if (document.documentElement instanceof SVGSVGElement && !svgs.includes(document.documentElement)) svgs.unshift(document.documentElement);
    w.__seek = (t: number) => {
      for (const s of svgs) { s.pauseAnimations?.(); s.setCurrentTime?.(t); }
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
    };
    return 0;
  });
  if (!dur && !o.secs) fail("no window.tl (GSAP) — pass --secs for SMIL/CSS animations");
  const secs = o.secs ? +o.secs : dur, n = Math.ceil(secs * FPS);

  const ff = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    ...(o.audio ? ["-i", o.audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"] : []),
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdin: "pipe" });
  for (let i = 0; i < n; i++) {
    // seek + force GSAP to render this exact time; wait a paint so CSS/WebGL catch up
    await page.evaluate(t => new Promise(r => { (window as any).__seek(t); requestAnimationFrame(() => requestAnimationFrame(r)); }), i / FPS);
    ff.stdin.write(await page.screenshot({ type: "jpeg", quality: 92 }));
    await ff.stdin.flush();
  }
  ff.stdin.end();
  if ((await ff.exited) !== 0) fail("ffmpeg");
  if (errors.length) await Bun.write(out.replace(/\.mp4$/, ".errors.txt"), errors.join("\n"));
  console.log(`   ${out} ${n} frames, ${secs.toFixed(2)}s${errors.length ? `, ${errors.length} page errors` : ""}`);
} finally { await browser.close(); }
