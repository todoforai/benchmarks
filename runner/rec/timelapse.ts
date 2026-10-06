#!/usr/bin/env bun
// timeline/ (every saved artifact version) -> labelled timelapse.mp4.
// One headless Chrome renders svg/html/png frames, system ffmpeg encodes.
//   bun timelapse.ts <rundir-in-sandbox> [label]
import { chromium } from "playwright-core";
import { readdirSync, mkdirSync, rmSync } from "node:fs";

const [dir, label = ""] = process.argv.slice(2);
const T = `${dir}/timeline`, F = `${dir}/frames`; rmSync(F, { recursive: true, force: true }); mkdirSync(F);
const files = readdirSync(T).filter(f => /\.(svg|html|png|jpe?g)$/.test(f)).sort();
if (!files.length) { console.log("   no frames"); process.exit(0); }

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
let n = 0;
for (const f of files) {
  const secs = parseInt(f, 10), name = f.replace(/^\d+_/, "");
  // Artifact in an iframe/img, fitted; label bar on top.
  const media = /\.html$/.test(f) ? `<iframe src="${f}" style="width:100%;height:100%;border:0"></iframe>`
                                  : `<img src="${f}" style="max-width:100%;max-height:calc(100vh - 44px);object-fit:contain;background:#fff">`;
  // about:blank can't load file:// → write the wrapper next to the artifact.
  await Bun.write(`${T}/.frame.html`, `<body style="margin:0;background:#111;height:100vh;display:grid;place-items:center">${media}
    <div style="position:fixed;top:0;left:0;right:0;padding:8px 14px;font:600 20px system-ui;color:#fff;background:#000a">
    ${esc(label)} &nbsp; ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")} &nbsp; <span style="opacity:.6">${esc(name)}</span></div></body>`);
  await page.goto(`file://${T}/.frame.html`, { waitUntil: "load" }).catch(() => {});
  await page.waitForTimeout(/\.html$/.test(f) ? 1500 : 200);
  await page.screenshot({ path: `${F}/${String(n++).padStart(4, "0")}.png` });
}
await browser.close(); rmSync(`${T}/.frame.html`, { force: true });
const ff = Bun.spawnSync(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "1", "-i", `${F}/%04d.png`,
  "-vf", "fps=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", `${dir}/timelapse.mp4`]);
rmSync(F, { recursive: true, force: true });
console.log(ff.success ? `   timelapse.mp4 (${n} frames)` : ff.stderr.toString());
