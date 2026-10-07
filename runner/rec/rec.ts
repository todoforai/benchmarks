#!/usr/bin/env bun
// Headless page recording: CDP screencast -> system ffmpeg (no X/Xvfb, no
// Playwright ffmpeg download). Frames are resampled to a constant fps.
//   bun rec.ts <url> <out.mp4> [--secs 12] [--w 1440 --h 900] [--script scroll|idle|game] [--shot hero.png]
import { chromium } from "playwright-core";
import { parseArgs } from "node:util";

const { values: o, positionals: [url, out] } = parseArgs({ allowPositionals: true, options: {
  secs: { type: "string", default: "12" }, w: { type: "string", default: "1440" }, h: { type: "string", default: "900" },
  fps: { type: "string", default: "30" }, script: { type: "string", default: "scroll" }, shot: { type: "string" },
  serve: { type: "string" } } });   // --serve <root>: static http server so absolute paths (/vendor/three@…) resolve; url is then a path
if (!url || !out) { console.error("usage: rec.ts <url> <out.mp4> [...]"); process.exit(2); }
let target = url, srv: ReturnType<typeof Bun.serve> | undefined;
if (o.serve) {
  const root = o.serve.replace(/\/$/, "");
  srv = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: async (r) => {
    const p = decodeURIComponent(new URL(r.url).pathname); if (p === "/favicon.ico") return new Response("", { status: 204 });
    const f = Bun.file(root + p); return (await f.exists()) ? new Response(f) : new Response("", { status: 404 }); } });
  target = `http://127.0.0.1:${srv.port}${url}`;
}
const [W, H, FPS, SECS] = [+o.w!, +o.h!, +o.fps!, +o.secs!];

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors: string[] = [];
page.on("pageerror", e => errors.push(String(e))); page.on("console", m => m.type() === "error" && errors.push(m.text()));
await page.goto(target, { waitUntil: "load" }).catch(e => errors.push(String(e)));
await page.waitForTimeout(1500);
if (o.shot) await page.screenshot({ path: o.shot });

const ff = Bun.spawn(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", out], { stdin: "pipe" });
const cdp = await page.context().newCDPSession(page);
let last: Buffer | null = null;
cdp.on("Page.screencastFrame", f => { last = Buffer.from(f.data, "base64"); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 85, maxWidth: W, maxHeight: H });
const tick = setInterval(() => { if (last) ff.stdin.write(last); }, 1000 / FPS);

const t0 = Date.now(), left = () => SECS * 1000 - (Date.now() - t0);
if (o.script === "idle") {           // just watch (attract mode / intro)
  await new Promise(r => setTimeout(r, left()));
} else if (o.script === "hover") {          // 4 s idle, then the pointer glides between points and rests 1.5 s on each
  await page.waitForTimeout(Math.min(4000, left()));
  const pts = [[.5, .5], [.35, .4], [.62, .38], [.42, .62], [.66, .6], [.28, .55], [.55, .28], [.75, .48], [.5, .72]];
  await page.mouse.move(W / 2, H / 2);
  for (let i = 0; left() > 500; i++) {
    const [x, y] = pts[i % pts.length];
    await page.mouse.move(x * W, y * H, { steps: 8 });
    await page.waitForTimeout(Math.min(1500, Math.max(0, left())));
  }
} else if (o.script === "game") {           // click to start / pointer lock, walk, turn, shoot
  await page.mouse.click(W / 2, H / 2).catch(() => {});
  const keys = ["w", "w", "a", "w", "d", "w", "s", "w"];
  for (let i = 0; left() > 500; i++) {
    const k = keys[i % keys.length]; await page.keyboard.down(k);
    await page.mouse.move(W / 2 + (i % 2 ? 120 : -120), H / 2, { steps: 10 }); await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(700); await page.keyboard.up(k);
  }
} else {                             // smooth scroll through the page
  while (left() > 0) { await page.mouse.wheel(0, 120); await page.waitForTimeout(100); }
}
clearInterval(tick); await cdp.send("Page.stopScreencast").catch(() => {});
ff.stdin.end(); await ff.exited; await browser.close(); srv?.stop(true);
if (errors.length) await Bun.write(out.replace(/\.mp4$/, ".errors.txt"), errors.join("\n"));
console.log(`   ${out}${errors.length ? ` (${errors.length} page errors)` : ""}`);
