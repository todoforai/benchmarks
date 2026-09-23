// milk.js — drop impact on a shallow milk pool, 2D cross-section.
// Weakly compressible SPH, simulated on the half plane x>=0 (impact axis) and
// mirrored for drawing: exact left-right symmetry and half the particle count.
(function () {
'use strict';

// ---------------------------------------------------------------- state ----
var p = null;            // harness params
var pxPerM = 1, cx = 0, surfY = 0;
var n = 0, nAll = 0;     // real particles / real+ghost
var X, Y, VX, VY, RHO, PR, AX, AY, DR, TYP;   // TYP: 0 fluid 1 wall 2 ghost-fluid 3 ghost-wall
var SRC;                 // ghost -> source index
var d, h, hs, hs2, m0, rho0, cs, B, g, mu, sig, kcoh, alphaAV, dtMax;
var halfW, Hs, poolD, drawR, spongeX;
var cellStart, order, cnt, gnx, gny, gminx, gminy, gcell;

// --------------------------------------------------------------- kernel ----
var kW = 0, kF = 0;      // W = kW*(1-q/2)^4*(1+2q) ; gradW_i = kF*(1-q/2)^3 * (ri-rj)
function setKernel() { kW = 7 / (4 * Math.PI * h * h); kF = -5 * kW / (h * h); }

// ---------------------------------------------------------------- reset ----
function reset(par) {
  p = par;
  pxPerM = p.pxPerMm * 1000; cx = p.cx; surfY = p.surfaceY;
  rho0 = p.rho_kgm3 || 1000;
  g = (p.g_mps2 == null ? 9.81 : p.g_mps2);
  mu = (p.mu_mPas == null ? 2 : p.mu_mPas) * 1e-3;
  sig = (p.sigma_Npm == null ? 0.05 : p.sigma_Npm);
  var V = Math.abs(p.impactV_mps) || 0.1;
  var R = p.dropD_mm * 5e-4;                 // drop radius [m]
  poolD = p.poolDepth_mm * 1e-3;

  // simulated half width / depth (the rest of the pool is drawn as static milk)
  // half-domain wide enough to cover the view; outer strip is a damping sponge
  halfW = Math.max(6 * R, Math.min(p.w * 0.5 / pxPerM, 0.025));
  Hs = Math.min(poolD, 0.006);

  // particle spacing: resolve the drop and the pool, keep the count bounded
  d = Math.min(R / 6, Hs / 5);
  var Nest = (halfW * Hs + 0.5 * Math.PI * R * R) / (d * d);
  if (Nest > 3500) d *= Math.sqrt(Nest / 3500);
  var nk = Math.max(3, Math.floor(Hs / d + 1e-9)); Hs = nk * d;
  var nc = Math.max(8, Math.round(halfW / d));     halfW = nc * d;

  h = 1.3 * d; hs = 2 * h; hs2 = hs * hs; setKernel();
  m0 = rho0 * d * d;
  cs = Math.max(10 * V, 8 * Math.sqrt(2 * g * Math.max(R, Hs)), 15);
  B = rho0 * cs * cs / 7;
  alphaAV = 0.06;
  kcoh = 1.6 * sig / (rho0 * d * d);          // pairwise cohesion -> surface tension
  dtMax = 0.3 * h / (cs + 3 * V);
  drawR = 0.75 * d * pxPerM;
  spongeX = halfW - Math.max(3 * d, 0.2 * halfW);

  // ---- particles ----
  var px = [], py = [], tp = [];
  for (var i = 0; i < nc; i++) for (var k = 0; k < nk; k++) {   // pool (half)
    px.push((i + 0.5) * d); py.push(-Hs + (k + 0.5) * d); tp.push(0);
  }
  var mr = Math.ceil(2 * R / d) + 2;                            // drop (half)
  for (i = 0; i < mr; i++) for (k = 0; k < mr; k++) {
    var qx = (i + 0.5) * d, qy = (k + 0.5) * d;
    if (qx * qx + (qy - R) * (qy - R) <= R * R) { px.push(qx); py.push(qy); tp.push(0); }
  }
  var nFluid = px.length;
  var wallTop = Math.min(0.020, Math.max(6 * R, (surfY - 2) / pxPerM));
  for (k = 0; k < 3; k++) {                                     // floor
    for (i = 0; i < nc + 4; i++) { px.push((i + 0.5) * d); py.push(-Hs - (k + 0.5) * d); tp.push(1); }
  }
  for (k = 0; k < 3; k++) {                                     // side wall
    for (i = 0; i < Math.round(wallTop / d) + 1; i++) {
      px.push(halfW + (k + 0.5) * d); py.push(-Hs + (i + 0.5) * d); tp.push(1);
    }
  }
  n = px.length;
  var cap = 2 * n + 8;
  X = new Float64Array(cap); Y = new Float64Array(cap);
  VX = new Float64Array(cap); VY = new Float64Array(cap);
  RHO = new Float64Array(cap); PR = new Float64Array(cap);
  AX = new Float64Array(cap); AY = new Float64Array(cap); DR = new Float64Array(cap);
  TYP = new Uint8Array(cap); SRC = new Int32Array(cap);
  order = new Int32Array(cap);
  for (i = 0; i < n; i++) {
    X[i] = px[i]; Y[i] = py[i]; TYP[i] = tp[i]; RHO[i] = rho0;
    VX[i] = 0; VY[i] = (i < nFluid && py[i] > 0) ? -V : 0;      // only the drop moves
  }
  cellStart = null; gnx = gny = 0;
  return;
}

// --------------------------------------------------------------- ghosts ----
function makeGhosts() {
  nAll = n;
  for (var i = 0; i < n; i++) {
    if (X[i] < hs) {
      var j = nAll++;
      X[j] = -X[i]; Y[j] = Y[i]; VX[j] = -VX[i]; VY[j] = VY[i];
      RHO[j] = RHO[i]; TYP[j] = TYP[i] + 2; SRC[j] = i;
    }
  }
}

// ----------------------------------------------------------------- grid ----
function buildGrid() {
  var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, i;
  for (i = 0; i < nAll; i++) {
    if (X[i] < minx) minx = X[i]; if (X[i] > maxx) maxx = X[i];
    if (Y[i] < miny) miny = Y[i]; if (Y[i] > maxy) maxy = Y[i];
  }
  gminx = minx - 1e-9; gminy = miny - 1e-9; gcell = hs;
  gnx = Math.floor((maxx - gminx) / gcell) + 1;
  gny = Math.floor((maxy - gminy) / gcell) + 1;
  var nCell = gnx * gny;
  if (!cellStart || cellStart.length < nCell + 1) { cellStart = new Int32Array(nCell + 1); cnt = new Int32Array(nCell + 1); }
  for (i = 0; i <= nCell; i++) cnt[i] = 0;
  for (i = 0; i < nAll; i++) {
    var c = (((Y[i] - gminy) / gcell) | 0) * gnx + (((X[i] - gminx) / gcell) | 0);
    cnt[c + 1]++;
  }
  cellStart[0] = 0;
  for (i = 0; i < nCell; i++) cellStart[i + 1] = cellStart[i] + cnt[i + 1];
  for (i = 0; i <= nCell; i++) cnt[i] = cellStart[i];
  for (i = 0; i < nAll; i++) {
    var c2 = (((Y[i] - gminy) / gcell) | 0) * gnx + (((X[i] - gminx) / gcell) | 0);
    order[cnt[c2]++] = i;
  }
}

// -------------------------------------------------------------- physics ----
function interact(i, j) {
  var dx = X[i] - X[j], dy = Y[i] - Y[j];
  var r2 = dx * dx + dy * dy;
  if (r2 >= hs2 || r2 === 0) return;
  var ti = TYP[i], tj = TYP[j];
  var wi = ti & 1, wj = tj & 1;               // wall flags
  if (wi && wj) return;
  var gi = ti > 1, gj = tj > 1;               // ghost flags
  if (gi && gj) return;

  var r = Math.sqrt(r2), q = r / h, t = 1 - 0.5 * q;
  var F = kF * t * t * t;                     // gradW_i = F*(dx,dy)
  var ri = RHO[i], rj = RHO[j];
  var vdx = VX[i] - VX[j], vdy = VY[i] - VY[j];
  var vdotr = vdx * dx + vdy * dy;
  var eps = 0.01 * h * h;

  // pressure + artificial viscosity
  var bra = PR[i] / (ri * ri) + PR[j] / (rj * rj);
  if (vdotr < 0) bra += -alphaAV * cs * (h * vdotr / (r2 + eps)) * 2 / (ri + rj);
  var ca = -m0 * bra * F;
  // laminar viscosity (Morris)
  if (!(wi || wj)) {
    var cv = m0 * (2 * mu) * (F * r2) / (ri * rj * (r2 + eps));
    // cohesion (surface tension)
    var s = 4 * r * (hs - r) / hs2, C = s * s * s;
    var cc = -kcoh * C / r;
    if (!gi) { AX[i] += ca * dx + cv * vdx + cc * dx; AY[i] += ca * dy + cv * vdy + cc * dy; }
    if (!gj) { AX[j] -= ca * dx + cv * vdx + cc * dx; AY[j] -= ca * dy + cv * vdy + cc * dy; }
  } else {
    if (!gi && !wi) { AX[i] += ca * dx; AY[i] += ca * dy; }
    if (!gj && !wj) { AX[j] -= ca * dx; AY[j] -= ca * dy; }
  }
  // continuity + delta-SPH density diffusion
  var dcon = m0 * vdotr * F;
  var dif = 0.1 * hs * cs * 2 * (ri - rj) * F * m0;
  if (!gi) DR[i] += dcon + dif / rj;
  if (!gj) DR[j] += dcon - dif / ri;
}

function forces() {
  var i;
  makeGhosts();
  for (i = 0; i < nAll; i++) {
    var t = RHO[i] / rho0, t3 = t * t * t, pr = B * (t3 * t3 * t - 1);
    PR[i] = pr > 0 ? pr : 0;
  }
  for (i = 0; i < n; i++) { AX[i] = 0; AY[i] = 0; DR[i] = 0; }
  buildGrid();
  for (var cy = 0; cy < gny; cy++) for (var cxx = 0; cxx < gnx; cxx++) {
    var c = cy * gnx + cxx, a0 = cellStart[c], a1 = cellStart[c + 1];
    if (a0 === a1) continue;
    for (var a = a0; a < a1; a++) {
      var ii = order[a];
      for (var b = a + 1; b < a1; b++) interact(ii, order[b]);
    }
    // half stencil: E, SW, S, SE
    for (var k = 0; k < 4; k++) {
      var nxx = cxx + (k === 0 ? 1 : k === 1 ? -1 : k === 2 ? 0 : 1);
      var nyy = cy + (k === 0 ? 0 : 1);
      if (nxx < 0 || nxx >= gnx || nyy >= gny) continue;
      var c2 = nyy * gnx + nxx, b0 = cellStart[c2], b1 = cellStart[c2 + 1];
      for (a = a0; a < a1; a++) { var i2 = order[a]; for (var bb = b0; bb < b1; bb++) interact(i2, order[bb]); }
    }
  }
}

function substep(dt) {
  forces();
  var vmax = 40;
  for (var i = 0; i < n; i++) {
    RHO[i] += DR[i] * dt;
    if (TYP[i] & 1) { if (RHO[i] < rho0) RHO[i] = rho0; continue; }
    if (RHO[i] < 0.5 * rho0) RHO[i] = 0.5 * rho0;
    var vx = VX[i] + AX[i] * dt, vy = VY[i] + (AY[i] - g) * dt;
    if (vx > vmax) vx = vmax; else if (vx < -vmax) vx = -vmax;
    if (vy > vmax) vy = vmax; else if (vy < -vmax) vy = -vmax;
    VX[i] = vx; VY[i] = vy;
    X[i] += vx * dt; Y[i] += vy * dt;
    if (X[i] < 0) { X[i] = -X[i]; VX[i] = -VX[i]; }      // symmetry plane
    if (X[i] > spongeX) {                                // absorb outgoing waves
      var f = 1 - 3 * dt * (X[i] - spongeX) / (halfW - spongeX);
      if (f < 0) f = 0;
      VX[i] *= f; VY[i] *= f;
    }
  }
}

function step(dt) {
  var ns = Math.ceil(dt / dtMax);
  if (ns < 1) ns = 1; if (ns > 60) ns = 60;
  var sdt = dt / ns;
  for (var s = 0; s < ns; s++) substep(sdt);
}

// ----------------------------------------------------------------- draw ----
function draw(ctx) {
  ctx.save();
  ctx.fillStyle = '#f4f2ec';
  // undisturbed pool outside / below the simulated box (constant area)
  var xr = cx + (halfW - d) * pxPerM, xl = cx - (halfW - d) * pxPerM;
  var yTop = surfY, yBot = surfY + poolD * pxPerM;
  if (xr < p.w) ctx.fillRect(xr, yTop, p.w - xr, yBot - yTop);
  if (xl > 0) ctx.fillRect(0, yTop, xl, yBot - yTop);
  if (poolD > Hs) {
    var yd = surfY + (Hs - 0.5 * d) * pxPerM;
    ctx.fillRect(xl, yd, xr - xl, yBot - yd);
  }
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    if (TYP[i] & 1) continue;
    var sx = X[i] * pxPerM, sy = surfY - Y[i] * pxPerM;
    ctx.moveTo(cx + sx + drawR, sy); ctx.arc(cx + sx, sy, drawR, 0, 6.283185307179586);
    ctx.moveTo(cx - sx + drawR, sy); ctx.arc(cx - sx, sy, drawR, 0, 6.283185307179586);
  }
  ctx.fill();
  ctx.restore();
}

window.BENCH = { reset: reset, step: step, draw: draw };
})();
