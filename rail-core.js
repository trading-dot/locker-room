// rail-core.js — dipakai index.html (tampilan toko) dan admin.html (preview).
// VERSI 3D BENERAN (WebGL2): baju dibentuk jadi mesh bervolume dari siluet gambar pola (depan + belakang),
// lalu diberi lipatan kain, pencahayaan & gantungan 3D. Tidak ada lagi "kardus tumpuk lapisan".
//
// Gambar yang didukung (otomatis dideteksi dari rasio):
//   • LEMBAR POLA  1600x800  = 2 kotak 800x800:  DEPAN | BELAKANG          (disarankan)
//   • ATLAS LAMA   3200x800  = 4 kotak:          DEPAN | KANAN | BELAKANG | KIRI  (kotak kanan/kiri diabaikan, sisi dibuat 3D)
// API Turntable tidak berubah (set, rotateTo, rotateBy, enableDrag, angle, view, onturn, dragEnabled, draw).
export const TILE_W = 800, TILE_H = 800, VIEWS = ['depan', 'kanan', 'belakang', 'kiri'];

// Jenis barang: skala bawaan, geser vertikal (%), model gantungan, dan ketebalan (depth = total tebal di dada, satuan px kotak 800).
export const TIPE = {
  'kaos':         { label: 'Kaos lengan pendek',       scale: 1,    y: 0, hanger: 'hanger', depth: 50 },
  'kaos-panjang': { label: 'Kaos lengan panjang',      scale: 1,    y: 0, hanger: 'hanger', depth: 50 },
  hoodie:         { label: 'Hoodie / Jaket',           scale: 1.04, y: 0, hanger: 'hanger', depth: 78 },
  aksesoris:      { label: 'Aksesoris (tas/topi/dll)', scale: 0.8,  y: 8, hanger: 'hook',   depth: 44 },
};

const S = 800;            // ukuran kotak (px)
const HEAD = 80;          // ruang di atas kotak untuk kait gantungan (satuan kotak) = 10% lebar, dibaca juga oleh CSS (.1 * --W)
const GRID = 200;         // resolusi mesh per sisi (200x200 sel)
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ============================== matriks (kolom-major) ============================== */
const mat = {
  persp(f, a, n, fa) { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]); },
  look(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  id() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  trans(x, y, z) { const m = mat.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(s) { const m = mat.id(); m[0] = m[5] = m[10] = s; return m; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a), m = mat.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
};

/* ============================== shader ============================== */
// Lipatan kain prosedural (dipakai di vertex & fragment shader supaya konsisten).
// Lipatan menjuntai dari gantungan (radial), gelombang lebar, dan kerutan halus. p = koordinat dunia (y ke atas).
const SSTEP = `float sstepL(float a, float b, float v){ float t = clamp((v - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }`;
const FOLD = `
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fold(vec2 p, float side, vec2 ap){
  float s = side * 7.31;
  vec2 w = vec2(vn(p * .008 + s), vn(p * .008 + s + 9.1)) - .5;                 // warp ringan: lipatan sedikit melengkung
  vec2 q = (p + w * 26.) - ap; float r = length(q) + 1.; float th = atan(q.x, -q.y);
  float c1 = vn(vec2(th * 7.0 + s, r * .0022));
  float ridge = 1. - abs(2. * c1 - 1.);
  float f = (ridge * ridge - .36) * .95 + (vn(vec2(th * 15. + s * 1.7, r * .0035 + 3.)) - .5) * .50;   // lipatan menjuntai dari gantungan
  f *= sstepL(36., 220., r) * (1. - .42 * sstepL(420., 780., r));
  float dn = sstepL(0., 260., ap.y - p.y);
  float cur = vn(vec2(p.x * .020 + s + w.x * 2., p.y * .0016));
  f += (1. - abs(2. * cur - 1.) - .5) * .55 * dn;                                 // tirai vertikal di badan
  f += (vn(p * vec2(.011, .0055) + s) - .5) * .60;                                // gelombang lebar
  f += (vn(p * vec2(.028, .070) + s * 2.) - .5) * .30 * sstepL(180., 520., ap.y - p.y);   // kerutan horizontal di bawah
  f += (vn(p * vec2(.07, .05) + s * 3.) - .5) * .16;
  return f;
}`;

const VS_SHIRT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv; layout(location=3) in float aEdge;
uniform mat4 uVP, uModel; uniform float uSide, uLag, uTopY, uAmp; uniform vec2 uApex;
out vec3 vNo; out vec3 vPo; out vec3 vWp; out vec2 vUv; out float vEdge;
${SSTEP}
${FOLD}
void main(){
  vec3 p = aPos, n = aNrm;
  float f = fold(p.xy, uSide, uApex);
  p.z += uSide * f * uAmp * sstepL(0., 18., aEdge);
  float k = clamp((uTopY - p.y) / 640., 0., 1.), la = radians(uLag) * k * k, c = cos(la), s = sin(la);
  p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); n = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
  vec4 w = uModel * vec4(p, 1.);
  vWp = w.xyz; vNo = n; vPo = aPos; vUv = aUv; vEdge = aEdge;
  gl_Position = uVP * w;
}`;

const FS_SHIRT = `#version 300 es
precision highp float;
in vec3 vNo; in vec3 vPo; in vec3 vWp; in vec2 vUv; in float vEdge;
uniform sampler2D uTex; uniform mat4 uModel; uniform vec3 uEye; uniform float uSide, uAmp; uniform vec2 uApex;
out vec4 o;
${SSTEP}
${FOLD}
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec4 t = texture(uTex, vUv);
  if (t.a < .1) discard;
  vec3 alb = lin(clamp(t.rgb / t.a, 0., 1.)); alb = alb * .92 + .007;   // hitam tidak 100% pekat → lipatan tetap terbaca
  vec3 No = normalize(vNo);
  vec2 p = vPo.xy; float e = 1.6;
  float fv = fold(p, uSide, uApex);
  vec2 g = vec2(fold(p + vec2(e, 0.), uSide, uApex) - fold(p - vec2(e, 0.), uSide, uApex), fold(p + vec2(0., e), uSide, uApex) - fold(p - vec2(0., e), uSide, uApex)) / (2. * e);
  float fade = sstepL(0., 18., vEdge);
  No = normalize(No + uSide * vec3(-g * uAmp * 1.15 * fade, 0.));
  mat3 R = mat3(uModel);
  vec3 Nw = normalize(R * No), Ng = normalize(R * normalize(vNo)), V = normalize(uEye - vWp);
  bool inside = dot(Ng, V) < 0.;
  if (inside) { Nw = -Nw; alb *= .5; }
  vec3 L1 = normalize(vec3(-.55, .75, .62)), L2 = normalize(vec3(.85, .1, .5)), L3 = normalize(vec3(.25, .45, -.85));
  float d1 = clamp((dot(Nw, L1) + .5) / 1.5, 0., 1.), d2 = clamp((dot(Nw, L2) + .3) / 1.3, 0., 1.), d3 = clamp(dot(Nw, L3) * .5 + .5, 0., 1.);
  vec3 hemi = mix(vec3(.26, .25, .25), vec3(.60, .62, .68), Nw.y * .5 + .5);
  float ao = mix(.58, 1., sstepL(0., 46., vEdge)) * (inside ? .8 : 1.);
  float cav = clamp(1. + .75 * fv * fade, .55, 1.4);
  vec3 diff = alb * (hemi * .95 + vec3(1., .96, .9) * d1 * 1.05 + vec3(.55, .62, .8) * d2 * .38 + vec3(.7, .76, .95) * d3 * .30);
  vec3 H = normalize(L1 + V);
  float sp = pow(max(dot(Nw, H), 0.), 14.) * .075;
  float fr = pow(1. - max(dot(Nw, V), 0.), 3.2);
  vec3 sheen = vec3(.30, .31, .35) * fr * (.30 + .70 * d1) * .42 + vec3(.5, .5, .55) * sp * (.4 + .6 * clamp(fv * 2. + .5, 0., 1.));
  vec3 col = (diff * cav + sheen) * ao;
  col = 1. - exp(-col * 1.35);
  col = pow(col, vec3(1. / 2.2));
  o = vec4(col, sstepL(.25, .75, t.a));
}`;

const VS_HANG = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
uniform mat4 uVP, uModel; out vec3 vN; out vec3 vW;
void main(){ vec4 w = uModel * vec4(aPos, 1.); vW = w.xyz; vN = mat3(uModel) * aNrm; gl_Position = uVP * w; }`;
const FS_HANG = `#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; uniform vec3 uEye; out vec4 o;
void main(){
  vec3 N = normalize(vN), V = normalize(uEye - vW), L = normalize(vec3(-.55, .75, .62)), L2 = normalize(vec3(.85, .1, .5));
  vec3 base = pow(vec3(.50, .33, .19), vec3(2.2));
  float d = clamp(dot(N, L) * .5 + .5, 0., 1.), d2 = clamp(dot(N, L2) * .5 + .5, 0., 1.);
  float sp = pow(max(dot(N, normalize(L + V)), 0.), 40.) * .35;
  vec3 col = base * (.32 + 1.0 * d * d + .25 * d2) + vec3(.6, .5, .4) * sp;
  col = 1. - exp(-col * 1.4); o = vec4(pow(col, vec3(1. / 2.2)), 1.);
}`;

/* ============================== WebGL bersama (1 konteks untuk semua baju) ============================== */
let GLS = null;
const registry = new Set();
function compile(gl, vs, fs) {
  const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}
function getGL() {
  if (GLS) return GLS.ok ? GLS : null;
  GLS = { ok: false };
  try {
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    Object.assign(GLS, { cv, gl, shirt: compile(gl, VS_SHIRT, FS_SHIRT), hang: compile(gl, VS_HANG, FS_HANG), aniso: gl.getExtension('EXT_texture_filter_anisotropic'), ok: true });
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); GLS.ok = false; });
    cv.addEventListener('webglcontextrestored', () => { GLS = null; registry.forEach(t => t.reinit()); });
  } catch (e) { console.warn('WebGL2 tidak tersedia, pakai tampilan cadangan', e); GLS = { ok: false }; return null; }
  return GLS;
}

/* ============================== geometri dari siluet ============================== */
function dt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    for (;;) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k] && k > 0) k--; else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
const SR = 400, K = S / SR;                                     // geometri dihitung di 400x400 (cukup, 4x lebih cepat); hasil dikonversi ke satuan 800
function distToSource(src, n) {                                 // jarak Euclid ke piksel sumber (src=1), eksak, O(n)
  const INF = 1e12, out = new Float64Array(n * n), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let i = 0; i < n * n; i++) out[i] = src[i] ? 0 : INF;
  for (let x = 0; x < n; x++) { for (let y = 0; y < n; y++) f[y] = out[y * n + x]; dt1(f, n, d, v, z); for (let y = 0; y < n; y++) out[y * n + x] = d[y]; }
  for (let y = 0; y < n; y++) { for (let x = 0; x < n; x++) f[x] = out[y * n + x]; dt1(f, n, d, v, z); for (let x = 0; x < n; x++) out[y * n + x] = d[x]; }
  const r = new Float32Array(n * n); for (let i = 0; i < n * n; i++) r[i] = Math.sqrt(out[i]); return r;
}
function boxBlur(a, rad, n) {                                   // blur kotak 2 arah (halusin tangga piksel di tepi)
  const t = new Float32Array(n * n), o = new Float32Array(n * n), w = 2 * rad + 1, c = i => clamp(i, 0, n - 1);
  for (let y = 0; y < n; y++) { let s = 0; for (let x = -rad; x <= rad; x++) s += a[y * n + c(x)]; for (let x = 0; x < n; x++) { t[y * n + x] = s / w; s += a[y * n + c(x + rad + 1)] - a[y * n + c(x - rad)]; } }
  for (let x = 0; x < n; x++) { let s = 0; for (let y = -rad; y <= rad; y++) s += t[c(y) * n + x]; for (let y = 0; y < n; y++) { o[y * n + x] = s / w; s += t[c(y + rad + 1) * n + x] - t[c(y - rad) * n + x]; } }
  return o;
}
function down(alpha) {                                          // 800x800 → 400x400 (ambil max 2x2 supaya garis tipis tidak hilang)
  const o = new Uint8Array(SR * SR);
  for (let y = 0; y < SR; y++) for (let x = 0; x < SR; x++) { const i = y * K * S + x * K; o[y * SR + x] = Math.max(alpha[i], alpha[i + 1], alpha[i + S], alpha[i + S + 1]); }
  return o;
}

const ZE = 2.5, ZW = 6.5;   // tebal minimum di tepi & setengah tebal dinding jahitan
// Satu sisi baju (depan / belakang) → mesh bervolume. a = alpha 400x400, side = +1 depan / -1 belakang. Satuan keluaran = kotak 800.
function panelMesh(a, side, H0, R) {
  const n = SR, mask = new Uint8Array(n * n), ext = new Uint8Array(n * n), stack = new Int32Array(n * n); let sp = 0;
  for (let i = 0; i < n * n; i++) mask[i] = a[i] >= 110 ? 1 : 0;
  const push = i => { if (!mask[i] && !ext[i]) { ext[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < n; x++) { push(x); push((n - 1) * n + x); } for (let y = 0; y < n; y++) { push(y * n); push(y * n + n - 1); }
  while (sp) { const i = stack[--sp], x = i % n, y = (i / n) | 0; if (x > 0) push(i - 1); if (x < n - 1) push(i + 1); if (y > 0) push(i - n); if (y < n - 1) push(i + n); }
  let x0 = n, x1 = 0, y0 = n, y1 = 0; const top4 = new Int16Array(n).fill(-1);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!ext[y * n + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (top4[x] < 0) top4[x] = y; }
  if (x1 <= x0 || y1 <= y0) return null;
  const d = boxBlur(distToSource(ext, n), 2, n), z = new Float32Array(n * n);   // d dalam piksel-400
  for (let y = 0; y < n; y++) {
    const tt = clamp((y - y0) / (y1 - y0), 0, 1), H = H0 * (.58 + .42 * Math.pow(1 - tt, .8));       // dada lebih tebal, ujung bawah lebih tipis
    for (let x = 0; x < n; x++) { const dd = d[y * n + x] * K; if (dd <= 0) { z[y * n + x] = ZE; continue; } const u = Math.min(dd / R, 1); z[y * n + x] = ZE + (H - ZE) * Math.sqrt(1 - (1 - u) * (1 - u)) * (1 + .20 * sstep(R, R * 5, dd)); }
  }
  // sel yang dipakai (area siluet + 1 sel margin)
  const C = n / GRID, use = new Uint8Array(GRID * GRID);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!ext[y * n + x]) use[Math.min(GRID - 1, (y / C) | 0) * GRID + Math.min(GRID - 1, (x / C) | 0)] = 1;
  const use2 = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (use[j * GRID + i]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const aa = i + di, b = j + dj; if (aa >= 0 && b >= 0 && aa < GRID && b < GRID) use2[b * GRID + aa] = 1; }
  const N1 = GRID + 1, map = new Int32Array(N1 * N1).fill(-1); let nv = 0;
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (use2[j * GRID + i]) for (const [aa, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) if (map[b * N1 + aa] < 0) map[b * N1 + aa] = nv++;
  const vb = new Float32Array(nv * 9), ib = []; const zs = (x, y) => z[clamp(y, 0, n - 1) * n + clamp(x, 0, n - 1)];
  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) {
    const m = map[j * N1 + i]; if (m < 0) continue;
    const px = Math.min(n - 1, i * C), py = Math.min(n - 1, j * C), zz = z[py * n + px], st = 2;
    const dzx = (zs(px + st, py) - zs(px - st, py)) / (2 * st * K), dzy = (zs(px, py + st) - zs(px, py - st)) / (2 * st * K);   // turunan per satuan-800
    let nx, ny, nz;
    if (side > 0) { nx = -dzx; ny = dzy; nz = 1; } else { nx = dzx; ny = dzy; nz = -1; }
    const l = Math.hypot(nx, ny, nz), o = m * 9, X = i * C * K, Y = j * C * K;
    vb[o] = side > 0 ? X - 400 : 400 - X; vb[o + 1] = 400 - Y; vb[o + 2] = side * zz;
    vb[o + 3] = nx / l; vb[o + 4] = ny / l; vb[o + 5] = nz / l;
    vb[o + 6] = (side > 0 ? 0 : .5) + X / S * .5; vb[o + 7] = Y / S; vb[o + 8] = d[py * n + px] * K;
  }
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (use2[j * GRID + i]) { const aa = map[j * N1 + i], b = map[j * N1 + i + 1], c = map[(j + 1) * N1 + i], e = map[(j + 1) * N1 + i + 1]; ib.push(aa, b, c, b, e, c); }
  const wv = [], wi = [];
  if (side > 0) {                                                   // dinding sepanjang tepi siluet: menutup celah depan-belakang saat tampak samping
    const quad = (xa, ya, xb, yb, nx, ny, u, v) => { const b = wv.length / 9; for (const [X, Y] of [[xa, ya], [xb, yb]]) for (const zz of [-ZW, ZW]) wv.push(X * K - 400, 400 - Y * K, zz, nx, ny, 0, u, v, 0); wi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); };
    const dd = (x, y) => d[clamp(y, 0, n - 1) * n + clamp(x, 0, n - 1)];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!ext[y * n + x]) {
      const ex = x === 0 || ext[y * n + x - 1], er = x === n - 1 || ext[y * n + x + 1], et = y === 0 || ext[(y - 1) * n + x], eb = y === n - 1 || ext[(y + 1) * n + x];
      if (!(ex || er || et || eb)) continue;
      let gx = (dd(x + 2, y) - dd(x - 2, y)) / 4, gy = (dd(x, y + 2) - dd(x, y - 2)) / 4; const gl = Math.hypot(gx, gy);
      if (gl < 1e-3) { gx = ex ? 1 : er ? -1 : 0; gy = et ? 1 : eb ? -1 : 0; } else { gx /= gl; gy /= gl; }
      const nx = -gx, ny = gy, u = clamp(x + gx * 1.5 + .5, 0, n - 1) / n * .5, v = clamp(y + gy * 1.5 + .5, 0, n - 1) / n;   // normal halus keluar; warna diambil ±3px ke dalam (lewati garis tepi)
      if (ex) quad(x, y, x, y + 1, nx, ny, u, v);
      if (er) quad(x + 1, y, x + 1, y + 1, nx, ny, u, v);
      if (et) quad(x, y, x + 1, y, nx, ny, u, v);
      if (eb) quad(x, y + 1, x + 1, y + 1, nx, ny, u, v);
    }
  }
  const top = new Int16Array(S); for (let x = 0; x < S; x++) { const t = top4[Math.min(n - 1, (x / K) | 0)]; top[x] = t < 0 ? -1 : t * K; }
  return { vb, ib: new Uint32Array(ib), wvb: new Float32Array(wv), wib: new Uint32Array(wi), top, x0: x0 * K, x1: x1 * K, y0: y0 * K, y1: y1 * K };
}
function mirrorPanel(fr) {                                       // sisi belakang = cermin sisi depan (siluet sama) → tidak perlu hitung ulang
  const vb = new Float32Array(fr.vb);
  for (let o = 0; o < vb.length; o += 9) { vb[o] = -vb[o]; vb[o + 2] = -vb[o + 2]; vb[o + 3] = -vb[o + 3]; vb[o + 5] = -vb[o + 5]; vb[o + 6] += .5; }
  return { ...fr, vb };
}

// antrean build: satu per satu, supaya layar tidak macet saat banyak baju dimuat
const Q = []; let qBusy = false;
function enqueue(fn) { Q.push(fn); if (!qBusy) { qBusy = true; setTimeout(pump, 0); } }
function pump() { const f = Q.shift(); if (!f) { qBusy = false; return; } try { f(); } catch (e) { console.warn(e); } setTimeout(pump, 0); }

// Tabung sepanjang polilinear (untuk gantungan), bidang XY, penampang lingkaran.
function tube(pts, r, seg = 10) {
  const v = [], ix = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx;
    for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th); const ox = nx * c, oy = ny * c, oz = sn; v.push(pts[k][0] + ox * r, pts[k][1] + oy * r, oz * r, ox, oy, oz); }
  }
  for (let k = 0; k < pts.length - 1; k++) for (let s = 0; s < seg; s++) { const a = k * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; ix.push(a, b, c, b, d, c); }
  return { v, ix };
}
function hangerMesh(apexY, armEnds, hookTop, hook) {
  const parts = [], R = 4.2, stemTop = hookTop - 20, rr = 13;
  const hp = [[0, apexY], [0, apexY + (stemTop - apexY) * .5], [0, stemTop - 6]];
  for (let a = 0; a <= 1.0001; a += 1 / 18) { const phi = Math.PI - a * Math.PI * 1.45; hp.push([rr + rr * Math.cos(phi), stemTop + rr * Math.sin(phi)]); }   // kait melengkung
  parts.push(tube(hp, 3.1, 10));
  if (!hook) {
    for (const e of armEnds) { const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([e[0] * t, apexY + (e[1] - apexY) * t]); } parts.push(tube(pts, R, 10)); }
    const sp = [], e = armEnds[0]; for (let k = 0; k <= 8; k++) { const t = k / 8; sp.push([e[0] + (armEnds[1][0] - e[0]) * t, e[1] + (armEnds[1][1] - e[1]) * t]); }   // batang bawah
    parts.push(tube(sp, 3.2, 8));
  }
  const vb = [], ib = []; let off = 0;
  for (const p of parts) { for (const x of p.v) vb.push(x); for (const i of p.ix) ib.push(i + off); off += p.v.length / 6; }
  return { vb: new Float32Array(vb), ib: new Uint32Array(ib) };
}

/* ============================== Turntable ============================== */
export class Turntable {
  constructor(host, o = {}) {
    this.host = host; host.classList.add('tt'); host.innerHTML = '';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.cv = document.createElement('canvas');
    this.cv.style.cssText = `position:absolute;left:0;top:-${HEAD / S * 100}%;width:100%;height:${(S + HEAD) / S * 100}%;pointer-events:none;display:block`;
    host.appendChild(this.cv); this.ctx = this.cv.getContext('2d');
    this.angle = 0; this.target = 0; this.raf = 0; this.sc = 1; this.y = 0; this.tipe = 'kaos'; this.dragEnabled = true;
    this.lag = 0; this.lagV = 0; this.prev = 0; this.anim = null; this.res = null; this.img = null; this.atlas = undefined;
    registry.add(this);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.measure()).observe(host);
    this.set(o); this.measure();
  }
  measure() {
    const w = this.host.clientWidth || 400, dpr = Math.min(window.devicePixelRatio || 1, 2), pw = Math.round(w * dpr), ph = Math.round(w * (S + HEAD) / S * dpr);
    if (this.cv.width !== pw || this.cv.height !== ph) { this.cv.width = pw; this.cv.height = ph; this.draw(); }
  }
  set({ tipe, scale, y, atlas } = {}) {
    if (tipe != null && tipe !== this.tipe) { this.tipe = tipe; if (this.img) this.build(this.img); }
    if (scale != null) this.sc = +scale;
    if (y != null) this.y = +y;
    if (atlas !== undefined && atlas !== this.atlas) {
      this.atlas = atlas; this.img = null; this._fb = false; this.free();
      if (atlas) {
        const load = cors => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous';
          im.onload = () => { if (this.atlas !== atlas) return; this.img = im; enqueue(() => { if (this.atlas === atlas) this.build(im, !cors); }); };
          im.onerror = () => { if (cors) load(false); };
          im.src = atlas; };
        load(true);
      }
    }
    this.draw();
  }
  reinit() { this.res = null; if (this.img) this.build(this.img); }
  free() {
    const G = GLS && GLS.ok ? GLS : null;
    if (this.res && G) { const gl = G.gl; gl.deleteTexture(this.res.tex); for (const m of [this.res.front, this.res.back, this.res.hang, this.res.wall]) { if (!m) continue; gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.vbo); gl.deleteBuffer(m.ibo); } }
    this.res = null;
  }
  build(im, tainted) {
    const G = getGL(); if (!G) { this.draw(); return; }
    const gl = G.gl, t = TIPE[this.tipe] || TIPE.kaos;
    const sheet = document.createElement('canvas'); sheet.width = S * 2; sheet.height = S;
    const sg = sheet.getContext('2d', { willReadFrequently: true });
    const mode = im.naturalWidth / im.naturalHeight < 3 ? 2 : 4, tw = im.naturalWidth / mode, th = im.naturalHeight;
    sg.drawImage(im, 0, 0, tw, th, 0, 0, S, S); sg.drawImage(im, (mode === 2 ? 1 : 2) * tw, 0, tw, th, S, 0, S, S);
    let px;
    try { px = sg.getImageData(0, 0, S * 2, S).data; }
    catch (e) {                                              // gambar dari domain lain tanpa CORS → tidak bisa dibaca; pakai pola bawaan sesuai jenis
      console.warn('Gambar tidak bisa dibaca (CORS). Pakai pola bawaan.', e);
      if (!tainted || this._fb) return; this._fb = true;
      const im2 = new Image(); im2.onload = () => { this.img = im2; this.build(im2, false); }; im2.src = polaUrl(this.tipe, 'hitam'); return;
    }
    const al = [new Uint8Array(S * S), new Uint8Array(S * S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { al[0][y * S + x] = px[(y * S * 2 + x) * 4 + 3]; al[1][y * S + x] = px[(y * S * 2 + S + x) * 4 + 3]; }
    const H0 = t.depth * .5, R = Math.max(18, H0 * 1.15), a0 = down(al[0]), a1 = down(al[1]);
    let diff = 0, cnt = 0; for (let i = 0; i < a0.length; i++) { const p = a0[i] >= 110, q = a1[i] >= 110; if (p) cnt++; if (p !== q) diff++; }
    const fr = panelMesh(a0, 1, H0, R), bk = fr && (diff < cnt * .01 ? mirrorPanel(fr) : panelMesh(a1, -1, H0, R));
    if (!fr || !bk) { console.warn('Siluet baju tidak terdeteksi (gambar transparan?).'); return; }
    this.free();
    // ----- gantungan: ikuti kontur bahu -----
    const big = 1e9, tp = a => a < 0 ? big : a;
    const topC = Math.min(tp(fr.top[400]), tp(bk.top[400])), apexY = 400 - (topC + 16), hook = t.hanger === 'hook';
    const wB = fr.x1 - fr.x0, ends = [-1, 1].map(sgn => { const xo = Math.round(.29 * wB), v = Math.min(tp(fr.top[400 + sgn * xo]), tp(bk.top[400 - sgn * xo])); return [sgn * xo, 400 - (Math.min(v, 700) + 15)]; });
    const hm = hangerMesh(apexY, ends, 400 + HEAD - 3, hook);
    const mk = (vb, ib, stride) => {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
      const ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
      const f = (loc, n, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride * 4, off * 4); };
      f(0, 3, 0); f(1, 3, 3); if (stride === 9) { f(2, 2, 6); f(3, 1, 8); }
      gl.bindVertexArray(null); return { vao, vbo, ibo, n: ib.length };
    };
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (G.aniso) gl.texParameterf(gl.TEXTURE_2D, G.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(G.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    this.res = { tex, front: mk(fr.vb, fr.ib, 9), back: mk(bk.vb, bk.ib, 9), hang: mk(hm.vb, hm.ib, 6), wall: mk(fr.wvb, fr.wib, 9), apex: [0, apexY], topY: 400 - fr.y0, amp: Math.max(3, H0 * .30) };
    this.draw();
  }
  draw() {
    const w = this.cv.width, h = this.cv.height, ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    const G = getGL(), r = this.res;
    if (!G) { this.drawFlat(); return; }
    if (!r || !w || !h) return;
    const gl = G.gl, t = TIPE[this.tipe] || TIPE.kaos;
    if (G.cv.width !== w || G.cv.height !== h) { G.cv.width = w; G.cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    // kamera: bidang z=0 pas memenuhi kanvas (lebar 800, tinggi 880); sedikit dari atas supaya terasa 3D
    const Hh = S + HEAD, cy = HEAD / 2, D = 5600, fov = 2 * Math.atan((Hh / 2) / D), el = 2.2 * Math.PI / 180;
    const eye = [0, cy + Math.sin(el) * D, Math.cos(el) * D], vp = mat.mul(mat.persp(fov, S / Hh, 200, 9000), mat.look(eye, [0, cy, 0], [0, 1, 0]));
    const piv = 400 + HEAD - 3, s = this.sc * t.scale, dy = -(this.y + t.y) * 8;
    let model = mat.rotY(this.angle * Math.PI / 180);
    model = mat.mul(mat.trans(0, piv + dy, 0), mat.mul(mat.scale(s), mat.mul(mat.trans(0, -piv, 0), model)));
    gl.useProgram(G.hang.p);
    gl.uniformMatrix4fv(G.hang.u.uVP, false, vp); gl.uniformMatrix4fv(G.hang.u.uModel, false, model); gl.uniform3fv(G.hang.u.uEye, eye);
    gl.bindVertexArray(r.hang.vao); gl.drawElements(gl.TRIANGLES, r.hang.n, gl.UNSIGNED_INT, 0);
    gl.useProgram(G.shirt.p); const u = G.shirt.u;
    gl.uniformMatrix4fv(u.uVP, false, vp); gl.uniformMatrix4fv(u.uModel, false, model); gl.uniform3fv(u.uEye, eye);
    gl.uniform1f(u.uLag, this.lag); gl.uniform1f(u.uTopY, r.topY); gl.uniform1f(u.uAmp, r.amp); gl.uniform2fv(u.uApex, r.apex);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, r.tex); gl.uniform1i(u.uTex, 0);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    for (const [m, sd] of [[r.back, -1], [r.front, 1], [r.wall, 1]]) { gl.uniform1f(u.uSide, sd); gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0); }
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.bindVertexArray(null);
    ctx.drawImage(G.cv, 0, 0, w, h, 0, 0, w, h);
  }
  drawFlat() {                                               // cadangan kalau WebGL2 tidak ada: balik kartu sederhana
    const im = this.img; if (!im) return; const w = this.cv.width, ctx = this.ctx, h = this.cv.height;
    const mode = im.naturalWidth / im.naturalHeight < 3 ? 2 : 4, tw = im.naturalWidth / mode, c = Math.cos(this.angle * Math.PI / 180), back = c < 0;
    ctx.save(); ctx.translate(w / 2, h - w / 2); ctx.scale(Math.max(.06, Math.abs(c)), 1);
    ctx.drawImage(im, (back ? (mode === 2 ? 1 : 2) : 0) * tw, 0, tw, im.naturalHeight, -w / 2, -w / 2, w, w); ctx.restore();
  }
  get view() { return VIEWS[Math.round((((this.angle % 360) + 360) % 360) / 90) % 4]; }
  kick() { if (!this.raf) { this.prev = this.angle; this.raf = requestAnimationFrame(t => this.tick(t)); } }
  tick(now) {
    this.raf = 0;
    if (this.anim) { const a = this.anim, k = Math.min(1, (now - a.t0) / a.ms); this.angle = a.from + a.d * ease(k); if (k >= 1) this.anim = null; }
    const av = this.angle - this.prev; this.prev = this.angle;                       // kain tertinggal saat dipercepat, mengayun balik saat berhenti
    this.lagV += (clamp(-av * 1.5, -13, 13) - this.lag) * .12; this.lagV *= .78; this.lag += this.lagV;
    this.draw(); this.onturn && this.onturn(this);
    if (this.anim || Math.abs(av) > .02 || Math.abs(this.lag) > .08 || Math.abs(this.lagV) > .02) this.raf = requestAnimationFrame(t => this.tick(t));
    else { this.lag = this.lagV = 0; this.draw(); }
  }
  rotateTo(deg, ms = 800) {                                  // jalur terpendek, easing halus berbasis waktu
    const from = this.angle, d = ((deg - from) % 360 + 540) % 360 - 180, to = from + d; this.target = to;
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (!d || matchMedia('(prefers-reduced-motion:reduce)').matches) { this.anim = null; this.angle = to; this.draw(); this.onturn && this.onturn(this); return; }
    this.anim = { from, d, t0: performance.now(), ms }; this.kick();
  }
  rotateBy(d) { this.rotateTo(Math.round(this.target / 90) * 90 + d, 650); }
  enableDrag(el = this.host) {                               // geser kiri/kanan = putar bebas, lepas → berhenti di sisi terdekat
    let x0 = null, a0 = 0;
    el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
    el.addEventListener('pointerdown', e => { if (!this.dragEnabled) return; x0 = e.clientX; a0 = this.angle; this.anim = null; el.setPointerCapture(e.pointerId); this.kick(); });
    el.addEventListener('pointermove', e => { if (x0 == null) return; this.angle = a0 + (e.clientX - x0) * 0.6; this.target = this.angle; this.kick(); });
    const end = () => { if (x0 == null) return; x0 = null; this.rotateTo(Math.round(this.angle / 90) * 90, 600); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
}

// Atlas contoh (dipakai kalau belum ada produk yang diatur di admin).
export function demoAtlas(hex = '#2b2b2b', tipe = 'kaos') {
  const c = document.createElement('canvas'); c.width = TILE_W * 4; c.height = TILE_H; const g = c.getContext('2d');
  const front = [[255,60],[150,80],[40,200],[95,260],[130,230],[130,720],[470,720],[470,230],[505,260],[560,200],[450,80],[345,60]].map(([x, y]) => [x + 100, y]);
  for (let v = 0; v < 4; v += 2) {
    const pts = front.map(([x, y]) => [x + v * TILE_W, y]);
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    g.fillStyle = hex; g.fill(); g.lineWidth = 3; g.strokeStyle = '#0004'; g.stroke();
    g.fillStyle = '#fff9'; g.font = 'bold 34px monospace'; g.textAlign = 'center';
    g.fillText(['DEPAN', 'KANAN', 'BELAKANG', 'KIRI'][v], v * TILE_W + 400, 400);
  }
  return c.toDataURL('image/png');
}

// Mockup bawaan (hitam/putih) untuk tiap jenis — folder mockups/ di repo yang sama.
export const mockupUrl = (tipe, warna) => new URL(`mockups/mockup-${tipe}-${warna}.png`, import.meta.url).href;

// Lembar pola 2 kotak (DEPAN | BELAKANG, 1600x800) — sisi samping & ketebalan dibentuk otomatis oleh 3D.
export const polaUrl = (tipe, warna) => new URL(`pola/pola-${tipe}-${warna}.png`, import.meta.url).href;
