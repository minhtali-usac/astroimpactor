// ============================================================================
//  Trang 3 — Phòng thủ Trái Đất: làm lệch hướng tiểu hành tinh
// ----------------------------------------------------------------------------
//  Vật lý (src/lib/deflection.js):
//   • Quỹ đạo tiếp cận được TÍCH PHÂN SỐ (RK4) dưới lực hấp dẫn Trái Đất ⇒ thấy rõ
//     hiện tượng hội tụ hấp dẫn bẻ cong đường bay.
//   • Mỗi cú va chạm / mỗi giây laser tạo Δv thật (theo khối lượng tiểu hành tinh),
//     quy đổi sang độ dịch trên mặt phẳng B: Δζ ≈ k(t)·Δv·t  (k: 1 → 3).
//   • Thắng khi khoảng cách tiếp cận gần nhất > R⊕ + 100 km.
//  Hiển thị: khoảng cách > 3 R⊕ được nén logarit để cả hành trình vừa khung hình.
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  MU_EARTH, R_EARTH, ATMOSPHERE_KM, GEO_ALT_KM, DAY, asteroidMass, kineticDv, laserAccel, leverage,
  bPlaneShiftKm, captureRadius, escapeVelocity, integrateFlyby, sampleAt,
} from '../lib/deflection.js';
import { computeImpact } from '../lib/impact.js';
import { geodesicRing } from '../lib/geo.js';
import { COMPOSITIONS } from '../lib/places.js';
import { createEarthGlobe, isLand, landReady } from '../lib/globe.js';
import * as fmt from '../lib/format.js';
import { initBuddy } from '../mascot/buddy.js';
import { mountTopbar, initTooltips, initRanges, paintRange, initCollapsibles, initModals, openModal, closeModal, toast, loader as makeLoader } from '../lib/ui.js';

mountTopbar('defense', '', {
  question: 'Lực đẩy nhỏ có cứu được Trái Đất?',
  help: `<ul class="about-list">
  <li><span>①</span><div><b>Thiết lập:</b> chọn độ khó hoặc tự chỉnh tiểu hành tinh, thời gian cảnh báo và phương tiện. Bảng "Phân tích trước nhiệm vụ" cho biết nhiệm vụ có khả thi.</div></li>
  <li><span>🚀</span><div><b>Tàu va chạm</b> (<kbd>R</kbd>): đẩy tiểu hành tinh bằng động lượng, kiểu DART. Phóng càng sớm, độ lệch càng lớn.</div></li>
  <li><span>🔆</span><div><b>Laser</b> (giữ <kbd>Space</kbd>): bóc tách bề mặt tạo lực đẩy nhỏ nhưng liên tục; chỉ hiệu quả khi tiểu hành tinh đã gần, cần tầm nhìn thẳng và nghỉ khi quá nhiệt.</div></li>
  <li><span>🎯</span><div><b>Mặt phẳng B:</b> điểm vàng phải ra ngoài vòng đỏ đứt nét (vùng bắt giữ do hấp dẫn) trước khi hết giờ.</div></li>
  <li><span>⏯</span><div><kbd>P</kbd> tạm dừng · đổi tốc độ ×½ – ×4 · <kbd>?</kbd> mở hướng dẫn này.</div></li>
</ul>`,
});
initTooltips();
initModals();
initCollapsibles();
const load = makeLoader();
const $ = id => document.getElementById(id);

const LASER_COUPLING = 1e-4;  // N/W (≈ 100 µN/W — cận trên của thí nghiệm bóc tách laser)
// thời lượng một ván ở tốc độ ×1 (giây); giáo viên có thể đổi bằng ?dur=120
const GAME_SECONDS = THREE.MathUtils.clamp(+new URLSearchParams(location.search).get('dur') || 75, 5, 600);
const START_DIST_KM = 60 * R_EARTH;
// Chùm laser loe ra do nhiễu xạ: ngoài ~10 triệu km, cường độ trên mục tiêu giảm ∝ 1/d²
const LASER_RANGE_KM = 1e7;
const laserEfficiency = dKm => Math.min(1, (LASER_RANGE_KM / Math.max(dKm, 1)) ** 2);
const R_SAFE = R_EARTH + ATMOSPHERE_KM;

// ---------------------------------------------------------------------------
//  Thiết lập
// ---------------------------------------------------------------------------
const els = { D: $('sD'), comp: $('sComp'), V: $('sV'), T: $('sT'), N: $('sN'), M: $('sM'), U: $('sU'), B: $('sB'), P: $('sP') };
els.comp.innerHTML = COMPOSITIONS.map(c => `<option value="${c.rho}">${c.label} — ${fmt.num(c.rho)} kg/m³</option>`).join('');
els.comp.value = '2750';

const leadDays = x => 14 * Math.pow(3650 / 14, x / 100);              // 14 ngày → 10 năm (thang log)
const leadX = days => (100 * Math.log(days / 14)) / Math.log(3650 / 14);
const leadText = d => (d >= 365 ? `${fmt.num(d / 365.25, 1)} năm` : `${fmt.num(d)} ngày`);

const PRESETS = {
  easy:   { D: 100, rho: 2750, V: 12, T: 5 * 365, N: 5, M: 1500, U: 10, B: 3.5, P: 50 },
  normal: { D: 120, rho: 2750, V: 15, T: 365, N: 4, M: 1500, U: 10, B: 3, P: 50 },
  hard:   { D: 200, rho: 2750, V: 20, T: 2 * 365, N: 5, M: 2000, U: 12, B: 3, P: 100 },
};
function applyPreset(p) {
  els.D.value = p.D; els.comp.value = String(p.rho); els.V.value = p.V; els.T.value = leadX(p.T);
  els.N.value = p.N; els.M.value = p.M; els.U.value = p.U; els.B.value = p.B; els.P.value = p.P;
  Object.values(els).forEach(el => el.type === 'range' && paintRange(el));
  updateSetup();
}
$('difficulty').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $('difficulty').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  applyPreset(PRESETS[b.dataset.v]);
});

function setup() {
  const D = +els.D.value, rho = +els.comp.value;
  return {
    D, rho, M: asteroidMass(D, rho), vInf: +els.V.value, T: leadDays(+els.T.value) * DAY,
    N: +els.N.value, mSc: +els.M.value, u: +els.U.value, beta: +els.B.value, P: +els.P.value * 1e6,
  };
}

/** Ước tính khả năng làm lệch tối đa nếu dùng hết phương tiện sớm. */
function capability(s) {
  const dvRocket = kineticDv({ mass: s.mSc, speed: s.u, beta: s.beta, asteroidMass: s.M });
  const rockets = s.N * bPlaneShiftKm(dvRocket, s.T * 0.85);
  const a = laserAccel({ power: s.P, coupling: LASER_COUPLING, asteroidMass: s.M });
  // laser bắn ~40% thời gian (giới hạn nhiệt) × ~65% thời gian có tầm nhìn thẳng
  let laser = 0; const steps = 200;
  for (let i = 0; i < steps; i++) { const t = s.T * (1 - (i + 0.5) / steps); laser += bPlaneShiftKm(a * laserEfficiency(s.vInf * t) * (s.T / steps) * 0.4 * 0.65, t); }
  const bSafe = captureRadius(s.vInf, R_SAFE);
  return { dvRocket, a, rockets, laser, total: rockets + laser, bSafe, need: bSafe * 0.7 };
}

function updateSetup() {
  const s = setup();
  $('sDOut').textContent = fmt.dist(s.D);
  $('sVOut').textContent = `${fmt.num(s.vInf, 1)} km/s`;
  $('sTOut').textContent = leadText(s.T / DAY);
  $('sNOut').textContent = `${s.N} tàu`;
  $('sMOut').textContent = `${fmt.num(s.mSc)} kg`;
  $('sUOut').textContent = `${fmt.num(s.u, 1)} km/s`;
  $('sBOut').textContent = fmt.num(s.beta, 1);
  $('sPOut').textContent = s.P ? `${fmt.num(s.P / 1e6, 1)} MW` : 'không dùng';
  const c = capability(s);
  const ratio = c.total / c.need;
  const vAtm = Math.sqrt(s.vInf ** 2 + escapeVelocity(R_SAFE) ** 2);
  const E = computeImpact({ diameter: s.D, density: s.rho, velocity: vAtm, angle: 45 });
  $('briefing').innerHTML = `
    <div class="brief-row"><span>Khối lượng tiểu hành tinh</span><span>${fmt.sig(s.M / 1000)} tấn</span></div>
    <div class="brief-row"><span>Năng lượng nếu va chạm</span><span>${fmt.energy(E.energyMt)}</span></div>
    <div class="brief-row"><span>Δv mỗi tàu va chạm</span><span>${fmt.sig(c.dvRocket * 1000)} mm/s</span></div>
    <div class="brief-row"><span>Gia tốc do laser</span><span>${s.P ? `${fmt.sig(c.a * 1e6)} µm/s²` : '—'}</span></div>
    <div class="brief-row"><span>Bán kính bắt giữ b⊕</span><span>${fmt.num(c.bSafe)} km</span></div>
    <div class="brief-row"><span>Cần dịch chuyển (ước tính)</span><span>~${fmt.num(c.need)} km</span></div>
    <div class="brief-row"><span>Khả năng tối đa (tàu + laser)</span><span>${fmt.num(c.rockets)} + ${fmt.num(c.laser)} km</span></div>
    <div class="feas ${ratio >= 1.4 ? 'ok' : ratio >= 0.8 ? 'mid' : 'bad'}">${ratio >= 1.4 ? '✅ Khả thi nếu hành động sớm.' : ratio >= 0.8 ? '⚠️ Sát nút — phải dùng gần hết phương tiện ngay từ đầu.' : '⛔ Gần như bất khả thi: cần cảnh báo sớm hơn, nhiều tàu hơn hoặc laser mạnh hơn.'}</div>`;
}
Object.values(els).forEach(el => el.addEventListener('input', updateSetup));

// ---------------------------------------------------------------------------
//  Cảnh 3D
// ---------------------------------------------------------------------------
const G = createEarthGlobe($('globe'), { showCities: false, renderHtml: () => document.createElement('div') });
const { world, R } = G;
const scene = world.scene();
world.controls().maxDistance = R * 60;
world.camera().far = R * 200; world.camera().updateProjectionMatrix();
world.pointOfView({ lat: 12, lng: 110, altitude: 3.2 }, 0);

/** km (toạ độ địa tâm) → toạ độ hiển thị, nén logarit ngoài 3 R⊕ */
function toScene(x, y, z, out = new THREE.Vector3()) {
  const r = Math.hypot(x, y, z), rr = r / R_EARTH;
  const g = rr <= 3 ? rr : 3 * (1 + 0.6 * Math.log(rr / 3));
  const k = (g * R) / Math.max(r, 1e-9);
  return out.set(x * k, y * k, z * k);
}

function glowSprite(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
}

// Tiểu hành tinh
const rockGeo = new THREE.IcosahedronGeometry(1, 3);
{
  const p = rockGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.2 * Math.sin(v.x * 3.3 + 1) * Math.sin(v.y * 2.9 + 2) * Math.sin(v.z * 3.1 + 3) + 0.07 * Math.sin(9 * v.x + 7 * v.y));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  rockGeo.computeVertexNormals();
}
const asteroid = new THREE.Group();
const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x7a6a5c, roughness: 1, flatShading: true, emissive: 0x2a1408, emissiveIntensity: 0.6 }));
const astGlow = glowSprite('rgba(255,210,170,0.9)', 'rgba(255,120,60,0.25)');
asteroid.add(rock, astGlow);
asteroid.visible = false;
scene.add(asteroid);

// Đường bay dự báo
const pathGeo = new THREE.BufferGeometry();
const pathLine = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.85 }));
pathLine.frustumCulled = false;
scene.add(pathLine);

// Vệ tinh laser
const SAT_R = 1.75, SAT_INC = 28 * Math.PI / 180, SAT_PERIOD = 22;
const sat = new THREE.Group();
scene.add(sat);
const satOrbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 180 }, (_, i) => satPos(i / 180 * Math.PI * 2))),
  new THREE.LineBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.25 }));
scene.add(satOrbit);
function satPos(th, out = new THREE.Vector3()) {
  return out.set(Math.cos(th), Math.sin(th) * Math.sin(SAT_INC), Math.sin(th) * Math.cos(SAT_INC)).multiplyScalar(R * SAT_R);
}

// Tia laser
const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
const beamGlow = new THREE.Mesh(beam.geometry, new THREE.MeshBasicMaterial({ color: 0x2bc8ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
const beamHit = glowSprite('rgba(220,255,255,1)', 'rgba(80,220,255,0.5)');
beam.visible = beamGlow.visible = beamHit.visible = false;
scene.add(beam, beamGlow, beamHit);

let rocketPrefab = null;
function fitModel(obj, size, alignLongestToY = false) {
  const box = new THREE.Box3().setFromObject(obj), dim = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  obj.position.sub(c);
  const holder = new THREE.Group();
  const inner = new THREE.Group(); inner.add(obj); holder.add(inner);
  if (alignLongestToY) {
    if (dim.x >= dim.y && dim.x >= dim.z) inner.rotation.z = Math.PI / 2;
    else if (dim.z >= dim.y) inner.rotation.x = Math.PI / 2;
  }
  holder.scale.setScalar(size / Math.max(dim.x, dim.y, dim.z));
  return holder;
}

// ---------------------------------------------------------------------------
//  Trạng thái ván chơi
// ---------------------------------------------------------------------------
let game = { phase: 'setup' };
const v3 = () => new THREE.Vector3();

function newGame() {
  const s = setup();
  // Hướng bay tới (đơn vị) và hệ trục mặt phẳng B
  // Hướng tới chủ yếu từ trên xuống (theo trục Y của camera) ⇒ đường bay không bị hai bảng bên che
  const S = new THREE.Vector3(0.3, -0.88, 0.37).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
  const xi = new THREE.Vector3().crossVectors(S, new THREE.Vector3(0, 1, 0)).normalize();
  const zeta = new THREE.Vector3().crossVectors(S, xi).normalize();
  const bSafe = captureRadius(s.vInf, R_SAFE);
  const ang = Math.random() * Math.PI * 2, mag = (0.15 + Math.random() * 0.4) * bSafe;
  const b = new THREE.Vector2(Math.cos(ang) * mag, Math.sin(ang) * mag);
  game = {
    phase: 'run', s, S, xi, zeta, bSafe, bCapture: captureRadius(s.vInf),
    b, bDisp: b.clone(), push: b.clone().normalize(), history: [b.clone()],
    elapsed: 0, speed: 1, paused: false,
    dvTotal: 0, rocketsLeft: s.N, flights: [], heat: 0, overheated: false, firing: false, laserOn: false,
    traj: null, trajDirty: true, trajTimer: 0, satTh: Math.random() * Math.PI * 2, endT: 0,
  };
  recomputeTrajectory();
  if (dog && !dog.muted) setTimeout(() => dog.say(`Còn ${leadText(s.T / DAY)}! Phóng tàu ngay — càng sớm càng hiệu quả.`, 'think'), 1800);
  asteroid.visible = true;
  const size = R * 0.03 * THREE.MathUtils.clamp(Math.log10(s.D) / 2.2, 0.6, 1.6);
  rock.scale.setScalar(size); astGlow.scale.setScalar(size * 6);
  world.polygonsData([]);
  // camera nhìn ngang qua hướng bay để thấy cả hành trình
  const camDir = xi.clone().multiplyScalar(0.9).addScaledVector(S, -0.3).normalize();
  const ll = G.toLatLng(camDir.clone().multiplyScalar(R));
  world.pointOfView({ lat: ll.lat, lng: ll.lng, altitude: 19 }, 1600);
  $('setup').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('leftTitle').innerHTML = `Nhiệm vụ đang diễn ra<span class="sub">Tiểu hành tinh ${fmt.dist(s.D)} · v∞ = ${fmt.num(s.vInf, 1)} km/s</span>`;
  renderRockets();
  $('astLabel').classList.remove('hidden');
  $('astLabelText').textContent = scenarioName || `Tiểu hành tinh ${fmt.dist(s.D)}`;
  $('pause').textContent = '⏸ Tạm dừng';
  $('speed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === '1'));
}

function recomputeTrajectory() {
  const g = game;
  // Bắt đầu ở khoảng cách hữu hạn: thu nhỏ độ lệch ngang theo v∞/v₀ để mômen động lượng
  // r × v đúng bằng b·v∞ — khi đó cận điểm khớp nghiệm giải tích của tham số va chạm b.
  const v0 = Math.sqrt(g.s.vInf ** 2 + (2 * MU_EARTH) / START_DIST_KM);
  const k = g.s.vInf / v0;
  const bVec = g.xi.clone().multiplyScalar(g.b.x * k).addScaledVector(g.zeta, g.b.y * k);
  const start = bVec.clone().addScaledVector(g.S, -START_DIST_KM);
  const vel = g.S.clone().multiplyScalar(v0);
  g.traj = integrateFlyby(start.toArray(), vel.toArray(), { rSurface: R_EARTH, rStop: START_DIST_KM });
  // Hình học đường bay hiển thị
  const pts = g.traj.samples, arr = new Float32Array(pts.length * 3), tmp = v3();
  pts.forEach((p, i) => toScene(p.x, p.y, p.z, tmp).toArray(arr, i * 3));
  pathGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  pathGeo.computeBoundingSphere();
  const danger = g.traj.rMin <= R_SAFE;
  pathLine.material.color.set(danger ? 0xff4d6d : g.traj.rMin < R_EARTH + GEO_ALT_KM ? 0xffb347 : 0x3ddc97);
  g.trajDirty = false;
}

/** Áp dụng Δv (m/s) tại thời điểm còn tRem giây ⇒ dịch chuyển trên mặt phẳng B. */
function applyDv(dv, tRem) {
  const g = game;
  const shift = bPlaneShiftKm(dv, Math.max(tRem, 60));
  g.b.addScaledVector(g.push, shift);
  g.dvTotal += dv;
  g.trajDirty = true;
  return shift;
}

const tRemaining = () => Math.max(0, game.s.T * (1 - game.elapsed / GAME_SECONDS));

// ---------------------------------------------------------------------------
//  Vũ khí
// ---------------------------------------------------------------------------
function renderRockets() {
  const g = game;
  $('hRockets').innerHTML = Array.from({ length: g.s.N }, (_, i) => `<span class="${i < g.rocketsLeft ? '' : g.flights.length && i < g.rocketsLeft + g.flights.length ? 'flying' : 'used'}"></span>`).join('');
  $('fireRocket').disabled = g.rocketsLeft <= 0 || g.phase !== 'run';
}

function fireRocket() {
  const g = game;
  if (g.phase !== 'run' || g.rocketsLeft <= 0 || g.paused) return;
  g.rocketsLeft--;
  const astPos = asteroid.position.clone();
  const site = astPos.clone().normalize().multiplyScalar(R * 1.01);
  const body = rocketPrefab ? rocketPrefab.clone(true) : new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const flame = glowSprite('rgba(255,250,220,1)', 'rgba(255,140,40,0.6)');
  flame.scale.setScalar(R * 0.05);
  const obj = new THREE.Group(); obj.add(body, flame);
  scene.add(obj);
  g.flights.push({ obj, flame, site, t: 0, dur: 2.6 });
  renderRockets();
  toast('🚀 Đã phóng tàu va chạm', `Khối lượng ${fmt.num(g.s.mSc)} kg, va chạm ở ${fmt.num(g.s.u, 1)} km/s`, 'info', 2000);
}

function updateRockets(dt) {
  const g = game;
  for (let i = g.flights.length - 1; i >= 0; i--) {
    const f = g.flights[i];
    f.t += dt;
    const k = Math.min(1, f.t / f.dur), e = k * k;
    const target = asteroid.position;
    const ctrl = f.site.clone().multiplyScalar(1.6);
    // đường cong Bézier bậc 2: bệ phóng → điểm điều khiển → tiểu hành tinh
    const p = f.site.clone().multiplyScalar((1 - e) ** 2).addScaledVector(ctrl, 2 * (1 - e) * e).addScaledVector(target, e * e);
    const prev = f.obj.position.clone();
    f.obj.position.copy(p);
    if (p.distanceToSquared(prev) > 1e-6) f.obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(prev).normalize());
    f.flame.position.set(0, -R * 0.02, 0);
    f.flame.material.opacity = 0.6 + Math.random() * 0.4;
    if (k >= 1) {
      scene.remove(f.obj);
      g.flights.splice(i, 1);
      const dv = kineticDv({ mass: g.s.mSc, speed: g.s.u, beta: g.s.beta, asteroidMass: g.s.M });
      const tRem = tRemaining();
      const shift = applyDv(dv, tRem);
      burst(asteroid.position, 0xffc070);
      if (dog && !dog.muted && g.flights.length === 0) {
        const lbl = $('astLabel').getBoundingClientRect();
        dog.visit(lbl.left, lbl.top + 80, { say: shift > 500 ? `Trúng! Lệch thêm ${fmt.num(shift)} km.` : `Trúng, nhưng chỉ lệch ${fmt.num(shift)} km — phóng sớm hơn nhé!`, mood: shift > 500 ? 'hop' : 'think', stay: 3500 });
      }
      toast('💥 Va chạm trúng đích!', `Δv = ${fmt.sig(dv * 1000)} mm/s · còn ${leadText(tRem / DAY)} ⇒ lệch ${fmt.num(shift)} km`, 'ok', 3200);
      renderRockets();
    }
  }
}

const bursts = [];
function burst(pos, color) {
  const s = glowSprite('rgba(255,255,255,1)', `#${new THREE.Color(color).getHexString()}`);
  s.position.copy(pos); s.scale.setScalar(R * 0.05);
  scene.add(s); bursts.push({ s, t: 0 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i]; b.t += dt;
    b.s.scale.setScalar(R * (0.05 + b.t * 0.6));
    b.s.material.opacity = Math.max(0, 1 - b.t / 0.8);
    if (b.t > 0.8) { scene.remove(b.s); bursts.splice(i, 1); }
  }
}

/** Đoạn thẳng a→b có bị Trái Đất che không? */
function blocked(a, b) {
  const d = b.clone().sub(a), t = THREE.MathUtils.clamp(-a.dot(d) / d.lengthSq(), 0, 1);
  return a.clone().addScaledVector(d, t).length() < R * 1.02;
}

function updateLaser(dt, dtGame) {
  const g = game;
  const wants = g.firing && g.phase === 'run' && g.s.P > 0;
  let on = false, state = 'Sẵn sàng';
  if (g.overheated) { state = '🔥 Quá nhiệt — đang làm mát…'; if (g.heat < 30) g.overheated = false; }
  else if (wants) {
    if (blocked(sat.position, asteroid.position)) { state = '🌍 Trái Đất che khuất — chờ vệ tinh quay tới'; if (!g.saidBlocked) { g.saidBlocked = true; dog?.say('Trái Đất đang che — chờ vệ tinh quay ra rồi bắn!', 'think'); } }
    else { on = true; state = `🔆 Đang bóc tách — hiệu suất ${fmt.sig(laserEfficiency(g.s.vInf * tRemaining()) * 100)}%`; }
  }
  if (!g.s.P) state = 'Không trang bị laser';
  g.heat = THREE.MathUtils.clamp(g.heat + (on ? 34 : -18) * dt, 0, 100);
  if (g.heat >= 100) g.overheated = true;
  g.laserOn = on;
  beam.visible = beamGlow.visible = beamHit.visible = on;
  if (on) {
    const a = laserAccel({ power: g.s.P, coupling: LASER_COUPLING, asteroidMass: g.s.M });
    applyDv(a * laserEfficiency(g.s.vInf * tRemaining()) * dtGame, tRemaining());
    const from = sat.position, to = asteroid.position, mid = from.clone().add(to).multiplyScalar(0.5);
    const len = from.distanceTo(to), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    const w = R * 0.006 * (0.8 + 0.4 * Math.random());
    beam.position.copy(mid); beam.quaternion.copy(q); beam.scale.set(w, len, w);
    beamGlow.position.copy(mid); beamGlow.quaternion.copy(q); beamGlow.scale.set(w * 4, len, w * 4);
    beamHit.position.copy(to); beamHit.scale.setScalar(R * (0.06 + Math.random() * 0.03));
  }
  $('hHeat').style.width = `${g.heat}%`;
  $('hLaserState').textContent = state;
  $('fireLaser').classList.toggle('firing', on);
}

// ---------------------------------------------------------------------------
//  Mặt phẳng B (canvas 2D)
// ---------------------------------------------------------------------------
const cv = $('bplane'), ctx = cv.getContext('2d');
function drawBPlane() {
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
  ctx.clearRect(0, 0, W, H);
  const g = game;
  if (!g.s) {
    ctx.fillStyle = 'rgba(143,156,186,0.8)'; ctx.font = '26px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Bắt đầu nhiệm vụ để xem', cx, cy - 10); ctx.fillText('điểm xuyên mặt phẳng B', cx, cy + 26);
    return;
  }
  const span = Math.max(g.bSafe * 1.7, g.bDisp.length() * 1.25);
  const k = (W * 0.46) / span;
  // lưới
  ctx.strokeStyle = 'rgba(150,175,230,0.12)'; ctx.lineWidth = 1;
  const stepKm = Math.pow(10, Math.floor(Math.log10(span / 2)));
  for (let x = -Math.ceil(span / stepKm) * stepKm; x <= span; x += stepKm) {
    ctx.beginPath(); ctx.moveTo(cx + x * k, 0); ctx.lineTo(cx + x * k, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy + x * k); ctx.lineTo(W, cy + x * k); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(143,156,186,0.7)'; ctx.font = '20px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
  ctx.fillText(`lưới: ${fmt.num(stepKm)} km`, 14, H - 16);
  ctx.fillText('ξ →', W - 64, cy - 8); ctx.fillText('ζ ↑', cx + 8, 26);
  // vùng bắt giữ an toàn
  ctx.setLineDash([10, 8]); ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, g.bSafe * k, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,77,109,0.07)'; ctx.fill();
  // Trái Đất
  const gr = ctx.createRadialGradient(cx - R_EARTH * k * 0.3, cy - R_EARTH * k * 0.3, 2, cx, cy, R_EARTH * k);
  gr.addColorStop(0, '#6fb6ff'); gr.addColorStop(1, '#1f4fa8');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R_EARTH * k, 0, Math.PI * 2); ctx.fill();
  // vết lịch sử
  ctx.strokeStyle = 'rgba(255,210,63,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
  g.history.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, cx + p.x * k, cy - p.y * k)); ctx.lineTo(cx + g.bDisp.x * k, cy - g.bDisp.y * k); ctx.stroke();
  // hướng đẩy
  const px = cx + g.bDisp.x * k, py = cy - g.bDisp.y * k;
  ctx.strokeStyle = 'rgba(94,231,255,0.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px, py);
  const ax = px + g.push.x * 46, ay = py - g.push.y * 46; ctx.lineTo(ax, ay); ctx.stroke();
  const ang = Math.atan2(-(g.push.y), g.push.x);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 12 * Math.cos(ang - 0.4), ay - 12 * Math.sin(ang - 0.4)); ctx.lineTo(ax - 12 * Math.cos(ang + 0.4), ay - 12 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fillStyle = 'rgba(94,231,255,0.9)'; ctx.fill();
  // điểm hiện tại
  const glow = ctx.createRadialGradient(px, py, 0, px, py, 26); glow.addColorStop(0, 'rgba(255,210,63,0.9)'); glow.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
//  HUD & giải thích vật lý
// ---------------------------------------------------------------------------
let hudTimer = 0;
function updateHud() {
  const g = game, tRem = tRemaining(), days = tRem / DAY;
  $('hDays').textContent = days >= 2 ? fmt.num(days) : fmt.num(days * 24, 1);
  $('hDaysUnit').textContent = days >= 2 ? 'ngày' : 'giờ';
  document.querySelector('.countdown').classList.toggle('urgent', days < g.s.T / DAY * 0.2);
  $('hDist').innerHTML = `${fmt.sig((g.s.vInf * tRem) / 1e6)} <small>triệu km</small>`;
  $('hDv').innerHTML = `${fmt.sig(g.dvTotal * 1000)} <small>mm/s</small>`;
  const rMin = g.traj.rMin, alt = rMin - R_EARTH;
  const v = $('hVerdict');
  if (rMin <= R_SAFE) { v.className = 'verdict hit'; v.innerHTML = `⚠️ SẼ VA CHẠM<small>Đường bay cắt khí quyển Trái Đất</small>`; }
  else if (alt < GEO_ALT_KM) { v.className = 'verdict close'; v.innerHTML = `Trượt — cách bề mặt ${fmt.num(alt)} km<small>Đi qua bên trong quỹ đạo vệ tinh địa tĩnh</small>`; }
  else { v.className = 'verdict miss'; v.innerHTML = `✅ An toàn — cách bề mặt ${fmt.num(alt)} km<small>Tiểu hành tinh sẽ bay sượt qua</small>`; }
  const prog = Math.min(1, g.b.length() / (g.bSafe * 1.15));
  $('hProg').style.width = `${prog * 100}%`;
  $('hSafe').textContent = `${fmt.num(g.bSafe)} km`;

  const s = g.s, lev = leverage(tRem);
  const dvR = kineticDv({ mass: s.mSc, speed: s.u, beta: s.beta, asteroidMass: s.M });
  const a = laserAccel({ power: s.P, coupling: LASER_COUPLING, asteroidMass: s.M });
  $('physics').innerHTML = `
    <b>Khối lượng</b> M = π/6·ρ·D³ = ${fmt.sig(s.M / 1000)} tấn
    <span class="formula">Tàu va chạm: Δv = β·m·u / M = ${fmt.sig(dvR * 1000)} mm/s</span>
    ${s.P ? `<span class="formula">Laser: a = Cₘ·P / M = ${fmt.sig(a * 1e6)} µm/s² × hiệu suất ${fmt.sig(laserEfficiency(s.vInf * tRem) * 100)}%</span>` : ''}
    <b>Đòn bẩy thời gian</b> — còn ${leadText(tRem / DAY)}, hệ số k = ${fmt.num(lev, 2)}:
    <span class="formula">Δζ = k·Δv·t ⇒ 1 mm/s lúc này dịch ${fmt.num(bPlaneShiftKm(0.001, tRem))} km</span>
    <b>Hội tụ hấp dẫn</b> — lực hút Trái Đất mở rộng "bia":
    <span class="formula">b⊕ = R·√(1 + v_esc²/v∞²) = ${fmt.num(g.bSafe)} km</span>
    Điểm xuyên hiện tại cách tâm <b>${fmt.num(g.b.length())} km</b>.`;
}

// ---------------------------------------------------------------------------
//  Kết thúc ván
// ---------------------------------------------------------------------------
function finish() {
  const g = game;
  g.phase = 'ending';
  g.firing = false;
  if (g.traj.hit) {
    const end = g.traj.samples.at(-1), prev = g.traj.samples.at(-3) || g.traj.samples[0];
    const hit = toScene(end.x, end.y, end.z);
    const ll = G.toLatLng(hit);
    const vel = new THREE.Vector3(end.x - prev.x, end.y - prev.y, end.z - prev.z).normalize();
    const n = new THREE.Vector3(end.x, end.y, end.z).normalize();
    const angle = THREE.MathUtils.clamp(Math.asin(-vel.dot(n)) * 180 / Math.PI, 5, 90);
    const vSurf = Math.sqrt(g.s.vInf ** 2 + escapeVelocity(R_EARTH) ** 2);
    const land = isLand(ll.lat, ll.lng);
    const fx = computeImpact({ diameter: g.s.D, density: g.s.rho, velocity: vSurf, angle, target: land === false ? 'water' : 'sedimentary' });
    burst(hit, 0xff7a45); burst(hit, 0xffffff);
    const sc = world.getScreenCoords(ll.lat, ll.lng, 0), fl = $('flash');
    fl.style.setProperty('--fx', `${sc.x}px`); fl.style.setProperty('--fy', `${sc.y}px`);
    fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    asteroid.visible = false; $('astLabel').classList.add('hidden');
    const zones = [
      ...fx.blast.filter(b => b.psi !== 20 && b.radius > 0).map(b => ({ r: b.radius, c: b.color, l: `${b.psi} psi` })),
      ...(fx.crater ? [{ r: fx.crater.diameter / 2, c: '#b5651d', l: 'Hố' }] : []),
    ];
    world.polygonsData(zones.map((z, i) => ({ geometry: { type: 'Polygon', coordinates: [geodesicRing(ll.lat, ll.lng, Math.min(z.r / 1000, 12000), 120)] }, ...z, alt: 0.002 + i * 0.0015 })))
      .polygonCapColor(d => `${d.c}33`).polygonSideColor(() => 'rgba(0,0,0,0)').polygonStrokeColor(d => d.c).polygonAltitude(d => d.alt);
    world.pointOfView({ lat: ll.lat, lng: ll.lng, altitude: 1.6 }, 1500);
    const url = `./impact.html?d=${g.s.D}&rho=${g.s.rho}&v=${fmt.num(vSurf, 1).replace(',', '.')}&angle=${Math.round(angle)}&lat=${ll.lat.toFixed(3)}&lng=${ll.lng.toFixed(3)}&name=${encodeURIComponent('Phòng thủ thất bại')}`;
    setTimeout(() => endModal(false, { fx, ll, angle, url }), 1600);
    dog?.sad('Ôi không… Thử lại và phóng tàu sớm hơn nhé!');
  } else {
    setTimeout(() => endModal(true, {}), 2500);
    setTimeout(() => dog?.celebrate('Gâu gâu! Trái Đất an toàn rồi!', innerWidth / 2, innerHeight / 2), 600);
  }
}

function endModal(win, { fx, ll, angle, url }) {
  const g = game;
  g.phase = 'end';
  const alt = g.traj.rMin - R_EARTH;
  $('endCard').innerHTML = win ? `
    <div class="end-hero">🛡️</div>
    <h3>Trái Đất an toàn!</h3>
    <p class="lead">Tiểu hành tinh bay sượt qua ở độ cao <b>${fmt.num(alt)} km</b> so với bề mặt${alt < GEO_ALT_KM ? ' — bên trong vành đai vệ tinh địa tĩnh, đủ gần để thấy bằng mắt thường!' : '.'}</p>
    <div class="stat-grid" style="margin-top:14px">
      <div class="stat"><div class="k">Tổng Δv đã tác dụng</div><div class="v">${fmt.sig(g.dvTotal * 1000)} <small>mm/s</small></div></div>
      <div class="stat"><div class="k">Tàu va chạm đã dùng</div><div class="v">${g.s.N - g.rocketsLeft} / ${g.s.N}</div></div>
    </div>
    <div class="note" style="margin-top:12px">Chỉ cần thay đổi vận tốc <b>${fmt.sig(g.dvTotal * 1000)} mm/s</b> — chậm hơn một con ốc sên — nhưng tác dụng sớm nên đã dịch đường bay hàng nghìn km. Đây là lý do các chương trình như NASA PDCO, ESA Hera ưu tiên <b>phát hiện sớm</b>.</div>
    <div class="modal-actions"><button class="btn" data-close id="mSetup">Đổi thiết lập</button><button class="btn btn-primary" id="mAgain">Chơi lại</button></div>`
  : `
    <div class="end-hero">💥</div>
    <h3>Phòng thủ thất bại</h3>
    <p class="lead">Tiểu hành tinh rơi xuống ${isLand(ll.lat, ll.lng) === false ? 'đại dương' : 'đất liền'} tại <b>${fmt.num(ll.lat, 2)}°, ${fmt.num(ll.lng, 2)}°</b>, góc ${fmt.num(angle)}°.</p>
    <div class="stat-grid" style="margin-top:14px">
      <div class="stat"><div class="k">Năng lượng</div><div class="v" style="font-size:14px">${fmt.energy(fx.energyMt)}</div></div>
      <div class="stat"><div class="k">${fx.isAirburst ? 'Nổ trên không ở' : 'Hố va chạm'}</div><div class="v">${fx.isAirburst ? `${fmt.num(fx.airburstAlt / 1000, 1)} km` : fx.crater ? fmt.dist(fx.crater.diameter) : '—'}</div></div>
      <div class="stat"><div class="k">Vùng nhà sập (5 psi)</div><div class="v">${fmt.dist(fx.blast.find(b => b.psi === 5).radius)}</div></div>
      <div class="stat"><div class="k">Còn thiếu</div><div class="v">${fmt.num(Math.max(0, g.bSafe - g.b.length()))} <small>km</small></div></div>
    </div>
    <div class="note" style="margin-top:12px">Gợi ý: phóng tàu va chạm <b>càng sớm càng tốt</b> — cùng một Δv, tác dụng khi còn 1 năm hiệu quả gấp ~${fmt.num(bPlaneShiftKm(1, 365 * DAY) / bPlaneShiftKm(1, 30 * DAY), 0)} lần so với khi còn 1 tháng.</div>
    <div class="modal-actions"><a class="btn" href="${url}">☄️ Xem chi tiết hậu quả</a><button class="btn" data-close id="mSetup">Đổi thiết lập</button><button class="btn btn-primary" id="mAgain">Thử lại</button></div>`;
  openModal('endModal');
  $('mAgain').addEventListener('click', () => { closeModal('endModal'); resetScene(); newGame(); });
  $('mSetup').addEventListener('click', () => { resetScene(); toSetup(); });
}

function resetScene() {
  game.flights?.forEach(f => scene.remove(f.obj));
  world.polygonsData([]);
  beam.visible = beamGlow.visible = beamHit.visible = false;
}
function toSetup() {
  game = { phase: 'setup' };
  asteroid.visible = false; $('astLabel').classList.add('hidden');
  pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  $('setup').classList.remove('hidden'); $('hud').classList.add('hidden');
  $('leftTitle').innerHTML = `Thiết lập nhiệm vụ<span class="sub">Đẩy lệch tiểu hành tinh kịp thời</span>`;
  $('physics').innerHTML = '<div class="muted">Bắt đầu nhiệm vụ để xem các đại lượng vật lý thay đổi theo thời gian.</div>';
  drawBPlane();
}

// ---------------------------------------------------------------------------
//  Vòng lặp
// ---------------------------------------------------------------------------
const tmpA = [0, 0, 0], tmpV = v3();
let last = performance.now();
function loop(now) {
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  const g = game;
  // vệ tinh luôn quay
  const satSpeed = g.phase === 'run' && !g.paused ? g.speed : 1;
  if (!g.paused) g.satTh = (g.satTh ?? 0) + (dtReal * satSpeed * Math.PI * 2) / SAT_PERIOD;
  satPos(g.satTh ?? 0, sat.position);
  sat.lookAt(0, 0, 0);

  if (g.phase === 'run' && !g.paused) {
    const dt = dtReal * g.speed;
    const dtGame = dt * (g.s.T / GAME_SECONDS);   // giây "thật" của vũ trụ trôi qua
    g.elapsed += dt;
    updateLaser(dt, dtGame);
    updateRockets(dt);
    g.trajTimer += dtReal;
    if (g.trajDirty && g.trajTimer > 0.12) { g.trajTimer = 0; recomputeTrajectory(); g.history.push(g.b.clone()); if (g.history.length > 400) g.history.shift(); }
    if (g.elapsed >= GAME_SECONDS) { if (g.trajDirty) recomputeTrajectory(); finish(); }
  } else if (g.phase === 'ending' || g.phase === 'end') {
    if (!g.traj.hit) g.elapsed += dtReal;          // trượt qua: tiếp tục bay ra xa
    updateRockets(dtReal);
  } else if (g.phase === 'run') updateLaser(0, 0);

  if (g.traj && asteroid.visible) {
    const tau = g.traj.tArrival * (g.elapsed / GAME_SECONDS);
    sampleAt(g.traj.samples, tau, tmpA);
    toScene(tmpA[0], tmpA[1], tmpA[2], asteroid.position);
    rock.rotation.x += dtReal * 0.4; rock.rotation.y += dtReal * 0.25;
    // nhãn bám theo tiểu hành tinh
    const p = tmpV.copy(asteroid.position).project(world.camera());
    const lbl = $('astLabel');
    lbl.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    lbl.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    lbl.style.opacity = p.z < 1 ? 1 : 0;
  }
  if (g.bDisp) g.bDisp.lerp(g.b, Math.min(1, dtReal * 6));
  updateBursts(dtReal);
  hudTimer += dtReal;
  if (g.s && hudTimer > 0.15) { hudTimer = 0; if (g.phase === 'run') updateHud(); drawBPlane(); }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
//  Điều khiển
// ---------------------------------------------------------------------------
let scenarioName = '';
let dog = null;
$('start').addEventListener('click', () => newGame());
$('fireRocket').addEventListener('click', fireRocket);
const laserBtn = $('fireLaser');
const setFiring = v => { if (game.phase === 'run') game.firing = v; };
laserBtn.addEventListener('pointerdown', e => { e.preventDefault(); setFiring(true); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => laserBtn.addEventListener(ev, () => setFiring(false)));
$('speed').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || game.phase !== 'run') return;
  game.speed = +b.dataset.v;
  $('speed').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});
function togglePause() {
  if (game.phase !== 'run') return;
  game.paused = !game.paused; game.firing = false;
  $('pause').textContent = game.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
}
$('pause').addEventListener('click', togglePause);
$('abort').addEventListener('click', () => { resetScene(); toSetup(); });
addEventListener('keydown', e => {
  if (e.target.matches('input, select')) return;
  if (e.code === 'Space') { e.preventDefault(); setFiring(true); }
  else if (e.key.toLowerCase() === 'r' && !e.repeat) fireRocket();
  else if (e.key.toLowerCase() === 'p') togglePause();
});
addEventListener('keyup', e => { if (e.code === 'Space') setFiring(false); });

// ---------------------------------------------------------------------------
//  Khởi động
// ---------------------------------------------------------------------------
(async () => {
  initRanges();
  const q = new URLSearchParams(location.search);
  applyPreset(PRESETS.normal);
  if (q.has('d')) {
    const vAtm = +q.get('v') || 20;
    els.D.value = THREE.MathUtils.clamp(+q.get('d'), 20, 1000);
    const rho = +q.get('rho'); if (rho) els.comp.value = String(COMPOSITIONS.reduce((a, c) => Math.abs(c.rho - rho) < Math.abs(a.rho - rho) ? c : a).rho);
    els.V.value = THREE.MathUtils.clamp(Math.sqrt(Math.max(16, vAtm ** 2 - 11.19 ** 2)), 4, 30);
    scenarioName = q.get('name') || '';
    if (scenarioName) $('leftSub').textContent = `Kịch bản: ${scenarioName}`;
    Object.values(els).forEach(el => el.type === 'range' && paintRange(el));
    updateSetup();
  }
  toSetup();
  requestAnimationFrame(loop);
  load.set(0.5, 'Tải mô hình vệ tinh & tên lửa…');
  const loader = new GLTFLoader();
  const [satG, rocketG] = await Promise.allSettled([loader.loadAsync('./models/satellite.glb'), loader.loadAsync('./models/rocket.glb'), landReady]);
  if (satG.status === 'fulfilled') sat.add(fitModel(satG.value.scene, R * 0.14));
  else sat.add(new THREE.Mesh(new THREE.BoxGeometry(R * 0.05, R * 0.02, R * 0.12), new THREE.MeshStandardMaterial({ color: 0xccddee })));
  const satGlow = glowSprite('rgba(180,240,255,0.9)', 'rgba(94,231,255,0.2)');
  satGlow.scale.set(R * 0.05, R * 0.05, 1);
  sat.add(satGlow);
  if (rocketG.status === 'fulfilled') rocketPrefab = fitModel(rocketG.value.scene, R * 0.06, true);
  load.done();
  dog = initBuddy('defense', { explain: () => {
    const g = game;
    if (g.phase !== 'run' && g.phase !== 'ending') return 'Chọn độ khó rồi bấm “Bắt đầu nhiệm vụ”.';
    const t = tRemaining(), need = Math.max(0, g.bSafe - g.b.length());
    return need > 0
      ? `Còn thiếu ${fmt.num(need)} km để ra khỏi vòng đỏ.`
      : `Đã an toàn: bay sượt ở độ cao ${fmt.num(g.traj.rMin - R_EARTH)} km.`;
  } });
  if (innerWidth < 900) $('rightPanel').classList.add('m-hide');
})();
