// rail-core.js — dipakai index.html (tampilan toko) dan admin.html (preview).
// ATLAS = 1 gambar PNG transparan 2400x800: 4 kotak 600x800 berurutan KIRI→KANAN:
//   [0] DEPAN  [1] KANAN  [2] BELAKANG  [3] KIRI   (urutan putar searah jarum jam dilihat dari atas)
export const TILE_W = 600, TILE_H = 800, VIEWS = ['depan', 'kanan', 'belakang', 'kiri'];

// Jenis barang: menentukan skala bawaan, geser vertikal (% tinggi), dan model gantungan.
export const TIPE = {
  kaos:      { label: 'Kaos',                       scale: 1,    y: 0, hanger: 'hanger' },
  hoodie:    { label: 'Hoodie / Jaket',             scale: 1.04, y: 0, hanger: 'hanger' },
  aksesoris: { label: 'Aksesoris (topi/tas/dll)',   scale: 0.8,  y: 8, hanger: 'hook'   },
};

const HANGER = '<svg viewBox="0 -30 200 120" preserveAspectRatio="xMidYMax meet"><path transform="translate(0,-18)" d="M100 4a12 12 0 1 1 12 12c-8 0-12 4-12 12v24" fill="none" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/><path d="M100 34 8 84h184z" fill="none" stroke="#8a6040" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const HOOK   = '<svg viewBox="0 -30 200 120" preserveAspectRatio="xMidYMax meet"><path transform="translate(0,-18)" d="M100 4a12 12 0 1 1 12 12c-8 0-12 4-12 12v50" fill="none" stroke="#6b4a2f" stroke-width="5" stroke-linecap="round"/></svg>';

export class Turntable {
  constructor(host, o = {}) {
    this.host = host; host.classList.add('tt');
    host.innerHTML = '<div class="tt-h"></div><div class="tt-stack"><div class="tt-v a"></div><div class="tt-v b"></div></div>';
    this.h = host.querySelector('.tt-h'); this.stack = host.querySelector('.tt-stack');
    this.a = host.querySelector('.a'); this.b = host.querySelector('.b');
    this.angle = 0; this.target = 0; this.raf = 0; this.sc = 1; this.y = 0; this.tipe = 'kaos';
    this.set(o);
  }
  set({ tipe, scale, y, atlas } = {}) {
    if (tipe != null) { this.tipe = tipe; this.h.innerHTML = (TIPE[tipe] || TIPE.kaos).hanger === 'hook' ? HOOK : HANGER; }
    if (scale != null) this.sc = +scale;
    if (y != null) this.y = +y;
    if (atlas !== undefined) {
      this.atlas = atlas;
      for (const el of [this.a, this.b]) { el.style.backgroundImage = atlas ? `url("${atlas}")` : 'none'; el.style.backgroundSize = '400% 100%'; }
    }
    this.draw();
  }
  draw() {
    const t = TIPE[this.tipe] || TIPE.kaos;
    this.stack.style.transform = `translateY(${this.y + t.y}%) scale(${this.sc * t.scale})`;
    const a = ((this.angle % 360) + 360) % 360, p = a / 90, k = Math.floor(p), f = p - k, i = k % 4, j = (i + 1) % 4;
    const sq = 1 - 0.18 * Math.sin(Math.PI * f);                  // gepeng sedikit saat berputar → kesan 3D
    this.a.style.backgroundPosition = `${i * 100 / 3}% 0`; this.b.style.backgroundPosition = `${j * 100 / 3}% 0`;
    this.a.style.opacity = f < .5 ? 1 : 2 * (1 - f); this.b.style.opacity = f < .5 ? 2 * f : 1;
    this.a.style.transform = this.b.style.transform = `scaleX(${sq})`;
  }
  get view() { return VIEWS[Math.round((((this.angle % 360) + 360) % 360) / 90) % 4]; }
  rotateTo(deg) {                                               // putar lewat jalur terpendek
    const d = ((deg - this.angle) % 360 + 540) % 360 - 180; this.target = this.angle + d;
    cancelAnimationFrame(this.raf);
    const step = () => {
      this.angle += (this.target - this.angle) * 0.16;
      if (Math.abs(this.target - this.angle) < 0.3) this.angle = this.target; else this.raf = requestAnimationFrame(step);
      this.draw(); this.onturn && this.onturn(this);
    };
    step();
  }
  rotateBy(d) { this.rotateTo(Math.round(this.target / 90) * 90 + d); }
  enableDrag() {                                                // geser kiri/kanan untuk memutar bebas, lepas → snap 90°
    let x0 = null, a0 = 0;
    this.host.style.touchAction = 'pan-y'; this.host.style.cursor = 'grab';
    this.host.addEventListener('pointerdown', e => { x0 = e.clientX; a0 = this.angle; cancelAnimationFrame(this.raf); this.host.setPointerCapture(e.pointerId); });
    this.host.addEventListener('pointermove', e => { if (x0 == null) return; this.angle = a0 - (e.clientX - x0) * 0.6; this.target = this.angle; this.draw(); this.onturn && this.onturn(this); });
    const end = () => { if (x0 == null) return; x0 = null; this.rotateTo(Math.round(this.angle / 90) * 90); };
    this.host.addEventListener('pointerup', end); this.host.addEventListener('pointercancel', end);
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
