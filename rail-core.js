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

const HANGER = '<svg viewBox="0 -30 200 120" preserveAspectRatio="xMidYMax meet"><path transform="translate(0,-18)" d="M100 4a12 12 0 1 1 12 12c-8 0-12 4-12 12v24" fill="none" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/><path d="M100 34 8 84h184z" fill="none" stroke="#8a6040" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const HOOK   = '<svg viewBox="0 -30 200 120" preserveAspectRatio="xMidYMax meet"><path transform="translate(0,-18)" d="M100 4a12 12 0 1 1 12 12c-8 0-12 4-12 12v50" fill="none" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/></svg>';

// ---- CSS 3D turntable: baju = tumpukan lapisan tipis (ada ketebalan) + 4 bidang sisi dari atlas ----
const CSS = `
.tt{perspective:calc(var(--s,.5)*3000px);perspective-origin:50% 25%}
.tt-rot,.tt-stack{position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 0;pointer-events:none}
.tt-h,.tt-hs{position:absolute;left:50%;top:-40px;width:42%;aspect-ratio:200/120;transform-origin:50% 0}
.tt-h{transform:translateX(-50%)}
.tt-hs{transform:translateX(-50%) rotateY(90deg)}
.tt-h svg,.tt-hs svg{display:block;width:100%;height:100%;overflow:visible}
.tt-l{position:absolute;inset:0;background-repeat:no-repeat;background-size:400% 100%;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.tt-l.fr{transform:translateZ(calc(var(--z)*var(--s,.5)*1px))}
.tt-l.bk{transform:translateZ(calc(var(--z)*var(--s,.5)*1px)) rotateY(180deg)}
.tt-l.sr{transform:rotateY(-90deg)}
.tt-l.sl{transform:rotateY(90deg)}
.tt-l.in{filter:brightness(.8)}
`;
let cssDone = false;
const injectCSS = () => { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };
const HOOK_SIDE = '<svg viewBox="0 -30 200 120" preserveAspectRatio="xMidYMax meet"><path transform="translate(0,-18)" d="M100 4a12 12 0 1 1 12 12c-8 0-12 4-12 12v24" fill="none" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/><path d="M100 34v50" stroke="#8a6040" stroke-width="6" stroke-linecap="round"/></svg>';
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SLICES = 5;                                              // lapisan per sisi (ketebalan)

export class Turntable {
  constructor(host, o = {}) {
    injectCSS();
    this.host = host; host.classList.add('tt');
    host.innerHTML = '<div class="tt-rot"><div class="tt-h"></div><div class="tt-hs"></div><div class="tt-stack"></div></div>';
    this.rot = host.querySelector('.tt-rot'); this.h = host.querySelector('.tt-h'); this.hs = host.querySelector('.tt-hs'); this.stack = host.querySelector('.tt-stack');
    this.mode = 4; this.angle = 0; this.target = 0; this.raf = 0; this.sc = 1; this.y = 0; this.tipe = 'kaos'; this.dragEnabled = true;
    this.layers = []; this.slices = []; this.sides = [];
    const add = (cls, tile, z, extra) => { const el = document.createElement('div'); el.className = 'tt-l ' + cls + (extra ? ' ' + extra : ''); el.dataset.v = tile; if (z != null) el.style.setProperty('--z', z); this.stack.appendChild(el); this.layers.push(el); return el; };
    // urutan DOM: belakang → depan (browser tetap mengurutkan per kedalaman 3D)
    add('bk', 'b', -100);                                          // bidang BELAKANG
    for (let i = SLICES; i >= 1; i--) this.slices.push(add('bk', 'b', -100 * (1 - i / (SLICES + 1)), 'in'));
    for (let i = 1; i <= SLICES; i++) this.slices.push(add('fr', 'f', 100 * (1 - i / (SLICES + 1)), 'in'));
    add('fr', 'f', 100);                                           // bidang DEPAN
    this.sides = [add('sr', 'r'), add('sl', 'l')];                   // KANAN, KIRI (muncul saat tampak samping)
    this.faces = [this.layers[0], this.layers[this.layers.length - 3]];
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.measure()).observe(host);
    this.set(o); this.measure();
  }
  measure() { const w = this.host.clientWidth || 400; this.host.style.setProperty('--s', w / TILE_W); this.fit(); }
  fit() {                                                       // ketebalan tergantung jenis barang
    const d = (TIPE[this.tipe] || TIPE.kaos).depth;
    this.layers.forEach(el => { if (el.dataset.z0 == null) el.dataset.z0 = el.style.getPropertyValue('--z'); const z0 = +el.dataset.z0; if (el.style.getPropertyValue('--z') !== '') el.style.setProperty('--z', z0 / 100 * d); });
  }
  set({ tipe, scale, y, atlas } = {}) {
    if (tipe != null) { this.tipe = tipe; const hk = (TIPE[tipe] || TIPE.kaos).hanger === 'hook'; this.h.innerHTML = hk ? HOOK : HANGER; this.hs.innerHTML = HOOK_SIDE; this.fit(); }
    if (scale != null) this.sc = +scale;
    if (y != null) this.y = +y;
    if (atlas !== undefined) {
      this.atlas = atlas; this.mode = 4; this.sideUrl = null; this.apply();
      if (atlas) {
        const load = cors => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous';
          im.onload = () => { if (this.atlas !== atlas) return; this.mode = im.naturalWidth / im.naturalHeight < 3 ? 2 : 4; this.apply(); if (this.mode === 2) this.buildSide(im, cors); this.draw(); };
          im.onerror = () => { if (cors) load(false); };
          im.src = atlas; };
        load(true);
      }
    }
    this.draw();
  }
  buildSide(im, readable) {                                     // pola 2 kotak tidak punya gambar samping → buat jalur samping dari siluet + warna baju
    const D = (TIPE[this.tipe] || TIPE.kaos).depth, w = Math.round(D * 2), c = document.createElement('canvas'); c.width = c.height = 800;
    const g = c.getContext('2d'); let ok = false;
    if (readable) try {
      const t = document.createElement('canvas'); t.width = 1600; t.height = 800; const tg = t.getContext('2d'); tg.drawImage(im, 0, 0, 1600, 800);
      const d = tg.getImageData(0, 0, 1600, 800).data;
      for (let y = 0; y < 800; y++) {
        let r = 0, gg = 0, b = 0, n = 0, any = false;
        for (let x = 0; x < 1600; x++) { const i = (y * 1600 + x) * 4; if (d[i + 3] > 40) { any = true; if (x < 800) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } } }
        if (!any) continue; if (!n) { r = gg = b = 90; n = 1; }
        g.fillStyle = `rgb(${r / n * .82 | 0},${gg / n * .82 | 0},${b / n * .82 | 0})`; g.fillRect(400 - w / 2, y, w, 1);
      }
      ok = true;
    } catch (e) {}
    if (!ok) { g.fillStyle = '#4a4a4a'; g.fillRect(400 - w / 2, 40, w, 680); }
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(400 - w / 2, 0, 400 + w / 2, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = gr; g.fillRect(0, 0, 800, 800);
    this.sideUrl = c.toDataURL('image/png'); this.apply();
  }
  apply() {                                                     // 4 kotak (DEPAN|KANAN|BELAKANG|KIRI) atau lembar pola 2 kotak (DEPAN|BELAKANG)
    const m = this.mode, idx = m === 2 ? { f: 0, b: 1 } : { f: 0, r: 1, b: 2, l: 3 };
    for (const el of this.layers) {
      el.style.backgroundImage = this.atlas ? `url("${this.atlas}")` : 'none'; el.style.backgroundSize = m * 100 + '% 100%';
      el.style.backgroundPosition = `${(idx[el.dataset.v] ?? 0) * 100 / (m - 1)}% 0`;
      if (m === 2 && (el.dataset.v === 'r' || el.dataset.v === 'l')) { el.style.backgroundImage = this.sideUrl ? `url("${this.sideUrl}")` : 'none'; el.style.backgroundSize = '100% 100%'; el.style.backgroundPosition = '0 0'; }
    }
    this._so = undefined;
  }
  draw() {
    const t = TIPE[this.tipe] || TIPE.kaos;
    this.stack.style.transform = `translateY(${this.y + t.y}%) scale(${this.sc * t.scale})`;
    const a = ((this.angle % 360) + 360) % 360;
    this.rot.style.transform = `rotateY(${a}deg)`;
    const s = Math.abs(Math.sin(a * Math.PI / 180)), so = clamp((s - .86) / .14, 0, 1), m2 = this.mode === 2;   // tampak samping → pakai gambar KANAN/KIRI asli
    if (so !== this._so) {
      this._so = so;
      [...this.slices, ...this.faces].forEach(el => { el.style.opacity = m2 ? 1 : 1 - so; el.style.visibility = !m2 && so >= 1 ? 'hidden' : 'visible'; });
      this.sides.forEach(el => { el.style.opacity = so; el.style.visibility = so <= 0 ? 'hidden' : 'visible'; });
    }
  }
  get view() { return VIEWS[Math.round((((this.angle % 360) + 360) % 360) / 90) % 4]; }
  rotateTo(deg, ms = 800) {                                     // jalur terpendek, easing halus berbasis waktu
    const from = this.angle, d = ((deg - from) % 360 + 540) % 360 - 180, to = from + d; this.target = to;
    cancelAnimationFrame(this.raf);
    if (!d || matchMedia('(prefers-reduced-motion:reduce)').matches) { this.angle = to; this.draw(); this.onturn && this.onturn(this); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms); this.angle = from + d * ease(k);
      this.draw(); this.onturn && this.onturn(this);
      if (k < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  rotateBy(d) { this.rotateTo(Math.round(this.target / 90) * 90 + d, 650); }
  enableDrag(el = this.host) {                                  // geser kiri/kanan = putar bebas, lepas → berhenti di sisi terdekat
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
