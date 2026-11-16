// ============================================================================
//  Trang 1 — Hệ Mặt Trời & tiểu hành tinh gần Trái Đất (NEO)
// ----------------------------------------------------------------------------
//  Tối ưu hiệu năng so với bản cũ:
//   • 39.529 NEO vẽ bằng MỘT đối tượng THREE.Points (1 lệnh vẽ) thay vì 39.529 Mesh
//     + 79.058 đường quỹ đạo 600 điểm (≈ 80.000 lệnh vẽ, ~47 triệu đỉnh).
//   • Phương trình Kepler giải trên mảng typed, khởi động "ấm" từ nghiệm khung trước
//     ⇒ 1–2 vòng Newton/thiên thể/khung hình (~1–2 ms cho toàn bộ).
//   • Bỏ OutlinePass, UnrealBloom và bóng đổ cube-map (7+ lần render cảnh mỗi khung).
//   • Chọn/rê chuột NEO bằng phép chiếu màn hình thay cho raycast trên 40k mesh.
//  Đúng khoa học hơn:
//   • Hành tinh chạy theo lịch JPL (Standish) — cùng thời gian, cùng thang AU với NEO.
//   • Toạ độ hoàng đạo → three.js bằng phép quay thuần (bản cũ bị lật gương).
// ============================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  AU_KM, DEG, TWO_PI, GM_SUN, mjdToDate, dateToMJD, meanMotionRadPerDay, solveKepler,
  perifocalBasis, positionFromE, orbitPoints, planetElementsAt, planetPosition,
  NEO_CLASSES, classifyNEO, albedoFromSlope, diameterFromH, periodYears,
} from '../lib/orbit.js';
import * as fmt from '../lib/format.js';
import { initBuddy } from '../mascot/buddy.js';
import { adaptiveQuality } from '../lib/perf.js';
import { mountTopbar, initModals, initTooltips, initRanges, paintRange, initCollapsibles, loader as makeLoader, fetchWithProgress, toast } from '../lib/ui.js';

import bg1 from '../images/1.jpg';
import bg2 from '../images/2.jpg';
import bg3 from '../images/3.jpg';
import bg4 from '../images/4.jpg';
import sunTex from '../images/sun.jpg';
import mercuryTex from '../images/mercurymap.jpg';
import mercuryBump from '../images/mercurybump.jpg';
import venusTex from '../images/venusmap.jpg';
import venusAtmo from '../images/venus_atmosphere.jpg';
import earthDay from '../images/earth_day_4k.jpg';
import earthNight from '../images/earth_night_4k.jpg';
import earthSpec from '../images/earth_specularmap.jpg';
import earthClouds from '../images/earth_atmosphere.jpg';
import moonTex from '../images/moonmap.jpg';
import moonBump from '../images/moonbump.jpg';
import marsTex from '../images/marsmap.jpg';
import marsBump from '../images/marsbump.jpg';
import jupiterTex from '../images/jupiter.jpg';
import ioTex from '../images/jupiterIo.jpg';
import europaTex from '../images/jupiterEuropa.jpg';
import ganymedeTex from '../images/jupiterGanymede.jpg';
import callistoTex from '../images/jupiterCallisto.jpg';
import saturnTex from '../images/saturnmap.jpg';
import saturnRingTex from '../images/saturn_ring.png';
import uranusTex from '../images/uranus.jpg';
import uranusRingTex from '../images/uranus_ring.png';
import neptuneTex from '../images/neptune.jpg';
import plutoTex from '../images/plutomap.jpg';
import plutoBump from '../images/plutobump2k.jpg';

mountTopbar('solar', `<button type="button" class="hbtn" id="homeBtn" title="Về toàn cảnh (H)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span class="lbl">Toàn cảnh</span></button>`, {
  question: 'Vì sao một số tiểu hành tinh cần được theo dõi?',
  help: `<ul class="about-list">
  <li><span>🖱</span><div><b>Xoay · thu phóng:</b> kéo chuột để xoay, cuộn để phóng to; nhấp vào hành tinh hoặc một chấm sáng (tiểu hành tinh) để xem chi tiết và bay tới đó.</div></li>
  <li><span>🔎</span><div><b>Tìm kiếm:</b> gõ tên hoặc ký hiệu (Apophis, Bennu, 2024 YR4…) — phím <kbd>/</kbd>.</div></li>
  <li><span>🎨</span><div><b>Lọc & tô màu:</b> bật/tắt từng nhóm quỹ đạo, chỉ xem danh sách rủi ro ESA, lọc theo đường kính; tô màu theo nhóm, kích thước hoặc thang Palermo.</div></li>
  <li><span>⏱</span><div><b>Thời gian:</b> <kbd>Space</kbd> phát/dừng, <kbd>←</kbd> <kbd>→</kbd> đổi tốc độ (có thể tua ngược), nút "Hôm nay" về thời điểm thực.</div></li>
  <li><span>☄</span><div><b>Nối sang hai vai trò:</b> trong bảng chi tiết, "Nếu va chạm?" mở Destroyer, "Làm lệch hướng" mở Defender với đúng kích thước và vận tốc của vật thể.</div></li>
  <li><span>⌂</span><div><kbd>H</kbd> về toàn cảnh · <kbd>Esc</kbd> bỏ chọn · <kbd>?</kbd> mở hướng dẫn này.</div></li>
</ul>`,
});
initModals();
initTooltips();
initRanges();
initCollapsibles();
const load = makeLoader();

// ---------------------------------------------------------------------------
//  Thang đo cảnh: 1 AU = 150 đơn vị
// ---------------------------------------------------------------------------
const AU = 150;
const EARTH_VIS_R = 2.4;                         // bán kính hiển thị của Trái Đất (×1)
const visRadius = km => EARTH_VIS_R * Math.pow(km / 6371, 0.55); // nén logarit nhẹ cho hành tinh khí khổng lồ

// ---------------------------------------------------------------------------
//  Renderer, camera, điều khiển
// ---------------------------------------------------------------------------
const host = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
Object.assign(labelRenderer.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 5 });
document.body.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.2, 60000);
const HOME = { pos: new THREE.Vector3(-170, 230, 330), target: new THREE.Vector3(0, 0, 0) };
camera.position.copy(HOME.pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.5;
controls.maxDistance = 25000;
controls.zoomSpeed = 1.2;

const texLoader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const tex = (url, srgb = true) => {
  const t = texLoader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
};

const cube = new THREE.CubeTextureLoader().load([bg3, bg1, bg2, bg2, bg4, bg2]);
cube.colorSpace = THREE.SRGBColorSpace;
scene.background = cube;
scene.backgroundIntensity = 0.28; // ảnh nền 1024 px chỉ làm lớp tinh vân mờ phía sau

// Trường sao vẽ bằng điểm ảnh: sắc nét ở mọi độ phân giải màn hình (thay cho ảnh nền bị nhoè)
const stars = (() => {
  const N = 9000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    // dày hơn quanh một dải nghiêng (gợi Ngân Hà)
    const band = Math.random() < 0.45 ? 0.25 : 1;
    pos.set([r * Math.cos(th), u * band, r * Math.sin(th)].map(v => v * 20000), i * 3);
    const mag = Math.pow(Math.random(), 3.2);
    c.setHSL(0.55 + (Math.random() - 0.5) * 0.25, 0.35 + Math.random() * 0.3, 0.6 + 0.4 * mag).toArray(col, i * 3);
    size[i] = 0.8 + mag * 2.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uPixel: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; uniform float uPixel; varying vec3 vC;
      void main(){ vC = aColor; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPixel; }`,
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, smoothstep(0.5, 0.1, d)); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -1;
  scene.add(pts);
  return pts;
})();

scene.add(new THREE.AmbientLight(0xffffff, 0.12));
const sunLight = new THREE.PointLight(0xfff4e0, 2.6, 0, 0); // decay 0: chiếu sáng đều mọi khoảng cách
scene.add(sunLight);

// ---------------------------------------------------------------------------
//  Mặt Trời + quầng sáng (sprite cộng màu thay cho UnrealBloom)
// ---------------------------------------------------------------------------
function radialTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SUN_R = 9;
const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), new THREE.MeshBasicMaterial({ map: tex(sunTex), color: new THREE.Color(1.35, 1.2, 1.0) }));
sun.userData = { kind: 'sun', key: 'Sun' };
scene.add(sun);
const glowTex = radialTexture([[0, 'rgba(255,240,200,1)'], [0.15, 'rgba(255,200,120,0.55)'], [0.4, 'rgba(255,140,60,0.12)'], [1, 'rgba(255,120,40,0)']]);
for (const [s, o] of [[70, 0.9], [190, 0.35]]) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: o }));
  sp.scale.setScalar(s); sun.add(sp);
}

// ---------------------------------------------------------------------------
//  Hành tinh
// ---------------------------------------------------------------------------
const PLANETS = [
  { key: 'Mercury', vn: 'Sao Thủy', R: 2439.7, rotH: 1407.6, tilt: 0.034, map: mercuryTex, bump: mercuryBump, moons: '0',
    desc: 'Hành tinh nhỏ nhất và gần Mặt Trời nhất; nhiệt độ bề mặt dao động từ −180 °C đến 430 °C.' },
  { key: 'Venus', vn: 'Sao Kim', R: 6051.8, rotH: 5832.5, tilt: 177.4, map: venusTex, atmo: venusAtmo, moons: '0',
    desc: 'Khí quyển CO₂ dày gây hiệu ứng nhà kính mạnh nhất Hệ Mặt Trời (~465 °C). Tự quay ngược chiều.' },
  { key: 'Earth', vn: 'Trái Đất', R: 6371, rotH: 23.934, tilt: 23.44, moons: '1 (Mặt Trăng)', earth: true,
    desc: 'Hành tinh duy nhất được biết có sự sống. Quỹ đạo của nó là mốc để phân loại NEO.' },
  { key: 'Mars', vn: 'Sao Hỏa', R: 3389.5, rotH: 24.623, tilt: 25.19, map: marsTex, bump: marsBump, moons: '2 (Phobos, Deimos)',
    desc: '"Hành tinh đỏ" do oxit sắt trên bề mặt; có ngọn núi lửa Olympus Mons cao ~22 km.' },
  { key: 'Jupiter', vn: 'Sao Mộc', R: 69911, rotH: 9.925, tilt: 3.13, map: jupiterTex, moons: 'hơn 90',
    desc: 'Hành tinh lớn nhất; lực hấp dẫn của nó tạo ra các "khe Kirkwood" trong vành đai tiểu hành tinh và đẩy nhiều vật thể vào quỹ đạo gần Trái Đất.' },
  { key: 'Saturn', vn: 'Sao Thổ', R: 58232, rotH: 10.656, tilt: 26.73, map: saturnTex, ring: { tex: saturnRingTex, outer: 2.3, inner: 0.6 }, moons: 'hơn 270',
    desc: 'Nổi tiếng với hệ vành đai băng đá rộng ~280.000 km nhưng chỉ dày vài chục mét.' },
  { key: 'Uranus', vn: 'Sao Thiên Vương', R: 25362, rotH: 17.24, tilt: 97.77, map: uranusTex, ring: { tex: uranusRingTex, outer: 2.0, inner: 0.75 }, moons: '29',
    desc: 'Trục quay nghiêng gần 98° — hành tinh "lăn" trên quỹ đạo của mình.' },
  { key: 'Neptune', vn: 'Sao Hải Vương', R: 24622, rotH: 16.11, tilt: 28.32, map: neptuneTex, moons: '16',
    desc: 'Có gió mạnh nhất Hệ Mặt Trời (~2.100 km/h). Được tìm ra nhờ tính toán toán học năm 1846.' },
  { key: 'Pluto', vn: 'Sao Diêm Vương', R: 1188.3, rotH: 153.29, tilt: 122.53, map: plutoTex, bump: plutoBump, moons: '5 (Charon, Styx, Nix, Kerberos, Hydra)',
    desc: 'Hành tinh lùn ở vành đai Kuiper; được xếp lại từ "hành tinh" thành "hành tinh lùn" năm 2006.' },
];

const pickables = [];          // mesh có thể nhấp chọn
const planetByKey = {};
const planetOrbitGroup = new THREE.Group();
scene.add(planetOrbitGroup);
const tmp3 = [0, 0, 0];

function makeEarthMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: tex(earthDay) }, nightMap: { value: tex(earthNight) }, specMap: { value: tex(earthSpec, false) } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vSun; varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vSun = normalize(-wp.xyz);              // Mặt Trời ở gốc toạ độ
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D dayMap, nightMap, specMap;
      varying vec2 vUv; varying vec3 vN; varying vec3 vSun; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN);
        float d = dot(n, vSun);
        float dayMix = smoothstep(-0.12, 0.18, d);              // vùng chạng vạng mềm
        vec3 day = texture2D(dayMap, vUv).rgb * (0.12 + 1.05 * max(d, 0.0));
        vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.6, 1.35, 1.0);
        vec3 col = mix(night, day, dayMix);
        float spec = texture2D(specMap, vUv).r;                 // phản xạ đại dương
        vec3 h = normalize(vSun + normalize(vView));
        col += spec * pow(max(dot(n, h), 0.0), 64.0) * 0.28 * dayMix;
        float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
        col += vec3(0.25, 0.55, 1.0) * rim * 0.6 * (0.25 + dayMix);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function atmosphereShell(radius, color, power = 2.5, strength = 1) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 48, 32), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, s: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vS;
      void main(){ vec4 wp = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-wp.xyz); vS = normalize(-wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 c; uniform float p; uniform float s; varying vec3 vN; varying vec3 vV; varying vec3 vS;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), p); float lit = smoothstep(-0.3, 0.4, dot(normalize(vN), vS));
        gl_FragColor = vec4(c, f * s * (0.15 + 0.85*lit)); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  }));
}

function makeLabel(text, cls, onClick) {
  const el = document.createElement('div');
  el.className = cls; el.textContent = text;
  if (onClick) el.addEventListener('pointerdown', e => { e.stopPropagation(); onClick(); });
  return new CSS2DObject(el);
}

for (const def of PLANETS) {
  const r = visRadius(def.R);
  const group = new THREE.Group();           // vị trí nhật tâm
  const tiltGroup = new THREE.Group();       // nghiêng trục quay so với pháp tuyến hoàng đạo
  tiltGroup.rotation.z = -def.tilt * DEG;
  group.add(tiltGroup);
  const scaleGroup = new THREE.Group();      // nhận hệ số phóng đại người dùng chọn
  tiltGroup.add(scaleGroup);

  const material = def.earth ? makeEarthMaterial() : new THREE.MeshStandardMaterial({
    map: tex(def.map), roughness: 1, metalness: 0,
    ...(def.bump ? { bumpMap: tex(def.bump, false), bumpScale: 1.2 } : {}),
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), material);
  mesh.userData = { kind: 'planet', key: def.key };
  scaleGroup.add(mesh);
  pickables.push(mesh);

  if (def.earth) {
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, 64, 40), new THREE.MeshStandardMaterial({
      color: 0xffffff, alphaMap: tex(earthClouds, false), transparent: true, depthWrite: false, opacity: 0.85, roughness: 1,
    }));
    scaleGroup.add(clouds);
    def.clouds = clouds;
    scaleGroup.add(atmosphereShell(r, 0x4da6ff, 2.6, 1.4));
  }
  if (def.atmo) {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(r * 1.01, 48, 32), new THREE.MeshStandardMaterial({ map: tex(def.atmo), transparent: true, opacity: 0.55, depthWrite: false }));
    scaleGroup.add(shell);
    scaleGroup.add(atmosphereShell(r, 0xffd59e, 3, 0.8));
  }
  if (def.ring) {
    // Ảnh vành đai là ảnh nhìn từ trên xuống ⇒ dùng UV phẳng mặc định của RingGeometry
    const outer = r * def.ring.outer;
    const ring = new THREE.Mesh(new THREE.RingGeometry(outer * def.ring.inner, outer, 160, 1), new THREE.MeshStandardMaterial({
      map: tex(def.ring.tex), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1,
    }));
    ring.rotation.x = -Math.PI / 2;
    scaleGroup.add(ring);
  }

  const label = makeLabel(def.vn, 'p-label', () => select({ kind: 'planet', key: def.key }));
  label.position.set(0, r * 1.25, 0);
  scaleGroup.add(label);

  scene.add(group);
  Object.assign(def, { r, group, tiltGroup, scaleGroup, mesh, label, spin: 0, moonsList: [] });
  planetByKey[def.key] = def;
}

// Quỹ đạo hành tinh (tính từ yếu tố JPL tại thời điểm hiện tại)
function buildPlanetOrbits(mjd) {
  planetOrbitGroup.clear();
  for (const def of PLANETS) {
    const el = planetElementsAt(def.key, mjd);
    const pts = orbitPoints(el.a, el.e, perifocalBasis(el.i, el.node, el.peri), 360, AU);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const isEarth = def.key === 'Earth';
    planetOrbitGroup.add(new THREE.LineLoop(g, new THREE.LineBasicMaterial({
      color: isEarth ? 0x5ee7ff : 0x9fb0d8, transparent: true, opacity: isEarth ? 0.55 : 0.16, depthWrite: false,
    })));
  }
}

// ---------------------------------------------------------------------------
//  Vệ tinh tự nhiên (chu kỳ thật, khoảng cách hiển thị)
// ---------------------------------------------------------------------------
function addMoon(planetKey, { name, R, periodD, dist, incl = 0, texUrl, bump, model }) {
  const p = planetByKey[planetKey];
  const pivot = new THREE.Group();
  pivot.rotation.x = incl * DEG;
  const parent = planetKey === 'Earth' ? new THREE.Group() : p.scaleGroup; // Mặt Trăng: mặt phẳng gần hoàng đạo
  if (planetKey === 'Earth') { p.group.add(parent); p.earthMoonFrame = parent; }
  parent.add(pivot);
  const holder = new THREE.Group();
  holder.position.x = dist * p.r;
  pivot.add(holder);
  const vr = visRadius(R);
  if (model) {
    new GLTFLoader().load(model, gltf => {
      const obj = gltf.scene;
      const sph = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
      obj.scale.setScalar(Math.max(0.12, vr) / (sph.radius || 1));
      obj.traverse(n => { if (n.isMesh) n.material.roughness = 1; });
      holder.add(obj);
    });
  } else {
    holder.add(new THREE.Mesh(new THREE.SphereGeometry(vr, 32, 20), new THREE.MeshStandardMaterial({
      map: tex(texUrl), roughness: 1, ...(bump ? { bumpMap: tex(bump, false), bumpScale: 1 } : {}),
    })));
  }
  p.moonsList.push({ name, pivot, periodD, angle: Math.random() * TWO_PI });
}
addMoon('Earth', { name: 'Mặt Trăng', R: 1737.4, periodD: 27.322, dist: 2.7, incl: 5.14, texUrl: moonTex, bump: moonBump });
addMoon('Mars', { name: 'Phobos', R: 400, periodD: 0.319, dist: 1.7, model: './models/phobos.glb' });
addMoon('Mars', { name: 'Deimos', R: 300, periodD: 1.263, dist: 2.5, model: './models/deimos.glb' });
addMoon('Jupiter', { name: 'Io', R: 1821.6, periodD: 1.769, dist: 1.55, texUrl: ioTex });
addMoon('Jupiter', { name: 'Europa', R: 1560.8, periodD: 3.551, dist: 1.95, texUrl: europaTex });
addMoon('Jupiter', { name: 'Ganymede', R: 2634.1, periodD: 7.155, dist: 2.45, texUrl: ganymedeTex });
addMoon('Jupiter', { name: 'Callisto', R: 2410.3, periodD: 16.689, dist: 3.05, texUrl: callistoTex });

// ---------------------------------------------------------------------------
//  Thời gian mô phỏng
// ---------------------------------------------------------------------------
const RATES = [-365, -90, -30, -7, -1, 1 / 86400, 1 / 24, 1, 7, 30, 90, 365]; // ngày mô phỏng / giây thực
const time = { mjd: dateToMJD(new Date()), rateIdx: 8, playing: true };
const rateNow = () => (time.playing ? RATES[time.rateIdx] : 0);
function rateText(r) {
  const a = Math.abs(r), dir = r < 0 ? 'lùi ' : '';
  if (a < 1 / 3600) return `${dir}thời gian thực`;
  if (a < 1) return `${dir}${fmt.num(a * 24)} giờ / giây`;
  if (a >= 365) return `${dir}${fmt.num(a / 365.25, 1)} năm / giây`;
  return `${dir}${fmt.num(a)} ngày / giây`;
}

// ---------------------------------------------------------------------------
//  Dữ liệu NEO
// ---------------------------------------------------------------------------
const NEO = { N: 0 };
const neoPoints = new THREE.Points(new THREE.BufferGeometry(), null);
neoPoints.frustumCulled = false;
scene.add(neoPoints);

const neoMaterial = new THREE.ShaderMaterial({
  uniforms: { uPixel: { value: renderer.getPixelRatio() }, uScale: { value: 1 } },
  vertexShader: /* glsl */`
    attribute float aSize; attribute vec3 aColor; attribute float aVisible;
    uniform float uPixel; uniform float uScale;
    varying vec3 vColor;
    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      // hơi phóng to khi lại gần để cảm nhận chiều sâu
      float near = clamp(60.0 / -mv.z, 1.0, 2.2);
      gl_PointSize = aVisible * aSize * uScale * uPixel * near;
      if (aVisible < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.15, d);
      gl_FragColor = vec4(vColor * (0.85 + 0.6 * (1.0 - d * 2.0)), a);
      #include <colorspace_fragment>
    }`,
  transparent: true, depthWrite: false,
});
neoPoints.material = neoMaterial;

const FAMOUS = {
  '99942': 'Apophis', '101955': 'Bennu', '65803': 'Didymos', '433': 'Eros', '162173': 'Ryugu', '25143': 'Itokawa',
  '3200': 'Phaethon', '4179': 'Toutatis', '1036': 'Ganymed', '29075': '1950 DA', '1862': 'Apollo', '2062': 'Aten',
  '1221': 'Amor', '163693': 'Atira', '4660': 'Nereus', '2024YR4': '2024 YR4', '1566': 'Icarus', '3122': 'Florence',
};

async function loadNEO() {
  const progress = { bin: 0, names: 0, risk: 0 };
  const upd = () => load.set(0.1 + 0.8 * (progress.bin * 0.7 + progress.names * 0.2 + progress.risk * 0.1), 'Tải dữ liệu quỹ đạo NEO (ESA)…');
  const [bin, namesTxt, riskJson] = await Promise.all([
    fetchWithProgress('./data/neo.bin', p => { progress.bin = p; upd(); }),
    fetchWithProgress('./data/neo_names.txt', p => { progress.names = p; upd(); }, 'text'),
    fetchWithProgress('./data/neo_risk.json', p => { progress.risk = p; upd(); }, 'json'),
  ]);
  load.set(0.92, 'Tính toán quỹ đạo…');
  const F = riskJson.fields.length, base = riskJson.epochBase;
  const raw = new Float32Array(bin);
  const names = namesTxt.split('\n');
  const N = names.length;
  Object.assign(NEO, {
    N, names, risk: riskJson.risk,
    a: new Float64Array(N), e: new Float64Array(N), b: new Float64Array(N), n: new Float64Array(N),
    M0: new Float64Array(N), epoch: new Float64Array(N), basis: new Float64Array(N * 6), E: new Float64Array(N),
    inc: new Float32Array(N), H: new Float32Array(N), D: new Float32Array(N), Dsrc: new Uint8Array(N), cls: new Uint8Array(N),
    elem: raw, F,
    pos: new Float32Array(N * 3), color: new Float32Array(N * 3), size: new Float32Array(N), visible: new Float32Array(N),
  });
  const basis = new Float64Array(6);
  for (let k = 0; k < N; k++) {
    const o = k * F;
    const a = raw[o], e = raw[o + 1];
    NEO.a[k] = a; NEO.e[k] = e; NEO.b[k] = a * Math.sqrt(1 - e * e);
    NEO.inc[k] = raw[o + 2];
    perifocalBasis(raw[o + 2], raw[o + 3], raw[o + 4], basis);
    NEO.basis.set(basis, k * 6);
    NEO.M0[k] = raw[o + 5] * DEG;
    NEO.epoch[k] = raw[o + 6] + base;
    NEO.n[k] = meanMotionRadPerDay(a);
    NEO.H[k] = raw[o + 7];
    const r = NEO.risk[k];
    if (r?.d) { NEO.D[k] = r.d; NEO.Dsrc[k] = 1; }
    else { NEO.D[k] = diameterFromH(raw[o + 7], albedoFromSlope(raw[o + 8])); NEO.Dsrc[k] = 0; }
    NEO.cls[k] = classifyNEO(a, e);
    NEO.E[k] = NaN;
  }
  NEO.search = names.map((nm, k) => { const lb = FAMOUS[nm] || NEO.risk[k]?.name; return { k, key: nm.toLowerCase().replace(/\s+/g, ''), label: lb != null ? String(lb) : null }; });

  const g = neoPoints.geometry;
  g.setAttribute('position', new THREE.BufferAttribute(NEO.pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(NEO.color, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(NEO.size, 1));
  g.setAttribute('aVisible', new THREE.BufferAttribute(NEO.visible, 1));
}

/** Cập nhật vị trí toàn bộ NEO tại thời điểm mjd (Kepler + khởi động ấm). */
let neoForce = true; // true ⇒ cập nhật cả vật thể đang ẩn (sau khi đổi bộ lọc)
function updateNEO(mjd, force = false) {
  const { N, a, e, b, n, M0, epoch, basis, E: Eprev, pos, visible } = NEO;
  for (let k = 0; k < N; k++) {
    if (!force && !visible[k]) continue; // vật thể bị lọc không cần tính
    const ek = e[k];
    let M = M0[k] + n[k] * (mjd - epoch[k]);
    M -= TWO_PI * Math.round(M / TWO_PI);           // về [−π, π]
    let E = Eprev[k];
    if (E !== E) E = ek < 0.8 ? M + ek * Math.sin(M) : (M >= 0 ? Math.PI : -Math.PI);
    else if (E - M > Math.PI) E -= TWO_PI; else if (M - E > Math.PI) E += TWO_PI;
    let sE = 0, cE = 1;
    for (let it = 0; it < 8; it++) {
      sE = Math.sin(E); cE = Math.cos(E);
      const d = (E - ek * sE - M) / (1 - ek * cE);
      E -= d;
      if (d < 1e-7 && d > -1e-7) break; // 1e-7 rad ≈ 15 km tại 1 AU — dư cho hiển thị
    }
    sE = Math.sin(E); cE = Math.cos(E);
    Eprev[k] = E;
    const xp = a[k] * (cE - ek) * AU, yp = b[k] * sE * AU, o = k * 6, p = k * 3;
    pos[p] = xp * basis[o] + yp * basis[o + 3];
    pos[p + 1] = xp * basis[o + 1] + yp * basis[o + 4];
    pos[p + 2] = xp * basis[o + 2] + yp * basis[o + 5];
  }
  neoPoints.geometry.attributes.position.needsUpdate = true;
}

// --- Màu & kích thước -------------------------------------------------------
const filters = { classes: [true, true, true, true, true], riskOnly: false, minD: 0, colorMode: 'class' };
const MIN_D_STEPS = [0, 10, 50, 140, 500, 1000];
const SIZE_RAMP = [[1, '#3b4cc0'], [1.7, '#5ee7ff'], [2.15, '#9dfc8a'], [2.6, '#ffd15c'], [3.2, '#ff7a45'], [4, '#ff3b6b']]; // log10(D m)
const RISK_STEPS = [
  { min: -2, color: '#ff3b6b', label: 'Palermo ≥ −2 (đáng theo dõi)' },
  { min: -3, color: '#ff9f43', label: '−3 ≤ Palermo < −2' },
  { min: -5, color: '#ffd15c', label: '−5 ≤ Palermo < −3' },
  { min: -Infinity, color: '#5cc8ff', label: 'Palermo < −5 (rất thấp)' },
];
const c3 = new THREE.Color();
function rampColor(x) {
  if (x <= SIZE_RAMP[0][0]) return c3.set(SIZE_RAMP[0][1]);
  for (let i = 1; i < SIZE_RAMP.length; i++) {
    if (x <= SIZE_RAMP[i][0]) {
      const [x0, a] = SIZE_RAMP[i - 1], [x1, b] = SIZE_RAMP[i];
      return c3.set(a).lerp(new THREE.Color(b), (x - x0) / (x1 - x0));
    }
  }
  return c3.set(SIZE_RAMP.at(-1)[1]);
}
const classColors = NEO_CLASSES.map(c => new THREE.Color(c.color));
const riskColor = ps => RISK_STEPS.find(s => ps >= s.min).color;

function applyStyle() {
  const { N, color, size, D, cls, risk } = NEO;
  const mode = filters.colorMode;
  for (let k = 0; k < N; k++) {
    const r = risk[k];
    let col;
    if (mode === 'class') col = classColors[cls[k]];
    else if (mode === 'size') col = rampColor(Math.log10(Math.max(1, D[k])));
    else col = r ? c3.set(riskColor(r.psMax ?? -10)) : c3.setRGB(0.17, 0.2, 0.27);
    color[k * 3] = col.r; color[k * 3 + 1] = col.g; color[k * 3 + 2] = col.b;
    let s = THREE.MathUtils.clamp(1.4 + 1.15 * Math.log10(Math.max(1, D[k]) / 10), 1.4, 7);
    if (mode === 'risk' && r) s += 1.2;
    size[k] = s;
  }
  neoPoints.geometry.attributes.aColor.needsUpdate = true;
  neoPoints.geometry.attributes.aSize.needsUpdate = true;
  renderLegend();
}

function applyFilters() {
  const { N, visible, cls, D, risk } = NEO;
  const minD = MIN_D_STEPS[filters.minD];
  let count = 0;
  for (let k = 0; k < N; k++) {
    const ok = !!(filters.classes[cls[k]] && (!filters.riskOnly || risk[k]) && (D[k] >= minD || (!Number.isFinite(D[k]) && minD === 0)));
    visible[k] = ok ? 1 : 0;
    count += ok;
  }
  neoPoints.geometry.attributes.aVisible.needsUpdate = true;
  neoForce = true;
  document.getElementById('neoCount').textContent = `Hiển thị ${fmt.num(count)} / ${fmt.num(N)} vật thể`;
  if (document.getElementById('tOrbits').checked) buildFilteredOrbits();
}

// --- Quỹ đạo của các NEO đang lọc (gộp thành 1 LineSegments) ----------------
const ORBIT_CAP = 1500, ORBIT_SEG = 96;
let filteredOrbits = null;
function buildFilteredOrbits() {
  if (filteredOrbits) { scene.remove(filteredOrbits); filteredOrbits.geometry.dispose(); filteredOrbits = null; }
  if (!document.getElementById('tOrbits').checked) return;
  const ids = [];
  for (let k = 0; k < NEO.N; k++) if (NEO.visible[k]) ids.push(k);
  // ưu tiên vật thể trong danh sách rủi ro, sau đó vật thể lớn
  ids.sort((x, y) => (!!NEO.risk[y] - !!NEO.risk[x]) || (NEO.D[y] - NEO.D[x]));
  const sel = ids.slice(0, ORBIT_CAP);
  const P = new Float32Array(sel.length * ORBIT_SEG * 3), C = new Float32Array(sel.length * ORBIT_SEG * 3);
  const idx = new Uint32Array(sel.length * ORBIT_SEG * 2);
  const basis = new Float64Array(6);
  sel.forEach((k, j) => {
    for (let q = 0; q < 6; q++) basis[q] = NEO.basis[k * 6 + q];
    P.set(orbitPoints(NEO.a[k], NEO.e[k], basis, ORBIT_SEG, AU), j * ORBIT_SEG * 3);
    const col = new THREE.Color().fromArray(NEO.color, k * 3);
    for (let s = 0; s < ORBIT_SEG; s++) {
      col.toArray(C, (j * ORBIT_SEG + s) * 3);
      idx[(j * ORBIT_SEG + s) * 2] = j * ORBIT_SEG + s;
      idx[(j * ORBIT_SEG + s) * 2 + 1] = j * ORBIT_SEG + ((s + 1) % ORBIT_SEG);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  filteredOrbits = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: sel.length > 300 ? 0.12 : 0.3, depthWrite: false }));
  filteredOrbits.frustumCulled = false;
  scene.add(filteredOrbits);
  if (ids.length > ORBIT_CAP) toast('Giới hạn quỹ đạo', `Chỉ vẽ ${fmt.num(ORBIT_CAP)} quỹ đạo (ưu tiên vật thể rủi ro & lớn nhất) trong ${fmt.num(ids.length)} vật thể đang lọc.`, 'info', 3500);
}

// ---------------------------------------------------------------------------
//  Chọn & theo dõi đối tượng
// ---------------------------------------------------------------------------
function ringSprite(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.strokeStyle = color; g.lineWidth = 4;
  g.beginPath(); g.arc(32, 32, 24, 0, TWO_PI); g.stroke();
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.setScalar(0.035); s.renderOrder = 10; s.visible = false;
  scene.add(s); return s;
}
const selMarker = ringSprite('#5ee7ff');
const hoverMarker = ringSprite('rgba(255,255,255,0.7)');
hoverMarker.scale.setScalar(0.028);
const selLabel = makeLabel('', 'a-label');
selMarker.add(selLabel);
let selOrbit = null;

let selected = null;      // {kind:'neo'|'planet'|'sun', k|key}
let follow = null;        // hàm trả về vị trí cần bám
let fly = null;
const lastTarget = new THREE.Vector3();

function objectPosition(sel, out = new THREE.Vector3()) {
  if (!sel) return out.set(0, 0, 0);
  if (sel.kind === 'neo') return out.fromArray(NEO.pos, sel.k * 3);
  if (sel.kind === 'planet') return planetByKey[sel.key].group.getWorldPosition(out);
  return out.set(0, 0, 0);
}

function flyTo(sel, dist) {
  const target = objectPosition(sel);
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (dir.lengthSq() < 0.5) dir.set(-0.4, 0.5, 0.75).normalize();
  fly = { t0: performance.now(), dur: 1400, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), dir, dist, sel };
  follow = () => objectPosition(sel);
  lastTarget.copy(target);
}

function select(sel, { fly: doFly = true } = {}) {
  selected = sel;
  if (selOrbit) { scene.remove(selOrbit); selOrbit.geometry.dispose(); selOrbit = null; }
  document.querySelectorAll('.p-label.hl').forEach(e => e.classList.remove('hl'));
  if (!sel) {
    selMarker.visible = false; follow = null; fly = null;
    document.getElementById('detailPanel').classList.add('hidden');
    return;
  }
  if (sel.kind === 'neo') {
    const k = sel.k, basis = NEO.basis.subarray(k * 6, k * 6 + 6);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(orbitPoints(NEO.a[k], NEO.e[k], basis, 360, AU), 3));
    selOrbit = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: NEO_CLASSES[NEO.cls[k]].color, transparent: true, opacity: 0.9 }));
    scene.add(selOrbit);
    selMarker.visible = true;
    selLabel.element.textContent = neoTitle(k);
    if (doFly) flyTo(sel, 40);
    dogReactNEO(sel.k);
    liveTimer = 1; // cập nhật số liệu trực tiếp ngay khung kế tiếp
  } else {
    selMarker.visible = false;
    if (sel.kind === 'planet') {
      const p = planetByKey[sel.key];
      p.label.element.classList.add('hl');
      if (doFly) flyTo(sel, p.r * planetScale * (p.ring ? 9 : 6) + 3);
    } else if (doFly) flyTo(sel, 60);
  }
  renderDetails();
  document.getElementById('detailPanel').classList.remove('hidden', 'm-hide');
}

// ---------------------------------------------------------------------------
//  Bảng chi tiết
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
//  Chó phi hành gia
// ---------------------------------------------------------------------------
let dog = null;
const screenOf = v => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight, p.z < 1]; };
function dogReactNEO(k) {
  if (!dog || dog.muted) return;
  const r = NEO.risk[k], cls = NEO_CLASSES[NEO.cls[k]];
  const line = r
    ? `${neoTitle(k)}: xác suất va chạm ${r.ipMax ? '1/' + fmt.num(1 / r.ipMax) : 'rất nhỏ'}, Palermo ${fmt.num(r.psMax, 2)}.`
    : `${neoTitle(k)}: nhóm ${cls.name}, rộng khoảng ${fmt.dist(NEO.D[k])}.`;
  setTimeout(() => {
    const [x, y, ok] = screenOf(new THREE.Vector3().fromArray(NEO.pos, k * 3));
    if (ok) dog.visit(x, y + 90, { say: line, mood: r && r.psMax > -3 ? 'think' : 'hop', stay: 5200 });
    else dog.say(line, 'think');
  }, 1500);
}
function dogExplain() {
  if (selected?.kind === 'neo') {
    const k = selected.k, p = new THREE.Vector3().fromArray(NEO.pos, k * 3);
    const rS = p.length() / AU, v = Math.sqrt(GM_SUN * (2 / (rS * AU_KM) - 1 / (NEO.a[k] * AU_KM)));
    return `Cách Mặt Trời ${fmt.num(rS, 2)} AU, bay ${fmt.num(v, 1)} km/s — càng gần Mặt Trời càng nhanh.`;
  }
  if (selected?.kind === 'planet') return `${planetByKey[selected.key].vn}: ${planetByKey[selected.key].desc}`;
  const r = rateNow();
  return `Mỗi chấm là vị trí thật của một tiểu hành tinh vào ngày ${fmt.dateVN(mjdToDate(time.mjd))}.`;
}

const neoTitle = k => {
  const nm = NEO.names[k], alias = FAMOUS[nm] || (NEO.risk[k]?.name != null ? String(NEO.risk[k].name) : null);
  return alias && alias !== nm ? `${alias} (${nm})` : nm;
};
const kmFromScene = u => (u / AU) * AU_KM;
const earthPos = new THREE.Vector3();

function densityGuess(k) {
  const G = NEO.elem[k * NEO.F + 8];
  const pv = albedoFromSlope(G);
  return pv <= 0.06 ? 1600 : pv >= 0.25 ? 2700 : 2500;
}

function renderDetails() {
  const body = document.getElementById('dBody');
  const title = document.getElementById('dTitle');
  const dot = document.getElementById('dTitleDot');
  if (!selected) return;
  if (selected.kind === 'neo') {
    const k = selected.k, cls = NEO_CLASSES[NEO.cls[k]], r = NEO.risk[k];
    const a = NEO.a[k], e = NEO.e[k], q = a * (1 - e), Q = a * (1 + e);
    dot.style.background = cls.color;
    title.innerHTML = `${fmt.escapeHtml(neoTitle(k))}<span class="sub">Nhóm ${cls.name}</span>`;
    const p = new THREE.Vector3().fromArray(NEO.pos, k * 3);
    const rSun = p.length() / AU, dEarth = p.distanceTo(earthPos) / AU;
    const vHelio = Math.sqrt(GM_SUN * (2 / (rSun * AU_KM) - 1 / (a * AU_KM)));
    const D = NEO.D[k];
    const dens = densityGuess(k);
    const vImp = r?.v ?? 20;
    const impactUrl = `./impact.html?d=${Math.round(D)}&rho=${dens}&v=${vImp}&angle=45&name=${encodeURIComponent(neoTitle(k))}`;
    const defenseUrl = `./defense.html?d=${Math.round(D)}&rho=${dens}&v=${vImp}&name=${encodeURIComponent(neoTitle(k))}`;
    body.innerHTML = `
      <div class="section">
        <div class="row" style="flex-wrap:wrap;gap:6px">
          <span class="badge" style="color:${cls.color}" data-tip="${cls.rule}">● ${cls.name}</span>
          ${r ? `<span class="badge danger">Danh sách rủi ro ESA</span>` : ''}
          ${D >= 140 && q < 1.3 ? `<span class="badge warn" data-tip="Đường kính ≥ 140 m — kích thước được NASA/ESA ưu tiên theo dõi.">≥ 140 m</span>` : ''}
        </div>
      </div>
      ${r ? `
      <div class="section">
        <div class="section-title">Đánh giá nguy cơ va chạm</div>
        <div class="stat-grid">
          <div class="stat"><div class="k">Xác suất lớn nhất</div><div class="v">${r.ipMax ? `1 / ${fmt.num(1 / r.ipMax)}` : '—'}</div></div>
          <div class="stat" data-tip-title="Thang Palermo" data-tip="So sánh rủi ro với mức nền tự nhiên. < −2: không đáng lo; −2…0: cần theo dõi; > 0: đáng quan ngại."><div class="k">Thang Palermo</div><div class="v" style="color:${riskColor(r.psMax ?? -10)}">${fmt.num(r.psMax, 2)}</div></div>
          <div class="stat"><div class="k">Ngày tiếp cận nguy hiểm</div><div class="v" style="font-size:13px">${fmt.escapeHtml(String(r.date ?? '—')).slice(0, 10)}</div></div>
          <div class="stat"><div class="k">Vận tốc va chạm</div><div class="v">${fmt.num(r.v, 1)} <small>km/s</small></div></div>
        </div>
        <div class="field-hint" style="margin-top:6px">Khoảng thời gian rủi ro: ${fmt.escapeHtml(String(r.years ?? '—'))} · Thang Torino: ${r.ts ?? '—'}</div>
      </div>` : ''}
      <div class="section">
        <div class="section-title">Hiện tại (${fmt.dateVN(mjdToDate(time.mjd))})</div>
        <div class="stat-grid">
          <div class="stat"><div class="k">Cách Trái Đất</div><div class="v" id="dLiveEarth">${fmt.num(dEarth, 3)} <small>AU</small></div></div>
          <div class="stat"><div class="k">Cách Mặt Trời</div><div class="v" id="dLiveSun">${fmt.num(rSun, 3)} <small>AU</small></div></div>
          <div class="stat wide"><div class="k">Vận tốc quanh Mặt Trời <span class="muted">(phương trình vis-viva)</span></div><div class="v" id="dLiveV">${fmt.num(vHelio, 1)} <small>km/s</small></div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Kích thước & quỹ đạo</div>
        <dl class="kv">
          <dt>Đường kính</dt><dd>${fmt.dist(D)} <span class="muted">${NEO.Dsrc[k] ? '(ESA)' : '(ước tính từ H)'}</span></dd>
          <dt>Cấp sao tuyệt đối H</dt><dd>${fmt.num(NEO.H[k], 2)}</dd>
          <dt>Bán trục lớn a</dt><dd>${fmt.num(a, 3)} AU</dd>
          <dt>Độ lệch tâm e</dt><dd>${fmt.num(e, 3)}</dd>
          <dt>Độ nghiêng i</dt><dd>${fmt.num(NEO.inc[k], 2)}°</dd>
          <dt>Cận điểm q / viễn điểm Q</dt><dd>${fmt.num(q, 3)} / ${fmt.num(Q, 3)} AU</dd>
          <dt>Chu kỳ quỹ đạo</dt><dd>${fmt.num(periodYears(a), 2)} năm</dd>
        </dl>
        ${NEO.Dsrc[k] ? '' : `<div class="formula">D = 1329 km / √pᵥ · 10<sup>−H/5</sup></div>`}
      </div>
      <div class="section">
        <div class="d-actions">
          <a class="btn btn-danger" href="${impactUrl}">☄️ Nếu va chạm?</a>
          <a class="btn" href="${defenseUrl}">🛡️ Làm lệch hướng</a>
          <button class="btn" id="dFollow" style="grid-column:1/-1">${follow ? '◉ Đang bám theo — bấm để thả' : '◎ Bám theo vật thể'}</button>
        </div>
      </div>`;
  } else if (selected.kind === 'planet') {
    const def = planetByKey[selected.key];
    const el = planetElementsAt(def.key, time.mjd);
    const p = def.group.position;
    dot.style.background = '#9fb0d8';
    title.innerHTML = `${def.vn}<span class="sub">${def.key === 'Pluto' ? 'Hành tinh lùn' : 'Hành tinh'} · ${def.key}</span>`;
    body.innerHTML = `
      <div class="section"><p class="d-desc">${def.desc}</p></div>
      <div class="section">
        <div class="section-title">Hiện tại (${fmt.dateVN(mjdToDate(time.mjd))})</div>
        <div class="stat-grid">
          <div class="stat"><div class="k">Cách Mặt Trời</div><div class="v">${fmt.num(p.length() / AU, 3)} <small>AU</small></div></div>
          <div class="stat"><div class="k">Cách Trái Đất</div><div class="v">${def.key === 'Earth' ? '—' : `${fmt.num(p.distanceTo(earthPos) / AU, 3)} <small>AU</small>`}</div></div>
        </div>
      </div>
      <div class="section">
        <dl class="kv">
          <dt>Bán kính</dt><dd>${fmt.num(def.R, 1)} km</dd>
          <dt>Độ nghiêng trục</dt><dd>${fmt.num(def.tilt, 2)}°</dd>
          <dt>Chu kỳ tự quay</dt><dd>${def.rotH > 48 ? `${fmt.num(def.rotH / 24, 1)} ngày` : `${fmt.num(def.rotH, 2)} giờ`}</dd>
          <dt>Bán trục lớn a</dt><dd>${fmt.num(el.a, 3)} AU</dd>
          <dt>Độ lệch tâm e</dt><dd>${fmt.num(el.e, 4)}</dd>
          <dt>Chu kỳ quỹ đạo</dt><dd>${fmt.num(periodYears(el.a), 2)} năm</dd>
          <dt>Vệ tinh tự nhiên</dt><dd>${def.moons}</dd>
        </dl>
      </div>
      <div class="section"><button class="btn btn-block" id="dFollow">${follow ? '◉ Đang bám theo — bấm để thả' : '◎ Bám theo hành tinh'}</button></div>`;
  } else {
    dot.style.background = '#ffd15c';
    title.innerHTML = `Mặt Trời<span class="sub">Ngôi sao loại G2V</span>`;
    body.innerHTML = `<div class="section"><p class="d-desc">Chiếm 99,86% khối lượng Hệ Mặt Trời. Lực hấp dẫn của nó (GM = 1,327×10¹¹ km³/s²) chi phối quỹ đạo của mọi hành tinh và tiểu hành tinh trong mô phỏng này.</p>
      <dl class="kv"><dt>Bán kính</dt><dd>696.000 km</dd><dt>Nhiệt độ bề mặt</dt><dd>≈ 5.772 K</dd><dt>Tuổi</dt><dd>≈ 4,6 tỷ năm</dd></dl></div>`;
  }
  document.getElementById('dFollow')?.addEventListener('click', () => {
    if (follow) { follow = null; fly = null; } else flyTo(selected, camera.position.distanceTo(controls.target));
    renderDetails();
  });
}
document.getElementById('dClose').addEventListener('click', () => select(null));

// Cập nhật số liệu "hiện tại" ~4 lần/giây (không dựng lại toàn bộ bảng)
let liveTimer = 0;
function updateLive(dt) {
  liveTimer += dt;
  if (liveTimer < 0.25 || !selected || selected.kind !== 'neo') return;
  liveTimer = 0;
  const k = selected.k, p = new THREE.Vector3().fromArray(NEO.pos, k * 3);
  const rSun = p.length() / AU;
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('dLiveEarth', `${fmt.num(p.distanceTo(earthPos) / AU, 3)} <small>AU</small><div class="muted" style="font-size:11px;font-weight:400">${fmt.sig(kmFromScene(p.distanceTo(earthPos)) / 1e6)} triệu km</div>`);
  set('dLiveSun', `${fmt.num(rSun, 3)} <small>AU</small>`);
  set('dLiveV', `${fmt.num(Math.sqrt(GM_SUN * (2 / (rSun * AU_KM) - 1 / (NEO.a[k] * AU_KM))), 1)} <small>km/s</small>`);
}

// ---------------------------------------------------------------------------
//  Chọn bằng chuột: hành tinh (raycast) + NEO (chiếu màn hình)
// ---------------------------------------------------------------------------
const mouse = { x: 0, y: 0, moved: false, inside: false, downX: 0, downY: 0 };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const projM = new THREE.Matrix4();
const hoverTip = document.getElementById('hoverTip');
let hovered = null;

function pickAt(px, py) {
  ndc.set((px / innerWidth) * 2 - 1, -(py / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects([...pickables, sun], false)[0];
  if (hit) return { ...hit.object.userData, dist: hit.distance };
  if (!NEO.N) return null;
  // NEO gần con trỏ nhất trong bán kính 10 px
  projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const m = projM.elements, { pos, visible, N } = NEO;
  const hw = innerWidth / 2, hh = innerHeight / 2;
  let best = -1, bestD = 100;
  for (let k = 0; k < N; k++) {
    if (!visible[k]) continue;
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0) continue;
    const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * hw + hw;
    const sy = -((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * hh + hh;
    const d = (sx - px) ** 2 + (sy - py) ** 2;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best >= 0 ? { kind: 'neo', k: best } : null;
}

function showHover(h) {
  hovered = h;
  if (!h) { hoverTip.classList.remove('show'); hoverMarker.visible = false; renderer.domElement.style.cursor = ''; return; }
  renderer.domElement.style.cursor = 'pointer';
  let html;
  if (h.kind === 'neo') {
    const k = h.k, cls = NEO_CLASSES[NEO.cls[k]];
    html = `<div class="h"><span class="dot" style="background:${cls.color}"></span>${fmt.escapeHtml(neoTitle(k))}</div>
      <div class="m">${cls.name} · D ≈ ${fmt.dist(NEO.D[k])}${NEO.risk[k] ? ' · <span style="color:var(--danger)">rủi ro</span>' : ''}</div>
      <div class="m">a ${fmt.num(NEO.a[k], 2)} AU · e ${fmt.num(NEO.e[k], 2)} · i ${fmt.num(NEO.inc[k], 1)}°</div>`;
    hoverMarker.position.fromArray(NEO.pos, k * 3);
    hoverMarker.visible = true;
  } else {
    hoverMarker.visible = false;
    html = `<div class="h">${h.kind === 'sun' ? 'Mặt Trời' : planetByKey[h.key].vn}</div><div class="m">Nhấp để xem chi tiết</div>`;
  }
  hoverTip.innerHTML = html;
  hoverTip.style.left = `${Math.min(mouse.x + 16, innerWidth - 230)}px`;
  hoverTip.style.top = `${mouse.y + 16}px`;
  hoverTip.classList.add('show');
}

renderer.domElement.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; mouse.inside = true; });
renderer.domElement.addEventListener('pointerleave', () => { mouse.inside = false; showHover(null); });
renderer.domElement.addEventListener('pointerdown', e => { mouse.downX = e.clientX; mouse.downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', e => {
  if (Math.hypot(e.clientX - mouse.downX, e.clientY - mouse.downY) > 5) return; // là thao tác kéo
  const h = pickAt(e.clientX, e.clientY);
  if (h) select(h.kind === 'neo' ? { kind: 'neo', k: h.k } : h.kind === 'sun' ? { kind: 'sun' } : { kind: 'planet', key: h.key });
});
// Ngừng bám theo khi người dùng tự xoay/kéo camera đi xa
controls.addEventListener('start', () => { fly = null; });

// ---------------------------------------------------------------------------
//  Tìm kiếm
// ---------------------------------------------------------------------------
const searchEl = document.getElementById('search'), resultsEl = document.getElementById('searchResults');
let searchHits = [], searchActive = 0;
function doSearch() {
  const q = searchEl.value.trim().toLowerCase().replace(/\s+/g, '');
  searchHits = [];
  if (q && NEO.N) {
    const planetHits = PLANETS.filter(p => p.vn.toLowerCase().replace(/\s+/g, '').includes(q) || p.key.toLowerCase().includes(q)).map(p => ({ planet: p.key }));
    searchHits.push(...planetHits);
    for (const s of NEO.search) {
      if (s.key.startsWith(q) || (s.label && s.label.toLowerCase().replace(/\s+/g, '').includes(q))) searchHits.push({ k: s.k });
      if (searchHits.length >= 8) break;
    }
  }
  searchActive = 0;
  resultsEl.innerHTML = searchHits.map((h, i) => h.planet
    ? `<button data-i="${i}" class="${i ? '' : 'on'}"><span>${planetByKey[h.planet].vn}</span><span class="m">hành tinh</span></button>`
    : `<button data-i="${i}" class="${i ? '' : 'on'}"><span>${fmt.escapeHtml(neoTitle(h.k))}</span><span class="m">${NEO_CLASSES[NEO.cls[h.k]].name} · ${fmt.dist(NEO.D[h.k])}</span></button>`).join('')
    || (q ? `<div class="muted" style="padding:8px 10px;font-size:12.5px">Không tìm thấy “${fmt.escapeHtml(searchEl.value)}”</div>` : '');
  resultsEl.classList.toggle('show', !!q);
}
function chooseHit(i) {
  const h = searchHits[i]; if (!h) return;
  if (h.planet) select({ kind: 'planet', key: h.planet });
  else {
    if (!NEO.visible[h.k]) { // đảm bảo vật thể được chọn hiển thị
      NEO.visible[h.k] = 1; neoPoints.geometry.attributes.aVisible.needsUpdate = true;
    }
    select({ kind: 'neo', k: h.k });
  }
  searchEl.value = ''; resultsEl.classList.remove('show'); searchEl.blur();
}
searchEl.addEventListener('input', doSearch);
searchEl.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    searchActive = (searchActive + (e.key === 'ArrowDown' ? 1 : -1) + searchHits.length) % Math.max(1, searchHits.length);
    resultsEl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === searchActive));
  } else if (e.key === 'Enter') chooseHit(searchActive);
  else if (e.key === 'Escape') { searchEl.value = ''; doSearch(); searchEl.blur(); }
});
resultsEl.addEventListener('pointerdown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); chooseHit(+b.dataset.i); } });
searchEl.addEventListener('blur', () => setTimeout(() => resultsEl.classList.remove('show'), 150));

function renderFamous() {
  const keys = ['99942', '101955', '65803', '2024YR4', '433', '162173', '3200'];
  const idx = new Map(NEO.names.map((n, k) => [n, k]));
  document.getElementById('famous').innerHTML = keys.filter(k => idx.has(k)).map(k => `<button class="chip" data-k="${idx.get(k)}">${FAMOUS[k]}</button>`).join('');
  document.getElementById('famous').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const k = +b.dataset.k;
    if (!NEO.visible[k]) { NEO.visible[k] = 1; neoPoints.geometry.attributes.aVisible.needsUpdate = true; }
    select({ kind: 'neo', k });
  });
}

// ---------------------------------------------------------------------------
//  Bộ lọc & hiển thị
// ---------------------------------------------------------------------------
function renderClassFilters() {
  const counts = [0, 0, 0, 0, 0];
  for (let k = 0; k < NEO.N; k++) counts[NEO.cls[k]]++;
  const max = Math.max(...counts);
  const host = document.getElementById('classFilters');
  host.innerHTML = NEO_CLASSES.map((c, i) => counts[i] === 0 ? '' : `
    <div class="cls ${filters.classes[i] ? '' : 'off'}" data-i="${i}" data-tip-title="Nhóm ${c.name}" data-tip="${c.rule}">
      <span class="dot" style="background:${c.color}"></span><span class="name">${c.name}</span>
      <span class="bar"><i style="width:${(counts[i] / max) * 100}%;background:${c.color}"></i></span>
      <span class="n">${fmt.num(counts[i])}</span>
    </div>`).join('');
  host.onclick = e => {
    const el = e.target.closest('.cls'); if (!el) return;
    const i = +el.dataset.i; filters.classes[i] = !filters.classes[i];
    el.classList.toggle('off', !filters.classes[i]);
    applyFilters();
  };
  document.getElementById('riskCount').textContent = fmt.num(Object.keys(NEO.risk).length);
}

function renderLegend() {
  const el = document.getElementById('colorLegend');
  if (filters.colorMode === 'class') el.innerHTML = '';
  else if (filters.colorMode === 'size') el.innerHTML = `
    <div style="height:8px;border-radius:4px;background:linear-gradient(90deg,${SIZE_RAMP.map(s => s[1]).join(',')})"></div>
    <div class="row mono" style="font-size:11px;color:var(--muted)"><span>10 m</span><span style="text-align:center">100 m</span><span style="text-align:center">1 km</span><span style="text-align:right">10 km</span></div>`;
  else el.innerHTML = RISK_STEPS.map(s => `<div class="legend-item"><span class="dot" style="background:${s.color}"></span>${s.label}</div>`).join('')
    + `<div class="legend-item"><span class="dot" style="background:#2b3345"></span>Không có trong danh sách rủi ro</div>`;
}

document.getElementById('fRisk').addEventListener('change', e => { filters.riskOnly = e.target.checked; applyFilters(); });
const minDEl = document.getElementById('fMinD');
minDEl.addEventListener('input', () => {
  filters.minD = +minDEl.value;
  const v = MIN_D_STEPS[filters.minD];
  document.getElementById('fMinDOut').textContent = v ? `≥ ${fmt.dist(v)}` : 'tất cả';
  applyFilters();
});
document.getElementById('colorMode').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#colorMode button').forEach(x => x.classList.toggle('on', x === b));
  filters.colorMode = b.dataset.v; applyStyle();
  if (filteredOrbits) buildFilteredOrbits();
});
document.getElementById('tOrbits').addEventListener('change', buildFilteredOrbits);
document.getElementById('tPlanetOrbits').addEventListener('change', e => { planetOrbitGroup.visible = e.target.checked; });
document.getElementById('tLabels').addEventListener('change', e => labelRenderer.domElement.classList.toggle('labels-off', !e.target.checked));
let planetScale = 1;
const pScaleEl = document.getElementById('pScale');
pScaleEl.addEventListener('input', () => {
  planetScale = +pScaleEl.value;
  document.getElementById('pScaleOut').textContent = `×${fmt.num(planetScale, 1)}`;
  for (const p of PLANETS) p.scaleGroup.scale.setScalar(planetScale);
  for (const p of PLANETS) if (p.earthMoonFrame) p.earthMoonFrame.scale.setScalar(planetScale);
  sun.scale.setScalar(Math.min(1.6, Math.max(0.6, planetScale)));
});
document.getElementById('mFilters').addEventListener('click', () => document.getElementById('filterPanel').classList.toggle('m-hide'));
if (innerWidth < 900) document.getElementById('filterPanel').classList.add('m-hide');

// ---------------------------------------------------------------------------
//  Điều khiển thời gian
// ---------------------------------------------------------------------------
const rateEl = document.getElementById('tRate'), playEl = document.getElementById('tPlay');
function syncTimeUI() {
  rateEl.value = time.rateIdx; paintRange(rateEl);
  playEl.textContent = time.playing ? '⏸' : '▶';
  document.getElementById('simRate').textContent = time.playing ? rateText(RATES[time.rateIdx]) : 'đang tạm dừng';
}
rateEl.addEventListener('input', () => { time.rateIdx = +rateEl.value; time.playing = true; syncTimeUI(); });
playEl.addEventListener('click', () => { time.playing = !time.playing; syncTimeUI(); });
document.getElementById('tSlower').addEventListener('click', () => { time.rateIdx = Math.max(0, time.rateIdx - 1); time.playing = true; syncTimeUI(); });
document.getElementById('tFaster').addEventListener('click', () => { time.rateIdx = Math.min(RATES.length - 1, time.rateIdx + 1); time.playing = true; syncTimeUI(); });
document.getElementById('tNow').addEventListener('click', () => { time.mjd = dateToMJD(new Date()); time.rateIdx = 5; time.playing = true; syncTimeUI(); });
function goHome() {
  select(null);
  fly = { t0: performance.now(), dur: 1400, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), home: true };
}
document.getElementById('homeBtn').addEventListener('click', goHome);

addEventListener('keydown', e => {
  if (e.target.matches('input[type=search], input[type=text], input[type=number]')) return;
  if (e.key === ' ') { e.preventDefault(); playEl.click(); }
  else if (e.key === 'ArrowRight') document.getElementById('tFaster').click();
  else if (e.key === 'ArrowLeft') document.getElementById('tSlower').click();
  else if (e.key === 'Escape') select(null);
  else if (e.key === '/') { e.preventDefault(); searchEl.focus(); }
  else if (e.key.toLowerCase() === 'h') goHome();
});

// ---------------------------------------------------------------------------
//  Vòng lặp chính
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const tmpV = new THREE.Vector3();
let lastDateText = '', lastNEOmjd = NaN, pickTimer = 0;

function updatePlanets(dt, rate) {
  for (const p of PLANETS) {
    planetPosition(p.key, time.mjd, tmp3);
    p.group.position.set(tmp3[0] * AU, tmp3[1] * AU, tmp3[2] * AU);
    // tự quay: tốc độ thật × tốc độ mô phỏng, giới hạn để không bị "nhấp nháy" khi tua nhanh
    const omega = THREE.MathUtils.clamp((TWO_PI * 24 / p.rotH) * rate, -2.5, 2.5);
    p.mesh.rotation.y += omega * dt;
    if (p.clouds) p.clouds.rotation.y += omega * dt * 1.08;
    for (const m of p.moonsList) {
      m.angle += THREE.MathUtils.clamp((TWO_PI / m.periodD) * rate, -1.8, 1.8) * dt;
      m.pivot.rotation.y = m.angle;
    }
  }
  earthPos.copy(planetByKey.Earth.group.position);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const rate = rateNow();
  time.mjd += rate * dt;

  updatePlanets(dt, rate);
  if (NEO.N && (time.mjd !== lastNEOmjd || neoForce)) { updateNEO(time.mjd, neoForce); neoForce = false; lastNEOmjd = time.mjd; }

  const dText = fmt.dateVN(mjdToDate(time.mjd), Math.abs(rate) < 1);
  if (dText !== lastDateText) { document.getElementById('simDate').textContent = dText; lastDateText = dText; }

  // Camera: bay tới & bám theo
  if (fly) {
    const p = Math.min(1, (performance.now() - fly.t0) / fly.dur), k = ease(p);
    if (fly.home) {
      camera.position.lerpVectors(fly.fromPos, HOME.pos, k);
      controls.target.lerpVectors(fly.fromTarget, HOME.target, k);
    } else {
      const tp = objectPosition(fly.sel, tmpV);
      controls.target.lerpVectors(fly.fromTarget, tp, k);
      camera.position.lerpVectors(fly.fromPos, tp.clone().addScaledVector(fly.dir, fly.dist), k);
      lastTarget.copy(tp);
    }
    if (p >= 1) fly = null;
  } else if (follow) {
    const tp = follow();
    camera.position.add(tmpV.copy(tp).sub(lastTarget));
    controls.target.copy(tp);
    lastTarget.copy(tp);
  }
  controls.update();
  stars.position.copy(camera.position); // bầu trời sao luôn ở vô cực

  if (selected?.kind === 'neo') selMarker.position.fromArray(NEO.pos, selected.k * 3);
  updateLive(dt);

  // Rê chuột: chỉ tính khi chuột di chuyển (hoặc mỗi 0,2 s khi vật thể đang chạy)
  pickTimer += dt;
  if (mouse.inside && (mouse.moved || (pickTimer > 0.2 && rate !== 0))) {
    pickTimer = 0; mouse.moved = false;
    showHover(pickAt(mouse.x, mouse.y));
  } else if (hovered?.kind === 'neo') hoverMarker.position.fromArray(NEO.pos, hovered.k * 3);

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); labelRenderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
//  Khởi động
// ---------------------------------------------------------------------------
adaptiveQuality(renderer, { onChange: r => { neoMaterial.uniforms.uPixel.value = r; stars.material.uniforms.uPixel.value = r; } });

(async () => {
  try {
    load.set(0.05, 'Dựng hành tinh…');
    buildPlanetOrbits(time.mjd);
    syncTimeUI();
    renderer.setAnimationLoop(frame);
    await loadNEO();
    applyStyle();
    applyFilters();
    renderClassFilters();
    renderFamous();
    updateNEO(time.mjd, true);
    load.set(1, 'Sẵn sàng');
    load.done();
    dog = initBuddy('solar', { explain: dogExplain });
    // Hỗ trợ liên kết sâu: ?neo=99942
    const q = new URLSearchParams(location.search).get('neo');
    if (q) { const k = NEO.names.indexOf(q); if (k >= 0) select({ kind: 'neo', k }); }
  } catch (err) {
    console.error(err);
    load.fail(`Không tải được dữ liệu: ${err.message}`);
  }
})();
