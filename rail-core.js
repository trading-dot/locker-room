// rail-core.js — dipakai index.html (tampilan toko) dan admin.html (preview).
// ATLAS = 1 gambar PNG transparan 3200x800: 4 kotak 800x800 berurutan KIRI→KANAN:
//   [0] DEPAN  [1] KANAN  [2] BELAKANG  [3] KIRI   (urutan putar searah jarum jam dilihat dari atas)
export const TILE_W = 800, TILE_H = 800, VIEWS = ['depan', 'kanan', 'belakang', 'kiri'];

// Jenis barang: menentukan skala bawaan, geser vertikal (% tinggi), dan model gantungan.
export const TIPE = {
  'kaos':         { label: 'Kaos lengan pendek',         scale: 1,    y: 0, hanger: 'hanger', depth: 46 },
  'kaos-panjang': { label: 'Kaos lengan panjang',        scale: 1,    y: 0, hanger: 'hanger', depth: 46 },
  hoodie:    { label: 'Hoodie / Jaket',             scale: 1.04, y: 0, hanger: 'hanger', depth: 70 },
  aksesoris: { label: 'Aksesoris (tas/topi/dll)',   scale: 0.8,  y: 8, hanger: 'hook',   depth: 40 },
};


// ======================= 3D SUNGGUHAN (Three.js) =======================
// Baju = mesh berisi (depan + belakang digembungkan dari siluet PNG), diberi cahaya, bayangan, dan gantungan 3D.
const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
let threeP = null;
const loadThree = () => threeP || (threeP = new Promise((res, rej) => {
  if (window.THREE) return res(window.THREE);
  const s = document.createElement('script'); s.src = THREE_URL; s.onload = () => res(window.THREE); s.onerror = rej; document.head.appendChild(s);
}));
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const GRID = 170;                                   // resolusi mesh

// Peta alpha 256x256 + jarak ke tepi (chamfer) -> tinggi gembung
function buildField(im, tileIdx, tiles) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  g.drawImage(im, tileIdx * im.naturalWidth / tiles, 0, im.naturalWidth / tiles, im.naturalHeight, 0, 0, N, N);
  let a = new Uint8Array(N * N);
  try { const d = g.getImageData(0, 0, N, N).data; for (let i = 0; i < N * N; i++) a[i] = d[i * 4 + 3] > 40 ? 1 : 0; }
  catch (e) { for (let y = 40; y < 230; y++) for (let x = 60; x < 196; x++) a[y * N + x] = 1; }
  const D = new Float32Array(N * N).fill(1e4);
  for (let i = 0; i < N * N; i++) if (a[i]) { const x = i % N, y = i / N | 0; if (x === 0 || y === 0 || x === N - 1 || y === N - 1 || !a[i - 1] || !a[i + 1] || !a[i - N] || !a[i + N]) D[i] = 0; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (!a[i]) { D[i] = 0; continue; }
    if (x > 0) D[i] = Math.min(D[i], D[i - 1] + 1); if (y > 0) D[i] = Math.min(D[i], D[i - N] + 1);
    if (x > 0 && y > 0) D[i] = Math.min(D[i], D[i - N - 1] + 1.41); if (x < N - 1 && y > 0) D[i] = Math.min(D[i], D[i - N + 1] + 1.41); }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = y * N + x; if (!a[i]) continue;
    if (x < N - 1) D[i] = Math.min(D[i], D[i + 1] + 1); if (y < N - 1) D[i] = Math.min(D[i], D[i + N] + 1);
    if (x < N - 1 && y < N - 1) D[i] = Math.min(D[i], D[i + N + 1] + 1.41); if (x > 0 && y < N - 1) D[i] = Math.min(D[i], D[i + N - 1] + 1.41); }
  // haluskan sedikit
  const S = new Float32Array(N * N);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x; S[i] = (D[i] * 4 + D[i - 1] + D[i + 1] + D[i - N] + D[i + N]) / 8; }
  return { N, S };
}
const sample = (F, u, v) => { const x = Math.min(F.N - 1, Math.max(0, u * (F.N - 1))), y = Math.min(F.N - 1, Math.max(0, v * (F.N - 1)));
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(F.N - 1, x0 + 1), y1 = Math.min(F.N - 1, y0 + 1), fx = x - x0, fy = y - y0, S = F.S, N = F.N;
  return (S[y0 * N + x0] * (1 - fx) + S[y0 * N + x1] * fx) * (1 - fy) + (S[y1 * N + x0] * (1 - fx) + S[y1 * N + x1] * fx) * fy; };

let SHARED = null;
function sharedRenderer(T) {
  if (SHARED) return SHARED;
  const r = new T.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: true });
  r.setClearColor(0, 0); r.outputEncoding = T.sRGBEncoding; SHARED = r; return r;
}

export class Turntable {
  constructor(host, o = {}) {
    this.host = host; host.classList.add('tt');
    host.style.position = host.style.position || 'relative';
    this.mode = 2; this.angle = 0; this.target = 0; this.raf = 0; this.sc = 1; this.y = 0; this.tipe = 'kaos'; this.dragEnabled = true;
    this.ready = false; this._pend = o; this._tex = null;
    this.canvas = document.createElement('canvas'); this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    this.ctx = this.canvas.getContext('2d');
    host.innerHTML = ''; host.appendChild(this.canvas);
    loadThree().then(T => { this.T = T; this.init(); this.set(this._pend); }).catch(e => console.warn('three gagal', e));
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.measure()).observe(host);
  }
  init() {
    const T = this.T;
    this.renderer = sharedRenderer(T);
    this.scene = new T.Scene();
    this.cam = new T.PerspectiveCamera(22, 1, 10, 6000);
    this.cam.position.set(0, 0, 2400); this.cam.lookAt(0, 0, 0);
    // cahaya studio: lembut + arah utama + pantulan bawah
    this.scene.add(new T.HemisphereLight(0xffffff, 0xb9b3a8, .75));
    const key = new T.DirectionalLight(0xffffff, 1.15); key.position.set(-700, 600, 700); this.scene.add(key);
    const rim = new T.DirectionalLight(0xffffff, .35); rim.position.set(600, 200, -700); this.scene.add(rim);
    this.pivot = new T.Group(); this.scene.add(this.pivot);            // berputar (Y) pada titik gantungan
    this.body = new T.Group(); this.pivot.add(this.body);
    this.hang = new T.Group(); this.pivot.add(this.hang);
    this.measure();
  }
  measure() { if (!this.renderer) return; const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round((this.host.clientWidth || 400) * dpr), h = Math.round((this.host.clientHeight || this.host.clientWidth || 400) * dpr);
    this.W = w; this.H = h; if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); this.draw(); }
  set({ tipe, scale, y, atlas } = {}) {
    if (tipe != null) this.tipe = tipe;
    if (scale != null) this.sc = +scale;
    if (y != null) this.y = +y;
    if (!this.T) { this._pend = { tipe: this.tipe, scale: this.sc, y: this.y, atlas: atlas !== undefined ? atlas : this._pend.atlas }; return; }
    if (atlas !== undefined) {
      this.atlas = atlas; this.clear();
      if (atlas) {
        const load = cors => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous';
          im.onload = () => { if (this.atlas !== atlas) return; this.mode = im.naturalWidth / im.naturalHeight < 3 ? 2 : 4; this.build(im, cors); };
          im.onerror = () => { if (cors) load(false); };
          im.src = atlas; };
        load(true);
      }
    } else if (this.garment) this.layout();
    this.draw();
  }
  clear() { if (this.garment) { this.body.remove(this.garment); this.garment.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } }); this.garment = null; } }
  build(im, readable) {
    const T = this.T, tiles = this.mode, bk = tiles === 2 ? 1 : 2;
    const D = (TIPE[this.tipe] || TIPE.kaos).depth, H = D * 1.9;           // setengah tebal maksimum
    const mkTex = idx => { const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
      g.drawImage(im, idx * im.naturalWidth / tiles, 0, im.naturalWidth / tiles, im.naturalHeight, 0, 0, 1024, 1024);
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; t.minFilter = T.LinearMipmapLinearFilter; return t; };
    const group = new T.Group();
    const faces = [{ idx: 0, sign: 1 }, { idx: bk, sign: -1 }];
    faces.forEach(({ idx, sign }) => {
      let F; try { F = buildField(im, idx, tiles); } catch (e) { F = buildField(im, idx, tiles); }
      const tex = mkTex(idx), alpha = tex;
      const geo = new T.PlaneGeometry(800, 800, GRID, GRID); const pos = geo.attributes.position, uv = geo.attributes.uv;
      if (sign < 0) for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));      // sisi belakang dilihat dari belakang → cermin
      let mx = 1; for (let i = 0; i < F.S.length; i++) if (F.S[i] > mx) mx = F.S[i];
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i), v = 1 - uv.getY(i), d = sample(F, u, v), k = Math.min(1, d / 26);
        const body = Math.sqrt(k) * (0.78 + 0.22 * Math.min(1, d / (mx * .8)));
        const x = pos.getX(i), yy = pos.getY(i), ph = sign < 0 ? 2.1 : 0, dy = Math.max(0, 350 - yy), g = Math.min(1, dy / 750);
        const th = Math.atan2(x, dy + 70);
        let wob = Math.sin(x * .045 + Math.sin(yy * .011 + ph) * 1.6 + ph) * (.25 + g) * 8              // lipatan vertikal kain menggantung
                + Math.sin(x * .11 + yy * .013 + ph * 2) * g * 4                                       // lipatan kecil
                + Math.sin(th * 15 + ph) * Math.min(1, dy / 180) * (1 - g * .6) * 9                   // tarikan dari titik gantungan (bahu)
                + Math.sin(x * .032 + ph) * Math.max(0, dy - 520) / 230 * 6                           // ujung bawah bergelombang
                + (Math.abs(x) > 140 && yy > 120 ? Math.sin(x * .07 + yy * .05 + ph) * 5 : 0)          // kerutan lengan
                + Math.sin(yy * .05 + x * .02 + ph) * Math.exp(-dy / 90) * 6;                           // kerut kerah/bahu
        wob *= (1 + .5 * Math.abs(Math.sin(x * .017 + ph)));
        pos.setZ(i, sign * (H * body + wob * k));
      }
      if (sign < 0) { const A = geo.index.array; for (let i = 0; i < A.length; i += 3) { const t = A[i]; A[i] = A[i + 2]; A[i + 2] = t; } }
      geo.computeVertexNormals();
      const mat = new T.MeshStandardMaterial({ map: tex, alphaMap: null, transparent: false, alphaTest: .5, roughness: .82, metalness: 0, side: T.FrontSide });
      const mesh = new T.Mesh(geo, mat); group.add(mesh);
      // pastikan potongan alpha (map.a) dipakai: alphaTest dengan map alpha aktif di three r128 lewat map
    });
    this.garment = group; this.body.add(group); this.layout(); this.buildHanger(); this.draw();
  }
  buildHanger() {
    const T = this.T; while (this.hang.children.length) this.hang.remove(this.hang.children[0]);
    const hook = (TIPE[this.tipe] || TIPE.kaos).hanger === 'hook';
    const wood = new T.MeshStandardMaterial({ color: 0x8a6040, roughness: .55, metalness: .05 }), metal = new T.MeshStandardMaterial({ color: 0x777777, roughness: .35, metalness: .9 });
    const tube = (pts, r, m) => { const c = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))); return new T.Mesh(new T.TubeGeometry(c, 40, r, 10, false), m); };
    const top = 330;                                                       // ujung atas baju (unit lokal)
    this.hang.add(tube([[0, top + 120, 0], [0, top + 90, 0], [14, top + 76, 0], [10, top + 56, 0], [0, top + 44, 0], [0, top + 20, 0]], 3.2, metal));
    if (!hook) { this.hang.add(tube([[-330, top - 140, 0], [-170, top - 55, 0], [0, top + 14, 0], [170, top - 55, 0], [330, top - 140, 0]], 6.5, wood)); }
  }
  layout() {
    const t = TIPE[this.tipe] || TIPE.kaos, s = this.sc * t.scale;
    // titik gantung di (0, top); semua berputar mengelilingi sumbu vertikal tengah
    this.pivot.position.set(0, 0, 0);
    this.body.scale.setScalar(s); this.body.position.y = -(this.y + t.y) / 100 * 800;
    this.hang.scale.setScalar(s); this.hang.position.y = this.body.position.y;
  }
  draw() {
    if (!this.renderer) return;
    const a = ((this.angle % 360) + 360) % 360; this.pivot.rotation.y = a * Math.PI / 180;
    const r = this.renderer; r.setSize(this.W, this.H, false); r.render(this.scene, this.cam);
    this.ctx.clearRect(0, 0, this.W, this.H); this.ctx.drawImage(r.domElement, 0, 0);
  }
  get view() { return VIEWS[Math.round((((this.angle % 360) + 360) % 360) / 90) % 4]; }
  rotateTo(deg, ms = 800) {
    const from = this.angle, d = ((deg - from) % 360 + 540) % 360 - 180, to = from + d; this.target = to;
    cancelAnimationFrame(this.raf);
    if (!d || matchMedia('(prefers-reduced-motion:reduce)').matches) { this.angle = to; this.draw(); this.onturn && this.onturn(this); return; }
    const t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / ms); this.angle = from + d * ease(k); this.draw(); this.onturn && this.onturn(this); if (k < 1) this.raf = requestAnimationFrame(step); };
    this.raf = requestAnimationFrame(step);
  }
  rotateBy(d) { this.rotateTo(Math.round(this.target / 90) * 90 + d, 650); }
  enableDrag(el = this.host) {
    let x0 = null, a0 = 0;
    el.style.touchAction = 'pan-y'; el.style.cursor = 'grab';
    el.addEventListener('pointerdown', e => { if (!this.dragEnabled) return; x0 = e.clientX; a0 = this.angle; cancelAnimationFrame(this.raf); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (x0 == null) return; this.angle = a0 + (e.clientX - x0) * 0.6; this.target = this.angle; this.draw(); this.onturn && this.onturn(this); });
    const end = () => { if (x0 == null) return; x0 = null; this.rotateTo(Math.round(this.angle / 90) * 90, 600); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
}

// Atlas contoh (dipakai kalau belum ada produk yang diatur di admin).
export function demoAtlas(hex = '#2b2b2b', tipe = 'kaos') {
  const c = document.createElement('canvas'); c.width = TILE_W * 4; c.height = TILE_H; const g = c.getContext('2d');
  const front = [[255,60],[150,80],[40,200],[95,260],[130,230],[130,720],[470,720],[470,230],[505,260],[560,200],[450,80],[345,60]];
  const side  = [[255,62],[345,62],[385,200],[400,330],[380,720],[220,720],[205,330],[215,200]];
  const shade = ['#fff0', '#0003', '#0000', '#0003'];
  for (let v = 0; v < 4; v++) {
    const pts = (v % 2 ? side : front).map(([x, y]) => [x + v * TILE_W, y]);
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath();
    g.fillStyle = hex; g.fill(); g.fillStyle = shade[v]; g.fill(); g.lineWidth = 3; g.strokeStyle = '#0004'; g.stroke();
    g.fillStyle = '#fff9'; g.font = 'bold 34px monospace'; g.textAlign = 'center';
    g.fillText(['DEPAN', 'KANAN', 'BELAKANG', 'KIRI'][v], v * TILE_W + 300, 400);
  }
  return c.toDataURL('image/png');
}

// Mockup bawaan (hitam/putih) untuk tiap jenis — folder mockups/ di repo yang sama.
export const mockupUrl = (tipe, warna) => new URL(`mockups/mockup-${tipe}-${warna}.png`, import.meta.url).href;

// Lembar pola 2 kotak (DEPAN | BELAKANG, 1600x800) — sisi samping dibentuk otomatis oleh 3D.
export const polaUrl = (tipe, warna) => new URL(`pola/pola-${tipe}-${warna}.png`, import.meta.url).href;
