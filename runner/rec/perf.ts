#!/usr/bin/env bun
// Runtime cost of a generated page: how light / fast is it, not how pretty.
//   bun perf.ts <url> [--serve <root>] [--w 1280 --h 800] [--secs 6] [--gpu]
// Prints JSON: bytes, ttff_ms (nav → first WebGL draw), fps, frame_ms_p95, draw_calls/frame,
// triangles/frame, shaders, js_heap_mb, errors. --gpu uses the host GPU via Vulkan (default: SwiftShader).
import { chromium } from "playwright-core";
import { parseArgs } from "node:util";
import { statSync } from "node:fs";

const { values: o, positionals: [url] } = parseArgs({ allowPositionals: true, options: {
  serve: { type: "string" }, w: { type: "string", default: "1280" }, h: { type: "string", default: "800" },
  secs: { type: "string", default: "6" }, gpu: { type: "boolean", default: false } } });
if (!url) { console.error("usage: perf.ts <url|path> [--serve root]"); process.exit(2); }

let target = url, srv: ReturnType<typeof Bun.serve> | undefined, bytes = 0;
if (o.serve) {
  const root = o.serve.replace(/\/$/, "");
  try { bytes = statSync(root + url).size; } catch {}
  srv = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: async (r) => {
    const p = decodeURIComponent(new URL(r.url).pathname); if (p === "/favicon.ico") return new Response("", { status: 204 });
    const f = Bun.file(root + p); return (await f.exists()) ? new Response(f) : new Response("", { status: 404 }); } });
  target = `http://127.0.0.1:${srv.port}${url}`;
}
const gl = o.gpu ? ["--use-gl=angle", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"]   // headless: only the Vulkan backend reaches the NVIDIA GPU
                 : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome", args: ["--no-sandbox", ...gl] });
const page = await browser.newPage({ viewport: { width: +o.w!, height: +o.h! } });
const errors: string[] = [];
page.on("pageerror", e => errors.push(String(e))); page.on("console", m => m.type() === "error" && errors.push(m.text()));

// Hook before any script: count GL draws + triangles per frame, stamp the first draw.
await page.addInitScript(() => {
  const S = ((window as any).__perf = { firstDraw: 0, draws: 0, tris: 0, shaders: 0, frames: [] as number[] });
  const orig = HTMLCanvasElement.prototype.getContext;
  const tri = (mode: number, n: number) => mode === 4 ? n / 3 : mode === 5 || mode === 6 ? n - 2 : 0;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...a: any[]) {
    const ctx: any = orig.call(this, type, ...a);
    if (ctx && /webgl/.test(type) && !ctx.__hooked) {
      ctx.__hooked = true;
      for (const [fn, idx] of [["drawArrays", 2], ["drawElements", 1], ["drawArraysInstanced", 2], ["drawElementsInstanced", 1]] as const) {
        const f = ctx[fn]; if (!f) continue;
        ctx[fn] = function (...args: any[]) { S.draws++; S.tris += tri(args[0], args[idx]) * (fn.endsWith("Instanced") ? args[args.length - 1] : 1); S.firstDraw ||= performance.now(); return f.apply(this, args); };
      }
      const link = ctx.linkProgram; ctx.linkProgram = function (...args: any[]) { S.shaders++; return link.apply(this, args); };
    }
    return ctx;
  };
  let last = performance.now();
  const tick = (t: number) => { S.frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
});
await page.goto(target, { waitUntil: "load" }).catch(e => errors.push(String(e)));
await page.waitForTimeout(2000);                      // warm-up, not measured
const t0 = await page.evaluate(() => { const S = (window as any).__perf; S.frames = []; S.draws = 0; S.tris = 0; return performance.now(); });
await page.waitForTimeout(+o.secs! * 1000);
const r = await page.evaluate((t0) => {
  const S = (window as any).__perf, dt = performance.now() - t0, f = S.frames.slice().sort((a: number, b: number) => a - b), n = f.length || 1;
  const heap = (performance as any).memory?.usedJSHeapSize;
  return { ttff_ms: Math.round(S.firstDraw), fps: +(n / dt * 1000).toFixed(1), frame_ms_p50: +(f[Math.floor(n * 0.5)] ?? 0).toFixed(1), frame_ms_p95: +(f[Math.floor(n * 0.95)] ?? 0).toFixed(1),
    draw_calls: Math.round(S.draws / n), triangles: Math.round(S.tris / n), shaders: S.shaders, js_heap_mb: heap ? +(heap / 1048576).toFixed(1) : null };
}, t0);
await browser.close(); srv?.stop(true);
console.log(JSON.stringify({ bytes, gpu: !!o.gpu, ...r, errors: errors.length }));
