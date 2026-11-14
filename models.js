// 3D models, built from primitives (no downloads). Used by models.html (explorer) and film.html.
// Units are metres. Every model is a THREE.Group whose children are "part" groups:
//   group.userData.part = key into that model's `parts` table ([name, description]).
// These are simplified teaching models, not engineering drawings; proportions are approximate.
// To add a model: write a build function, describe its parts, push it onto MODELS.

const MODELS = (() => {
  const T = THREE, V = (x, y, z) => new T.Vector3(x, y, z);
  const M = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0.15 }, o));
  const canvasTex = (w, h, draw, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const cellTex = canvasTex(128, 128, (g, w) => { // solar cells: dark blue tiles, silver gridlines
    g.fillStyle = '#b9c2d6'; g.fillRect(0, 0, w, w);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#16306f' : '#1b3a86'; g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29); }
  }, [3, 3]);
  const prismTex = canvasTex(256, 256, (g, w) => { // 10 × 10 corner-cube reflectors
    g.fillStyle = '#c9ccd2'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 100; i++) {
      const x = 14 + (i % 10) * 25.3, y = 14 + (i / 10 | 0) * 25.3, r = g.createRadialGradient(x - 3, y - 3, 1, x, y, 10);
      r.addColorStop(0, '#fff'); r.addColorStop(0.5, '#7fb7e6'); r.addColorStop(1, '#16202e'); g.fillStyle = r; g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill();
    }
  });
  const stageTex = canvasTex(512, 256, (g, w, h) => { // white stage with black roll-pattern panels
    g.fillStyle = '#eeeeea'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b1b1d';
    for (let i = 0; i < 4; i++) g.fillRect(i * 128, h * 0.72, 64, h * 0.28);
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 32; i++) g.fillRect(i * 16, 0, 1, h);
  });
  const mats = () => ({
    white: M(0xf0f0ee), dark: M(0x24262c, { roughness: 0.5 }), black: M(0x0c0c0e, { roughness: 0.35 }),
    metal: M(0xc3c8d2, { metalness: 0.9, roughness: 0.28 }), tan: M(0xe4d6b0),
    gold: M(0xe2aa3c, { metalness: 0.9, roughness: 0.32, flatShading: true }),
    cell: Object.assign(M(0xffffff, { metalness: 0.3, roughness: 0.4, map: cellTex }), { name: 'cell' }),
    red: M(0xc9412f), glass: M(0x9fd0ff, { metalness: 0.9, roughness: 0.08 }),
  });
  const add = (parent, geo, mat, p, r) => {
    const m = new T.Mesh(geo, mat); if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]);
    m.castShadow = true; parent.add(m); return m;
  };
  const box = (x, y, z, s = 1) => new T.BoxGeometry(x, y, z, s, s, s);
  const cyl = (r1, r2, h, n = 24, open = false, hs = 1) => new T.CylinderGeometry(r1, r2, h, n, hs, open);
  const ball = (r, n = 24) => new T.SphereGeometry(r, n, Math.max(8, n / 2));
  const strut = (parent, a, b, r, mat) => { // a rod between two points
    const A = V(a[0], a[1], a[2]), B = V(b[0], b[1], b[2]), m = add(parent, cyl(r, r, A.distanceTo(B), 8), mat);
    m.position.copy(A).lerp(B, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), B.sub(A).normalize()); return m;
  };
  // Crinkled foil: nudge each vertex by a hash of its position, so shared corners move together (no cracks).
  const crinkle = (geo, amt) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = n => { const s = Math.sin(x * 127.1 * n + y * 311.7 + z * 74.7 * n) * 43758.5453; return (s - Math.floor(s) - 0.5) * 2 * amt; };
      p.setXYZ(i, x + h(1), y + h(2), z + h(3));
    }
    geo.computeVertexNormals(); return geo;
  };
  const part = (root, key) => { const g = new T.Group(); g.userData.part = key; root.add(g); return g; };
  const finish = root => { // each mesh gets its own material so a single part can be lit up
    root.traverse(o => { if (o.isMesh && !Array.isArray(o.material)) o.material = o.material.clone(); });
    return root;
  };
  const wheel = (parent, p, r, w, m) => {
    const g = new T.Group(); g.position.set(p[0], p[1], p[2]); parent.add(g);
    add(g, cyl(r, r, w, 28), m.dark, null, [Math.PI / 2, 0, 0]);
    add(g, cyl(r * 0.45, r * 0.45, w * 1.06, 16), m.metal, null, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; add(g, box(r * 0.16, r * 0.1, w), m.metal, [Math.cos(a) * r, Math.sin(a) * r, 0], [0, 0, a + Math.PI / 2]); }
    return g;
  };

  // ───────── Opportunity / Spirit (Mars Exploration Rover) ─────────
  function rover() {
    const root = new T.Group(), m = mats(); root.userData.wheels = [];
    const web = part(root, 'web'); add(web, crinkle(box(1.0, 0.3, 0.72, 4), 0.012), m.gold, [0, 0.45, 0]);
    const solar = part(root, 'solar');
    add(solar, box(1.15, 0.03, 0.95), m.cell, [0, 0.63, 0]);
    for (const s of [-1, 1]) { add(solar, box(0.8, 0.02, 0.6), m.cell, [-0.05, 0.63, s * 0.78]); add(solar, box(0.3, 0.02, 0.42), m.cell, [0.72, 0.63, s * 0.5]); }
    add(solar, box(0.55, 0.02, 1.35), m.cell, [-0.85, 0.63, 0]);
    const wheels = part(root, 'wheels'), susp = part(root, 'suspension');
    for (const s of [-1, 1]) {
      for (const x of [0.58, 0, -0.58]) root.userData.wheels.push(wheel(wheels, [x, 0.13, s * 0.62], 0.13, 0.16, m));
      const z = s * 0.5, P = [0.12, 0.44, z], B = [-0.3, 0.3, z];
      strut(susp, P, [0.58, 0.14, z], 0.022, m.metal); strut(susp, P, B, 0.022, m.metal);
      strut(susp, B, [0, 0.14, z], 0.02, m.metal); strut(susp, B, [-0.58, 0.14, z], 0.02, m.metal);
      strut(susp, P, [0.12, 0.44, s * 0.36], 0.03, m.metal);
    }
    const mast = part(root, 'mast'); strut(mast, [0.42, 0.63, 0.2], [0.42, 1.46, 0.2], 0.025, m.white);
    const head = new T.Group(); head.position.set(0.42, 1.5, 0.2); mast.add(head); root.userData.head = head;
    add(head, box(0.1, 0.1, 0.44), m.white);
    for (const z of [-0.17, -0.06, 0.06, 0.17]) add(head, cyl(0.03, 0.03, 0.04, 16), m.black, [0.06, 0, z], [0, 0, Math.PI / 2]);
    const hga = part(root, 'hga'); strut(hga, [-0.2, 0.63, -0.22], [-0.2, 0.86, -0.22], 0.015, m.metal);
    add(hga, cyl(0.15, 0.15, 0.015, 28), m.white, [-0.2, 0.92, -0.22], [0.9, 0, 0.3]);
    const lga = part(root, 'lga'); strut(lga, [-0.4, 0.63, -0.3], [-0.4, 1.02, -0.3], 0.012, m.metal); strut(lga, [-0.48, 0.63, 0.3], [-0.48, 0.84, 0.3], 0.016, m.metal);
    const arm = part(root, 'arm'); strut(arm, [0.5, 0.42, 0.1], [0.86, 0.52, 0.1], 0.02, m.metal); strut(arm, [0.86, 0.52, 0.1], [1.02, 0.32, 0.1], 0.02, m.metal);
    add(arm, ball(0.05, 12), m.dark, [1.02, 0.3, 0.1]);
    for (let i = 0; i < 4; i++) add(arm, cyl(0.03, 0.03, 0.08, 10), i % 2 ? m.metal : m.white, [1.02 + Math.cos(i * 1.57) * 0.07, 0.3, 0.1 + Math.sin(i * 1.57) * 0.07]);
    const haz = part(root, 'hazcam'); for (const x of [0.52, -0.52]) for (const z of [-0.12, 0.12]) add(haz, box(0.05, 0.05, 0.06), m.black, [x, 0.5, z]);
    return finish(root);
  }

  // ───────── InSight ─────────
  function insight() {
    const root = new T.Group(), m = mats(), Y = 0.95;
    const deck = part(root, 'deck'); add(deck, cyl(0.78, 0.78, 0.1, 10), m.tan, [0, Y, 0]); add(deck, crinkle(cyl(0.55, 0.5, 0.3, 12, false, 2), 0.012), m.gold, [0, Y - 0.2, 0]);
    add(deck, box(0.3, 0.14, 0.24), m.white, [-0.3, Y + 0.12, -0.3]); add(deck, box(0.22, 0.1, 0.3), m.dark, [0.35, Y + 0.1, -0.25]);
    const legs = part(root, 'legs');
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.52, c = Math.cos(a), s = Math.sin(a); strut(legs, [c * 0.6, Y - 0.05, s * 0.6], [c * 1.0, 0.06, s * 1.0], 0.03, m.metal); strut(legs, [c * 0.3, Y - 0.3, s * 0.3], [c * 0.9, 0.2, s * 0.9], 0.02, m.metal); add(legs, cyl(0.14, 0.14, 0.05, 16), m.metal, [c * 1.0, 0.03, s * 1.0]); }
    const solar = part(root, 'solar');
    for (const s of [-1, 1]) { add(solar, cyl(1.075, 1.075, 0.03, 10), m.cell, [s * 1.9, Y, 0]); strut(solar, [s * 0.7, Y, 0], [s * 0.9, Y, 0], 0.03, m.metal); }
    const arm = part(root, 'arm'); strut(arm, [0.1, Y + 0.05, 0.5], [0.1, Y + 0.55, 0.55], 0.03, m.metal); strut(arm, [0.1, Y + 0.55, 0.55], [0.15, Y + 0.15, 1.4], 0.025, m.metal);
    add(arm, box(0.12, 0.1, 0.14), m.metal, [0.15, Y + 0.08, 1.45]); add(arm, box(0.08, 0.08, 0.1), m.black, [0.1, Y + 0.45, 0.75]);
    const seis = part(root, 'seis'); add(seis, ball(0.36, 28), m.white, [0.35, 0.02, 1.8]).scale.y = 0.75; add(seis, cyl(0.4, 0.44, 0.08, 28), m.metal, [0.35, 0.04, 1.8]);
    strut(seis, [0.3, Y - 0.1, 0.6], [0.35, 0.05, 1.45], 0.012, m.tan);
    const hp3 = part(root, 'hp3'); add(hp3, box(0.16, 0.5, 0.3), m.dark, [-0.75, 0.25, 1.6]); add(hp3, cyl(0.03, 0.03, 0.42, 10), m.metal, [-0.75, 0.2, 1.8]); strut(hp3, [-0.3, Y - 0.1, 0.6], [-0.75, 0.05, 1.45], 0.012, m.tan);
    const rise = part(root, 'rise'); for (const s of [-1, 1]) add(rise, cyl(0.1, 0.03, 0.22, 16), m.white, [s * 0.6, Y + 0.14, -0.3], [0, 0, -s * 0.5]);
    const uhf = part(root, 'uhf'); add(uhf, cyl(0.045, 0.045, 0.34, 12), m.white, [0, Y + 0.2, -0.55]);
    const twins = part(root, 'twins'); strut(twins, [-0.55, Y, 0.2], [-0.55, Y + 0.5, 0.2], 0.015, m.metal); strut(twins, [-0.55, Y + 0.5, 0.2], [-0.8, Y + 0.5, 0.2], 0.012, m.metal); strut(twins, [0.55, Y, 0.2], [0.55, Y + 0.5, 0.2], 0.015, m.metal); strut(twins, [0.55, Y + 0.5, 0.2], [0.8, Y + 0.5, 0.2], 0.012, m.metal);
    const larri = part(root, 'larri'); add(larri, ball(0.07, 16), m.glass, [0.45, Y + 0.06, 0.3]).scale.y = 0.6;
    return finish(root);
  }

  // ───────── Apollo Lunar Module descent stage ─────────
  function lmDescent() {
    const root = new T.Group(), m = mats();
    const body = part(root, 'body'); add(body, crinkle(cyl(2.1, 2.1, 1.6, 8, false, 3), 0.045), m.gold, [0, 2.1, 0], [0, Math.PI / 8, 0]);
    for (const a of [0.785, 3.927]) add(body, crinkle(box(1.5, 1.3, 0.06, 3), 0.02), m.black, [Math.cos(a) * 1.97, 2.1, Math.sin(a) * 1.97], [0, -a + Math.PI / 2, 0]);
    const top = part(root, 'deck'); add(top, cyl(2.0, 2.0, 0.08, 8), m.dark, [0, 2.95, 0], [0, Math.PI / 8, 0]); add(top, cyl(0.45, 0.45, 0.12, 20), m.metal, [0, 3.03, 0]);
    for (let i = 0; i < 4; i++) add(top, box(0.2, 0.14, 0.2), m.metal, [Math.cos(i * 1.57 + 0.78) * 1.3, 3.05, Math.sin(i * 1.57 + 0.78) * 1.3]);
    const eng = part(root, 'engine'); add(eng, cyl(0.3, 0.78, 0.95, 28, true), Object.assign(m.dark, { side: T.DoubleSide }), [0, 0.95, 0]); add(eng, cyl(0.32, 0.3, 0.2, 20), m.metal, [0, 1.38, 0]);
    const legs = part(root, 'legs'), ladder = part(root, 'ladder');
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), px = -s, pz = c;
      strut(legs, [c * 2.0, 2.75, s * 2.0], [c * 4.2, 0.2, s * 4.2], 0.09, m.gold);
      for (const k of [-1, 1]) strut(legs, [c * 1.95 + px * k * 0.75, 1.45, s * 1.95 + pz * k * 0.75], [c * 3.3, 1.25, s * 3.3], 0.05, m.gold);
      add(legs, cyl(0.47, 0.47, 0.14, 24), m.gold, [c * 4.2, 0.07, s * 4.2]);
    }
    for (const k of [-1, 1]) strut(ladder, [2.25, 2.72, k * 0.28], [3.75, 0.95, k * 0.28], 0.025, m.metal);
    for (let i = 0; i < 9; i++) { const u = 0.06 + i * 0.11; strut(ladder, [2.25 + 1.5 * u, 2.72 - 1.77 * u, -0.28], [2.25 + 1.5 * u, 2.72 - 1.77 * u, 0.28], 0.02, m.metal); }
    const plaque = part(root, 'plaque'); add(plaque, box(0.03, 0.2, 0.28), m.metal, [2.95, 1.98, 0], [0, 0, -0.7]);
    const mesa = part(root, 'mesa'); add(mesa, box(0.9, 0.12, 1.1), m.dark, [1.75, 1.2, 1.75], [0.5, -0.785, 0]); add(mesa, box(0.3, 0.3, 0.3), m.white, [1.8, 1.42, 1.8]); add(mesa, box(0.22, 0.2, 0.35), m.metal, [1.55, 1.36, 2.0]);
    return finish(root);
  }

  // ───────── Mars Polar Lander ─────────
  function polarLander() {
    const root = new T.Group(), m = mats(), Y = 1.0;
    const deck = part(root, 'deck'); add(deck, cyl(0.8, 0.8, 0.1, 6), m.tan, [0, Y, 0]); add(deck, crinkle(cyl(0.6, 0.5, 0.35, 12, false, 2), 0.012), m.gold, [0, Y - 0.22, 0]);
    const legs = part(root, 'legs');
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 1.57, c = Math.cos(a), s = Math.sin(a); strut(legs, [c * 0.6, Y - 0.05, s * 0.6], [c * 1.15, 0.06, s * 1.15], 0.03, m.metal); strut(legs, [c * 0.3, Y - 0.35, s * 0.3], [c * 1.0, 0.25, s * 1.0], 0.02, m.metal); add(legs, cyl(0.15, 0.15, 0.05, 16), m.metal, [c * 1.15, 0.03, s * 1.15]); }
    const solar = part(root, 'solar');
    for (const s of [-1, 1]) { add(solar, box(0.95, 0.03, 0.8), m.cell, [s * 1.3, Y, 0.42]); add(solar, box(0.95, 0.03, 0.8), m.cell, [s * 1.3, Y, -0.42]); strut(solar, [s * 0.7, Y, 0], [s * 0.85, Y, 0], 0.03, m.metal); }
    const eng = part(root, 'engines'); for (let i = 0; i < 12; i++) { const a = (i / 4 | 0) * 2.094 + 0.52 + (i % 4 - 1.5) * 0.16; add(eng, cyl(0.03, 0.055, 0.12, 12), m.dark, [Math.cos(a) * 0.42, Y - 0.46, Math.sin(a) * 0.42]); }
    const arm = part(root, 'arm'); strut(arm, [0, Y + 0.05, 0.55], [0, Y + 0.5, 0.75], 0.03, m.metal); strut(arm, [0, Y + 0.5, 0.75], [0.05, 0.25, 1.6], 0.025, m.metal); add(arm, box(0.12, 0.1, 0.16), m.metal, [0.05, 0.2, 1.66]);
    const ssi = part(root, 'ssi'); strut(ssi, [0.35, Y, 0.3], [0.35, Y + 0.7, 0.3], 0.025, m.white); add(ssi, box(0.14, 0.12, 0.2), m.white, [0.35, Y + 0.76, 0.3]); for (const x of [-0.04, 0.04]) add(ssi, cyl(0.025, 0.025, 0.03, 12), m.black, [0.35 + x, Y + 0.76, 0.41], [Math.PI / 2, 0, 0]);
    const met = part(root, 'met'); strut(met, [-0.5, Y, -0.2], [-0.5, Y + 1.2, -0.2], 0.012, m.metal); for (const y of [0.5, 0.9, 1.2]) add(met, box(0.12, 0.03, 0.03), m.white, [-0.45, Y + y, -0.2]);
    const lidar = part(root, 'lidar'); add(lidar, box(0.2, 0.16, 0.2), m.dark, [-0.25, Y + 0.13, 0.35]); add(lidar, cyl(0.05, 0.05, 0.12, 14), m.metal, [-0.25, Y + 0.27, 0.35]);
    const tega = part(root, 'tega'); add(tega, box(0.3, 0.2, 0.26), m.white, [0.05, Y + 0.15, -0.3]); add(tega, box(0.3, 0.02, 0.12), m.metal, [0.05, Y + 0.3, -0.18], [0.7, 0, 0]);
    const mga = part(root, 'mga'); strut(mga, [0.5, Y, -0.3], [0.5, Y + 0.3, -0.3], 0.02, m.metal); add(mga, cyl(0.26, 0.26, 0.02, 28), m.white, [0.5, Y + 0.42, -0.3], [0.8, 0.4, 0]); add(mga, cyl(0.04, 0.04, 0.3, 10), m.white, [-0.55, Y + 0.2, 0.25]);
    return finish(root);
  }

  // ───────── Apollo 11 Laser Ranging Retroreflector ─────────
  function lrrr() {
    const root = new T.Group(), m = mats(), tilt = -0.42;
    const arr = part(root, 'array'); add(arr, box(0.46, 0.05, 0.46), m.metal, [0, 0.34, 0], [tilt, 0, 0]);
    add(arr, new T.PlaneGeometry(0.44, 0.44), M(0xffffff, { metalness: 0.5, roughness: 0.15, map: prismTex }), [0, 0.34 + 0.026 * Math.cos(tilt), 0.026 * Math.sin(tilt)], [tilt - Math.PI / 2, 0, 0]);
    const pal = part(root, 'pallet'); add(pal, box(0.6, 0.03, 0.62), m.metal, [0, 0.03, 0.04]);
    for (const x of [-0.26, 0.26]) { strut(pal, [x, 0.04, 0.26], [x, 0.26, 0.2], 0.012, m.metal); strut(pal, [x, 0.04, -0.2], [x, 0.44, -0.2], 0.012, m.metal); }
    const aim = part(root, 'aim'); strut(aim, [0.3, 0.3, 0], [0.62, 0.42, 0], 0.012, m.metal); add(aim, cyl(0.05, 0.05, 0.01, 20), m.white, [0.62, 0.43, 0]); strut(aim, [0.62, 0.43, 0], [0.62, 0.5, 0], 0.005, m.black);
    add(aim, cyl(0.03, 0.03, 0.012, 16), m.glass, [0.5, 0.39, 0.05]);
    return finish(root);
  }

  // ───────── Saturn V third stage (S-IVB) ─────────
  function sivb() {
    const root = new T.Group(), m = mats();
    const tank = part(root, 'tanks'); add(tank, cyl(3.3, 3.3, 10.5, 40), M(0xffffff, { map: stageTex, roughness: 0.5 }), [0, 9, 0]);
    const iu = part(root, 'iu'); add(iu, cyl(3.3, 3.3, 0.9, 40), m.dark, [0, 14.7, 0]); add(iu, cyl(3.32, 3.32, 0.12, 40), m.white, [0, 14.4, 0]);
    const skirt = part(root, 'skirt'); add(skirt, cyl(3.3, 3.3, 1.6, 40, true), Object.assign(m.white, { side: T.DoubleSide }), [0, 2.95, 0]); add(skirt, cyl(3.2, 1.0, 1.6, 32), m.metal, [0, 2.95, 0]);
    const j2 = part(root, 'j2'); add(j2, cyl(0.5, 1.02, 2.0, 32, true), Object.assign(m.dark, { side: T.DoubleSide }), [0, 1.05, 0]); add(j2, cyl(0.42, 0.5, 0.7, 20), m.metal, [0, 2.3, 0]);
    const aps = part(root, 'aps'); for (const s of [-1, 1]) { add(aps, box(0.7, 1.9, 1.0), m.white, [s * 3.6, 3.2, 0]); for (const z of [-0.3, 0.3]) add(aps, cyl(0.06, 0.12, 0.25, 12), m.dark, [s * 4.0, 3.2, z], [0, 0, -s * Math.PI / 2]); }
    return finish(root);
  }

  return [
    {
      id: 'opportunity', name: 'Opportunity rover', kind: 'Rover', world: 'Mars', signal: 'opportunity', build: rover,
      facts: ['185 kg', '1.6 m long, 1.5 m tall', 'Worked 2004–2018 · twin of Spirit'],
      parts: {
        solar: ['Solar arrays', 'Wings of solar cells that made up to about 900 watt-hours a day when clean. Dust settling on these panels is what finally ended the mission.'],
        mast: ['Camera mast', 'A 1.5-metre mast, about the eye height of a person. It carries Pancam, two colour cameras that see in stereo, and two Navcams used for driving.'],
        web: ['Warm electronics box', 'The insulated body. It holds the computer and batteries, kept warm through the freezing nights by heaters and a layer of aerogel.'],
        wheels: ['Wheels', 'Six aluminium wheels, 25 cm across, each with its own motor. The front and rear pairs can steer, so the rover can turn on the spot.'],
        suspension: ['Rocker-bogie suspension', 'A jointed frame with no springs. It keeps all six wheels on the ground and lets the rover climb over rocks taller than a wheel.'],
        hga: ['High-gain antenna', 'A steerable dish that pointed at Earth and sent data straight home.'],
        lga: ['Low-gain and UHF antennas', 'Two rods. One talks to Earth slowly in any direction; the other sends data up to orbiters passing overhead, which relay it home.'],
        arm: ['Robotic arm', 'An arm with a wrist of four tools: a rock grinder, a microscope camera, and two spectrometers that work out what rocks are made of.'],
        hazcam: ['Hazard cameras', 'Pairs of wide-angle cameras under the deck, front and back, that watch for rocks and drop-offs while driving.'],
      },
    },
    {
      id: 'insight', name: 'InSight lander', kind: 'Lander', world: 'Mars', signal: 'insight', build: insight,
      facts: ['358 kg', '6 m across with panels open', 'Worked 2018–2022'],
      parts: {
        solar: ['Solar arrays', 'Two round fans of solar cells, each 2.2 metres across. With no way to clean them, they slowly disappeared under dust.'],
        seis: ['Seismometer (SEIS)', 'Set on the ground by the arm and covered with a dome to keep out wind and cold. It felt 1,319 marsquakes and let scientists measure the planet’s core.'],
        hp3: ['Heat probe (HP³)', 'A self-hammering “mole” meant to dig five metres down and take the planet’s temperature. The soil would not grip it and it got only a few centimetres. The team stopped trying in January 2021.'],
        arm: ['Robotic arm', 'A 1.8-metre arm with a scoop and a camera. It lifted the instruments onto the ground, and later trickled sand over the panels to knock a little dust off.'],
        rise: ['RISE antennas', 'Two radio horns. By tracking their signal very precisely, scientists measured how much Mars wobbles as it spins, which shows the core is liquid.'],
        uhf: ['UHF antenna', 'Sent data up to orbiters passing overhead, which relayed it to Earth.'],
        twins: ['Weather sensors', 'Two small booms measuring wind and air temperature, plus a pressure sensor. InSight sent a daily Mars weather report.'],
        larri: ['Laser retroreflector', 'A small dome of eight mirrors on the deck. Like the Apollo reflectors on the Moon, it needs no power and can still bounce a laser back from a future orbiter.'],
        deck: ['Deck and body', 'The platform that carries everything, with the computer and batteries in a foil-wrapped box underneath.'],
        legs: ['Legs', 'Three legs with shock absorbers that took the bump of landing.'],
      },
    },
    {
      id: 'lm-descent', name: 'Apollo lunar module, descent stage', kind: 'Lander', world: 'Moon', signal: 'apollo-11-disc-and-plaque', build: lmDescent,
      facts: ['≈ 2,000 kg empty', '4.2 m across the body, 9.4 m across the legs', 'Six of these stand on the Moon'],
      parts: {
        body: ['Body', 'An eight-sided aluminium frame holding fuel tanks, wrapped in gold and black foil blankets to control heat. The foil is thinner than paper.'],
        deck: ['Launch platform', 'The flat top. The upper half of the lander, with the crew inside, used this stage as its launch pad and left it behind.'],
        engine: ['Descent engine', 'The first rocket engine that could be throttled up and down like a car, so the crew could hover and choose a landing spot.'],
        legs: ['Landing legs', 'Four legs with crushable honeycomb inside to absorb the landing. Each footpad is almost a metre wide so it would not sink into the dust.'],
        ladder: ['Ladder', 'Nine rungs on the front leg. The last step down to the footpad is a big one.'],
        plaque: ['Plaque', 'A stainless-steel plaque fixed between the ladder rungs, signed by the crew and the President.'],
        mesa: ['Equipment bay (MESA)', 'A fold-down shelf that held tools, sample boxes, and the television camera that showed the first step to the world.'],
      },
    },
    {
      id: 'mars-polar-lander', name: 'Mars Polar Lander', kind: 'Lander', world: 'Mars', signal: 'mars-polar-lander', build: polarLander,
      facts: ['≈ 290 kg', '3.6 m across with panels open', 'Lost on arrival, 3 Dec 1999'],
      parts: {
        legs: ['Legs and touchdown sensors', 'Each leg had a sensor to tell the computer it had landed. When the legs snapped open high above the ground, the jolt most likely looked like a landing, and the computer shut the engines off about forty metres up.'],
        engines: ['Descent engines', 'Twelve small rocket engines that fired in pulses to slow the lander for the last part of the fall.'],
        solar: ['Solar panels', 'Two wings of solar cells, to be unfolded after landing.'],
        arm: ['Robotic arm', 'A two-metre arm with a scoop, built to dig a trench and look for water ice under the soil.'],
        ssi: ['Stereo camera', 'A two-eyed camera on a mast, to photograph the landing site in 3D.'],
        met: ['Weather mast', 'A thin mast with sensors for wind, temperature and moisture near the south pole.'],
        lidar: ['LIDAR and microphone', 'A laser that would have measured dust and ice in the air. Inside it was a tiny microphone, the first meant to record sound on Mars.'],
        tega: ['Soil ovens (TEGA)', 'Eight tiny ovens that would bake scoops of soil and sniff the gases for water and carbon dioxide.'],
        mga: ['Antennas', 'A dish to talk directly to Earth and a rod to talk to an orbiter overhead. Neither was ever heard.'],
        deck: ['Deck and body', 'The platform carrying the instruments, with the computer underneath.'],
      },
    },
    {
      id: 'lrrr', name: 'Laser ranging retroreflector', kind: 'Instrument', world: 'Moon', signal: 'retroreflectors', build: lrrr,
      facts: ['46 cm square panel', 'No power, no moving parts', 'Placed 21 Jul 1969 · still in use'],
      parts: {
        array: ['Prism array', 'One hundred glass prisms, each 3.8 cm across and shaped like the corner of a cube. Any light that goes in comes straight back out the way it came.'],
        pallet: ['Pallet and legs', 'An aluminium tray that holds the panel tilted so that it faces Earth.'],
        aim: ['Aiming handle', 'The astronaut used a little sundial and a bubble level on this handle to point the panel correctly by hand.'],
      },
    },
    {
      id: 's-ivb', name: 'Saturn V third stage (S-IVB)', kind: 'Rocket stage', world: 'Moon', signal: 'apollo-13-s-ivb', build: sivb,
      facts: ['≈ 14,000 kg at impact', '17.8 m long, 6.6 m across', 'Five were crashed into the Moon on purpose'],
      parts: {
        tanks: ['Fuel tanks', 'A huge tank of liquid hydrogen above a smaller tank of liquid oxygen, sharing one insulated wall between them.'],
        j2: ['J-2 engine', 'A single engine that could be restarted in space. It fired once to reach Earth orbit and again to send the crew toward the Moon.'],
        iu: ['Instrument unit', 'A ring of computers and gyroscopes that steered the whole Saturn V rocket from launch.'],
        aps: ['Steering thrusters', 'Two pods of small thrusters that kept the stage pointed. After the crew left, they helped aim the empty stage at the Moon.'],
        skirt: ['Aft skirt', 'The ring that joined this stage to the one below it, and the cone that carries the engine’s push into the tanks.'],
      },
    },
  ];
})();

// A small reflection environment so metal and foil have something to reflect. top/bottom are CSS colours.
function ENV(renderer, top, bottom) {
  const T = THREE, s = new T.Scene(), c = document.createElement('canvas'); c.width = 8; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  s.add(new T.Mesh(new T.SphereGeometry(50, 16, 8), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.BackSide })));
  const lamp = new T.Mesh(new T.BoxGeometry(18, 18, 1), new T.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(20, 30, 25); lamp.lookAt(0, 0, 0); s.add(lamp);
  const p = new T.PMREMGenerator(renderer), tex = p.fromScene(s, 0.04).texture; p.dispose(); return tex;
}

// ───────── NASA's own models ─────────
// Loaded at runtime from NASA's public 3D Resources repository (github.com/nasa/NASA-3D-Resources).
// `rules` sort a model's meshes into parts: [test, partKey], first match wins. A test is a RegExp run
// against the mesh's own name and its ancestors' names joined by "|", or a function (names, centre).
const NASA_3D = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/';
function loadNASA(path, done, fail) {
  if (!THREE.GLTFLoader) return fail && fail();
  if (!loadNASA.loader) {
    const d = new THREE.DRACOLoader(); d.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/gltf/');
    loadNASA.loader = new THREE.GLTFLoader(); loadNASA.loader.setDRACOLoader(d);
  }
  loadNASA.loader.load(NASA_3D + encodeURI(path), g => done(g.scene), undefined, () => fail && fail());
}

MODELS.find(m => m.id === 'insight').glb = 'InSight Cruise Lander/InSight Cruise Lander (arm deployed).glb';
Object.assign(MODELS.find(m => m.id === 'insight'), {
  rules: [[/panel/, 'solar'], [/SEIS|WTS/, 'seis'], [/HP3/, 'hp3'], [/ICC/, 'icc'], [/arm_|claw|grapple|shovel|IDC|knob|cable/, 'arm'], [/leg_/, 'legs'], [/RISE/, 'rise'], [/UHF/, 'uhf'], [/TWINS|pressure/, 'twins'], [/deck/, 'deck']],
});
MODELS.find(m => m.id === 'insight').parts.icc = ['Deck camera', 'A wide-angle camera under the edge of the deck. It watched the patch of ground where the instruments were set down.'];
MODELS.find(m => m.id === 'insight').parts.other = ['Deck equipment', 'Electronics boxes, cable reels and the cradles that held the instruments during the flight to Mars.'];

Object.assign(MODELS.find(m => m.id === 'lm-descent'), {
  name: 'Apollo lunar module', glb: 'Apollo Lunar Module/Apollo Lunar Module.glb',
  facts: ['≈ 15,000 kg fuelled', '7 m tall, 9.4 m across the legs', 'Six descent stages still stand on the Moon'],
  rules: [[/group31/, 'legs'], [/(^|\|)polySurfa1( |\||$)/, 'ladder'], [(n, c) => c.y < 2.45, 'body'], [() => true, 'ascent']],
});
Object.assign(MODELS.find(m => m.id === 'lm-descent').parts, {
  ascent: ['Ascent stage', 'The crew cabin, with its own small engine. Two astronauts stood inside to fly it. It lifted off from the Moon using the lower half as a launch pad, and was thrown away after the crew moved back to the mother ship.'],
  body: ['Descent stage', 'The lower half: fuel tanks and the landing engine, wrapped in gold and black foil thinner than paper. This is the part that stayed. Six of them are still standing on the Moon.'],
});

MODELS.unshift(
  {
    id: 'perseverance', name: 'Perseverance rover', kind: 'Rover', world: 'Mars', signal: 'perseverance-backshell',
    glb: 'Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.glb',
    facts: ['1,025 kg', '3 m long, 2.2 m tall', 'Landed 18 Feb 2021 in Jezero Crater'],
    rules: [[/Wheels/, 'wheels'], [/suspension/, 'suspension'], [/rtg/, 'rtg'], [/antenna_hg/, 'hga'], [/antenna_(uhf|lg)/, 'lga'], [/hazcams/, 'hazcam'], [/RIMFAX/, 'rimfax'], [/Name_Chips/, 'names'], [/calibration/, 'cal'], [/Look_Camera/, 'edl'], [/Mastcam|NavCams|head|microphones|lens|pan_end/, 'mast'], [/arm|turret|drill|PIXL|WATSON|hinge/, 'arm'], [() => true, 'body']],
    parts: {
      mast: ['Camera mast', 'The rover’s head. Mastcam-Z is a pair of zoom cameras that see in 3D, and SuperCam fires a laser at rocks up to seven metres away to find out what they are made of. A microphone here recorded the first sounds from Mars.'],
      arm: ['Robotic arm and drill', 'A 2.1-metre arm with a 45-kilogram turret of tools on the end. Its drill cuts out cores of rock the size of a piece of chalk and seals them in tubes for a future mission to bring home.'],
      rtg: ['Nuclear power source', 'Instead of solar panels, Perseverance carries a generator that turns the heat of decaying plutonium into about 110 watts of electricity. Dust cannot switch it off.'],
      wheels: ['Wheels', 'Six aluminium wheels, 52.5 cm across, with curved titanium spokes that act as springs.'],
      suspension: ['Rocker-bogie suspension', 'A jointed frame with no springs that keeps all six wheels on the ground over rocks.'],
      hga: ['High-gain antenna', 'A steerable six-sided antenna that sends data straight to Earth.'],
      lga: ['UHF and low-gain antennas', 'Most pictures go up to orbiters passing overhead through the UHF antenna, and the orbiters relay them home.'],
      hazcam: ['Hazard cameras', 'Six cameras low on the body, front and back, that watch for rocks and trenches while driving.'],
      rimfax: ['Ground radar (RIMFAX)', 'A radar that looks up to ten metres under the surface to map buried layers of rock and ice.'],
      names: ['Name chips', 'Three fingernail-sized silicon chips etched with the names of 10.9 million people who signed up to send their name to Mars.'],
      cal: ['Calibration targets', 'Colour swatches and material samples the cameras look at to check that their colours are true.'],
      edl: ['Landing cameras', 'Cameras that filmed the landing itself: the parachute opening above and the ground rushing up below.'],
      body: ['Body', 'A warm box that protects the computers and batteries. The equipment that stores the rock samples is in its belly.'],
    },
  },
  {
    id: 'ingenuity', name: 'Ingenuity helicopter', kind: 'Helicopter', world: 'Mars', signal: 'ingenuity',
    glb: 'Ingenuity Mars Helicopter/Ingenuity Mars Helicopter.glb',
    facts: ['1.8 kg', '0.49 m tall, rotors 1.2 m across', '72 flights, 2021–2024'],
    rules: [[/rotors/, 'rotors'], [/solar_panel/, 'solar'], [/leg_/, 'legs'], [/cams/, 'cams'], [/bus/, 'bus'], [() => true, 'mast']],
    parts: {
      rotors: ['Rotors', 'Two carbon-fibre rotors, one above the other, spinning in opposite directions at about 2,400 turns a minute. That is several times faster than a helicopter on Earth, because Mars’s air is so thin.'],
      solar: ['Solar panel', 'A small panel above the rotors that charged six lithium-ion batteries, enough for one flight of up to about three minutes a day.'],
      bus: ['Body', 'A tissue-box-sized cube holding the batteries, heaters, sensors and a computer built around a mobile-phone processor.'],
      cams: ['Cameras', 'A black-and-white camera pointing straight down, which the helicopter used to track the ground and steer, and a colour camera for pictures of the terrain.'],
      legs: ['Legs', 'Four springy carbon-fibre legs that took the bump of each landing.'],
      mast: ['Mast and antenna', 'The mast carries the rotor mechanism and wiring. A small antenna on top talked to the rover by radio.'],
    },
  },
);
MODELS.push(
  {
    id: 'lro', name: 'Lunar Reconnaissance Orbiter', kind: 'Not discarded · the satellite that photographs what we left', world: 'Moon orbit', signal: null,
    glb: 'Lunar Reconnaissance Orbiter (B)/Lunar Reconnaissance Orbiter (B).glb',
    facts: ['1,916 kg at launch', 'Launched 18 Jun 2009', 'Still working: it photographed the Apollo sites'],
    rules: [[/dish/, 'hga'], [/panel/, 'solar'], [/foil/, 'foil'], [() => true, 'bus']],
    parts: {
      hga: ['High-gain antenna', 'A dish on a boom that stays pointed at Earth to send home the pictures and maps.'],
      solar: ['Solar array', 'A three-panel wing that turns to follow the Sun.'],
      foil: ['Thermal blankets', 'Layers of shiny foil that keep the spacecraft from getting too hot in sunlight or too cold in shadow.'],
      bus: ['Body and instruments', 'Seven instruments, including the camera that photographed the Apollo landing sites, the astronauts’ footpaths, and the craters made by the rocket stages in this collection.'],
    },
  },
  {
    id: 'odyssey', name: 'Mars Odyssey', kind: 'Not discarded · the satellite that carried the rovers’ words home', world: 'Mars orbit', signal: null,
    glb: 'Mars Odyssey/Mars Odyssey.glb',
    facts: ['725 kg at launch', 'Launched 7 Apr 2001', 'The longest-working spacecraft at Mars'],
    rules: [[/boom/, 'boom'], [/panel/, 'solar'], [/foil/, 'foil'], [() => true, 'bus']],
    parts: {
      boom: ['Gamma-ray spectrometer boom', 'A six-metre boom that holds a sensor away from the spacecraft’s own radiation. In 2002 it found hydrogen just under the surface near the poles: buried water ice.'],
      solar: ['Solar array', 'The wing of solar cells that powers the spacecraft.'],
      foil: ['Thermal blankets', 'Gold and silver foil that controls the spacecraft’s temperature.'],
      bus: ['Body and antenna', 'The body carries the computers, a heat-sensing camera, and the dish antenna. For years it relayed most of the data sent up by Spirit and Opportunity.'],
    },
  },
);

// Year each machine arrived (or, for the rocket stage, hit). The 3D bay groups by world, then orders by this.
for (const [id, year] of Object.entries({ 'lm-descent': 1969, lrrr: 1969, 's-ivb': 1970, lro: 2009, 'mars-polar-lander': 1999, odyssey: 2001, opportunity: 2004, insight: 2018, perseverance: 2021, ingenuity: 2021 })) MODELS.find(m => m.id === id).year = year;
MODELS.sort((a, b) => a.year - b.year);
