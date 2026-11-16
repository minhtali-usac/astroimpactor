// ============================================================================
//  Trang 2 — Mô phỏng va chạm thiên thạch
//  Vật lý: src/lib/impact.js (Collins, Melosh & Marcus 2005)
//  Hiển thị: globe.gl — các vùng ảnh hưởng vẽ ĐÚNG bán kính thực trên mặt cầu.
// ============================================================================
import * as THREE from 'three';
import { computeImpact, energyComparison, TARGETS } from '../lib/impact.js';
import { geodesicRing, destination, haversineKm, normLng } from '../lib/geo.js';
import { HISTORIC_EVENTS, COMPOSITIONS, CITIES } from '../lib/places.js';
import { createEarthGlobe, isLand, landReady } from '../lib/globe.js';
import * as fmt from '../lib/format.js';
import { mountTopbar, initTooltips, initRanges, paintRange, initCollapsibles, initModals, openModal, toast, loader as makeLoader } from '../lib/ui.js';

mountTopbar('impact', '', {
  question: 'Điều gì thực sự quyết định mức độ tàn phá của một vụ va chạm?',
  help: `<ul class="about-list">
  <li><span>①</span><div><b>Chọn một sự kiện lịch sử</b> (Chelyabinsk, Tunguska, Chicxulub…) để tái hiện, hoặc tự nhập thông số.</div></li>
  <li><span>②</span><div><b>Thiên thạch:</b> đường kính, thành phần (khối lượng riêng), vận tốc vào khí quyển và góc so với mặt đất.</div></li>
  <li><span>③</span><div><b>Vị trí:</b> nhấp lên quả địa cầu; bề mặt (đất liền/đại dương) được nhận diện tự động.</div></li>
  <li><span>☄</span><div><b>Thả thiên thạch</b> để xem hoạt cảnh và các vùng ảnh hưởng vẽ đúng bán kính thật. Nhấp vào từng vùng trong bảng kết quả để ẩn/hiện.</div></li>
  <li><span>📐</span><div>Nút <b>Phương pháp & công thức</b> trình bày mô hình Collins, Melosh &amp; Marcus (2005) và các giới hạn của nó.</div></li>
</ul>`,
});
initTooltips();
initModals();
initCollapsibles();
const load = makeLoader();

// ---------------------------------------------------------------------------
//  Trạng thái & điều khiển
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const els = {
  diameter: $('iDiameter'), unit: $('iUnit'), comp: $('iComp'), vel: $('iVel'), angle: $('iAngle'),
  lat: $('iLat'), lng: $('iLng'), depth: $('iDepth'), target: $('iTarget'),
};
const state = { density: 2750, target: 'water', targetAuto: true, layers: {}, result: null, landed: false, scenario: null };

els.comp.innerHTML = COMPOSITIONS.map(c => `<option value="${c.rho}" ${c.rho === 2750 ? 'selected' : ''}>${c.label} — ${fmt.num(c.rho)} kg/m³</option>`).join('')
  + `<option value="custom">Tuỳ chỉnh…</option>`;

const params = () => ({
  diameter: Math.max(0.1, +els.diameter.value || 1) * (els.unit.value === 'km' ? 1000 : 1),
  density: state.density,
  velocity: +els.vel.value,
  angle: +els.angle.value,
  target: state.target,
  waterDepth: +els.depth.value,
  lat: THREE.MathUtils.clamp(+els.lat.value || 0, -90, 90),
  lng: normLng(+els.lng.value || 0),
});

function setTarget(t, auto = false) {
  state.target = t;
  state.targetAuto = auto;
  els.target.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === t));
  $('depthField').classList.toggle('hidden', t !== 'water');
}
function detectSurface() {
  const p = params();
  const land = isLand(p.lat, p.lng);
  if (land === null) { $('iSurfaceAuto').textContent = ''; return; }
  $('iSurfaceAuto').textContent = land ? 'tự nhận diện: đất liền' : 'tự nhận diện: đại dương';
  if (!land && state.target !== 'water') setTarget('water', true);
  if (land && state.target === 'water') setTarget('sedimentary', true);
}

function syncLabels() {
  $('iVelOut').textContent = `${fmt.num(+els.vel.value, 1)} km/s`;
  $('iAngleOut').textContent = `${els.angle.value}°`;
  $('iDepthOut').textContent = `${fmt.num(+els.depth.value)} m`;
  $('iDensityOut').textContent = `${fmt.num(state.density)} kg/m³`;
}

els.comp.addEventListener('change', () => {
  if (els.comp.value === 'custom') {
    const v = Number(prompt('Khối lượng riêng (kg/m³):', state.density));
    if (Number.isFinite(v) && v >= 300 && v <= 9000) state.density = v;
    els.comp.value = [...els.comp.options].some(o => +o.value === state.density) ? String(state.density) : 'custom';
  } else state.density = +els.comp.value;
  onParamChange();
});
els.target.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setTarget(b.dataset.v); onParamChange(); } });
[els.diameter, els.unit, els.vel, els.angle, els.depth].forEach(el => el.addEventListener('input', onParamChange));
[els.lat, els.lng].forEach(el => el.addEventListener('change', () => { detectSurface(); updateTargetMarker(); onParamChange(); }));

// ---------------------------------------------------------------------------
//  Dân số (11.286 khu đô thị, ~2,46 tỷ người)
// ---------------------------------------------------------------------------
let POP = null;
async function loadPopulation() {
  const txt = await (await fetch('./data/population.csv')).text();
  const rows = txt.trim().split('\n').slice(1);
  POP = { lat: new Float32Array(rows.length), lng: new Float32Array(rows.length), n: new Float64Array(rows.length) };
  rows.forEach((r, i) => { const [a, b, c] = r.split(','); POP.lat[i] = +a; POP.lng[i] = +b; POP.n[i] = +c; });
}
function populationWithin(lat, lng, radiiKm) {
  const out = radiiKm.map(() => 0);
  if (!POP) return out;
  for (let i = 0; i < POP.n.length; i++) {
    const d = haversineKm(lat, lng, POP.lat[i], POP.lng[i]);
    for (let z = 0; z < radiiKm.length; z++) if (d <= radiiKm[z]) out[z] += POP.n[i];
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Quả địa cầu
// ---------------------------------------------------------------------------
const G = createEarthGlobe($('globe'), { renderHtml: renderHtml });
const { world, R } = G;
world.pointOfView({ lat: 14, lng: 110, altitude: 2.2 }, 0);

function renderHtml(d) {
  const el = document.createElement('div');
  if (d.kind === 'event') {
    el.className = 'g-event';
    el.innerHTML = `<div class="pin" title="${d.name}"></div><div class="tag">${d.name}</div>`;
    el.querySelector('.pin').addEventListener('click', e => { e.stopPropagation(); runEvent(d.id); });
  } else if (d.kind === 'target') {
    el.className = 'g-target';
    el.innerHTML = '<i></i><i></i><i></i><i></i>';
  } else if (d.kind === 'zone') {
    el.className = 'g-zone';
    el.style.color = d.color; el.style.border = `1px solid ${d.color}`;
    el.textContent = d.text;
  }
  return el;
}

let zoneLabels = [];
function refreshHtml() {
  const p = params();
  G.setExtraHtml([
    ...HISTORIC_EVENTS.map(e => ({ ...e, kind: 'event', alt: 0.012 })),
    { kind: 'target', lat: p.lat, lng: p.lng, alt: 0.006 },
    ...zoneLabels,
  ]);
}
function updateTargetMarker() { refreshHtml(); }

world.onGlobeClick(({ lat, lng }) => {
  if (anim) return;
  els.lat.value = lat.toFixed(3); els.lng.value = lng.toFixed(3);
  state.scenario = null; $('scenarioName').textContent = 'Kịch bản tuỳ chỉnh';
  document.querySelectorAll('#events .chip').forEach(c => c.classList.remove('on'));
  detectSurface(); clearImpact(); refreshHtml(); onParamChange();
});

// ---------------------------------------------------------------------------
//  Vùng ảnh hưởng
// ---------------------------------------------------------------------------
function zonesFrom(r) {
  const Z = [];
  if (r.water) Z.push({ id: 'cavity', label: 'Khoang nước bị khoét', radius: r.water.cavityDiameter / 2, color: '#9fd8ff', fill: 'rgba(20,60,120,0.75)', desc: `sâu tới ${fmt.dist(Math.min(r.water.depth, r.water.cavityDiameter / 2.8))}` });
  if (r.crater) Z.push({ id: 'crater', label: `Hố ${r.crater.seafloor ? 'đáy biển' : 'va chạm'} (${r.crater.type === 'complex' ? 'phức tạp' : 'đơn giản'})`, radius: r.crater.diameter / 2, color: '#b5651d', fill: 'rgba(60,30,12,0.85)', desc: `sâu ${fmt.dist(r.crater.depth)}` });
  if (r.fireballRadius > 0) Z.push({ id: 'fireball', label: 'Quả cầu lửa', radius: r.fireballRadius, color: '#fff1b8', fill: 'rgba(255,240,190,0.55)', desc: 'mọi thứ bốc hơi' });
  for (const t of r.thermal) Z.push({ id: t.id, label: t.label, radius: t.radius, color: t.color, fill: null, group: 'thermal', desc: `nhiệt lượng ≥ ${fmt.sig(t.threshold / 1e6)} MJ/m²` });
  for (const b of r.blast) Z.push({ id: b.id, label: `${b.psi} psi — ${b.label}`, radius: b.radius, color: b.color, fill: null, group: 'blast', desc: `gió ${fmt.num(b.wind * 3.6)} km/h` });
  if (r.water) {
    const r10 = (r.water.rimWaveAmplitude * (r.water.cavityDiameter / 2)) / 10;
    if (r.water.rimWaveAmplitude > 10) Z.push({ id: 'tsunami', label: 'Sóng thần cao ≥ 10 m', radius: r10, color: '#4da3ff', fill: null, group: 'tsunami', desc: `sóng tại mép ${fmt.dist(r.water.rimWaveAmplitude)}` });
  }
  return Z.filter(z => z.radius > 1);
}
const DEFAULT_LAYERS = { cavity: true, crater: true, fireball: true, op20: true, op5: true, op1: true, th3: false, th2: false, th1: true, tsunami: true };

function drawZones() {
  const r = state.result, p = r?.p;
  if (!r || !state.landed) { world.polygonsData([]); zoneLabels = []; refreshHtml(); return; }
  const zones = r.zones.filter(z => state.layers[z.id] ?? DEFAULT_LAYERS[z.id]).sort((a, b) => b.radius - a.radius);
  const polys = zones.map((z, i) => {
    const km = Math.min(z.radius / 1000, 15000);
    const jitter = (z.id === 'crater' || z.id === 'cavity') ? (th => 1 + 0.04 * Math.sin(5 * th + 1) + 0.03 * Math.sin(11 * th)) : null;
    return {
      type: 'Feature', properties: { ...z, alt: 0.0015 + i * 0.0015 },
      geometry: { type: 'Polygon', coordinates: [geodesicRing(p.lat, p.lng, km, km > 2000 ? 180 : 120, jitter)] },
    };
  });
  world.polygonsData(polys);
  zoneLabels = zones.filter(z => z.radius > 3000 && z.id !== 'crater' && z.id !== 'cavity').map(z => {
    const [lng, lat] = destination(p.lat, p.lng, Math.PI * 0.25, Math.min(z.radius / 1000, 15000) / 6371);
    return { kind: 'zone', lat, lng, alt: 0.003, color: z.color, text: z.id.startsWith('op') ? `${z.label.split(' —')[0]}` : z.label };
  });
  refreshHtml();
}
world
  .polygonsTransitionDuration(400)
  .polygonGeoJsonGeometry('geometry')
  .polygonAltitude(d => d.properties.alt)
  // Vùng rất lớn (> 1.500 km) chỉ vẽ viền: tô kín đa giác khổng lồ trên mặt cầu gây vệt răng cưa
  .polygonCapColor(d => d.properties.radius > 1_500_000 ? 'rgba(0,0,0,0)' : (d.properties.fill ?? hexA(d.properties.color, 0.14)))
  .polygonSideColor(() => 'rgba(0,0,0,0)')
  .polygonStrokeColor(d => d.properties.color)
  .polygonLabel(d => `<div class="g-tip"><b>${d.properties.label}</b><br>bán kính ${fmt.dist(d.properties.radius)}</div>`)
  .ringColor(d => d.color)
  .ringMaxRadius('maxR').ringPropagationSpeed('speed').ringRepeatPeriod('repeat').ringAltitude(0.003);

function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// ---------------------------------------------------------------------------
//  Bảng kết quả
// ---------------------------------------------------------------------------
const seismicWord = M => M < 4 ? 'nhẹ' : M < 5 ? 'nhẹ, cảm nhận rõ' : M < 6 ? 'trung bình' : M < 7 ? 'mạnh' : M < 8 ? 'rất mạnh' : 'cực mạnh';

function renderResults() {
  const r = state.result, p = r.p;
  const cmp = energyComparison(r.energyMt);
  const hiroshima = r.energyMt / 0.015;
  const radiiKm = r.zones.map(z => z.radius / 1000);
  const pops = populationWithin(p.lat, p.lng, radiiKm);
  r.zones.forEach((z, i) => { z.pop = pops[i]; });
  const outer = Math.max(...r.zones.filter(z => z.group === 'blast' || z.group === 'thermal').map(z => z.radius), 0) / 1000;
  const hitCities = CITIES.map(c => ({ ...c, d: haversineKm(p.lat, p.lng, c.lat, c.lng) })).filter(c => c.d <= outer).sort((a, b) => a.d - b.d);
  const levelOf = dkm => { const z = r.zones.filter(z => z.radius / 1000 >= dkm).sort((a, b) => a.radius - b.radius)[0]; return z ? z.label : ''; };

  const kind = r.isAirburst
    ? `<div class="hero air"><div class="k">Nổ trên không ở độ cao</div><div class="v">${fmt.num(r.airburstAlt / 1000, 1)} km</div><div class="c">Thiên thạch vỡ vụn ở ${fmt.num(r.breakupAlt / 1000, 1)} km và bùng nổ trước khi chạm đất — <b>không tạo hố</b>.</div></div>`
    : `<div class="hero"><div class="k">${p.target === 'water' ? 'Rơi xuống đại dương' : 'Va chạm mặt đất'} với vận tốc</div><div class="v">${fmt.num(r.impactVelocity / 1000, 1)} km/s</div><div class="c">${r.intact ? 'Thiên thạch đủ bền, xuyên qua khí quyển gần như nguyên vẹn.' : `Vỡ vụn ở ${fmt.num(r.breakupAlt / 1000, 1)} km nhưng các mảnh vẫn chạm đất.`}</div></div>`;

  const shockArrival = hitCities.length ? (() => { const c = hitCities[0]; return `Sóng xung kích tới <b>${c.name}</b> (cách ${fmt.num(c.d)} km) sau khoảng <b>${fmt.num(c.d / 0.34 / 60, 0)} phút</b>.`; })() : '';

  $('results').innerHTML = `
    ${state.landed ? '' : `<div class="note" style="margin-top:10px">Kết quả <b>dự kiến</b> — cập nhật ngay khi thay đổi thông số. Bấm <b>☄️ Thả thiên thạch</b> để xem mô phỏng và vẽ vùng ảnh hưởng lên bản đồ.</div>`}
    <div class="hero" style="background:linear-gradient(135deg,rgba(139,123,255,.14),rgba(94,231,255,.06));border-color:rgba(139,123,255,.35)">
      <div class="k">Năng lượng giải phóng</div>
      <div class="v" style="color:#d6ceff">${fmt.energy(r.energyMt)}</div>
      <div class="c">≈ ${fmt.sig(hiroshima)} lần bom Hiroshima · ${cmp.ratio >= 0.67 && cmp.ratio <= 1.5 ? 'tương đương' : cmp.ratio < 1 ? `bằng ${fmt.sig(cmp.ratio * 100)}%` : `gấp ${fmt.sig(cmp.ratio)} lần`} ${cmp.label}</div>
    </div>
    ${kind}
    <div class="section">
      <div class="section-title">Diễn biến</div>
      <div class="timeline">
        <div><b>Vào khí quyển</b> ở ${fmt.num(p.velocity, 1)} km/s, khối lượng ${fmt.sig(r.mass / 1000)} tấn</div>
        ${r.breakupAlt ? `<div><b>Vỡ vụn</b> ở ${fmt.num(r.breakupAlt / 1000, 1)} km (áp suất khí động vượt độ bền ${fmt.sig(r.strength / 1e6)} MPa)</div>` : ''}
        <div><b>${r.isAirburst ? 'Bùng nổ' : 'Chạm ' + (p.target === 'water' ? 'mặt nước' : 'đất')}</b>${r.water ? ` — khoét khoang nước rộng ${fmt.dist(r.water.cavityDiameter)}` : ''}${r.crater ? ` — tạo hố ${r.crater.seafloor ? 'đáy biển ' : ''}${fmt.dist(r.crater.diameter)}` : (r.water ? '; nước hãm thiên thạch, không tạo hố đáy biển đáng kể' : '')}</div>
        ${shockArrival ? `<div>${shockArrival}</div>` : ''}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Vùng ảnh hưởng <span class="info" data-tip-title="Bật/tắt lớp" data-tip="Nhấp vào từng vùng để ẩn/hiện trên bản đồ. Dân số tính theo dữ liệu 11.286 khu đô thị."></span></div>
      ${r.zones.length ? r.zones.map(z => `
        <div class="zone ${(state.layers[z.id] ?? DEFAULT_LAYERS[z.id]) ? '' : 'off'}" data-z="${z.id}">
          <span class="sw" style="background:${z.fill ?? hexA(z.color, 0.35)};border:2px solid ${z.color}"></span>
          <span>${z.label}</span><span class="r">${fmt.dist(z.radius)}</span>
          <span class="sub"><span>${z.desc}</span><span>👥 ${fmt.people(z.pop)}</span></span>
        </div>`).join('') : '<div class="muted">Không có vùng ảnh hưởng đáng kể ở mặt đất.</div>'}
    </div>
    ${hitCities.length ? `<div class="section"><div class="section-title">Thành phố trong vùng ảnh hưởng</div>
      <div class="cities">${hitCities.slice(0, 18).map(c => `<span class="${c.vn ? 'vn' : ''}" title="${levelOf(c.d)}">${c.name} · ${fmt.num(c.d)} km</span>`).join('')}</div></div>` : ''}
    <div class="section">
      <div class="section-title">Số liệu khác</div>
      <div class="stat-grid">
        ${r.crater ? `<div class="stat"><div class="k">Đường kính hố</div><div class="v">${fmt.dist(r.crater.diameter)}</div></div>
        <div class="stat"><div class="k">Độ sâu hố</div><div class="v">${fmt.dist(r.crater.depth)}</div></div>` : ''}
        ${r.seismicMagnitude ? `<div class="stat" data-tip="Độ lớn động đất tương đương do sóng địa chấn từ vụ va chạm (Eq. 40)."><div class="k">Động đất</div><div class="v">M ${fmt.num(r.seismicMagnitude, 1)} <small>${seismicWord(r.seismicMagnitude)}</small></div></div>` : ''}
        <div class="stat" data-tip="Khoảng thời gian trung bình giữa hai va chạm có năng lượng tương tự trên Trái Đất (Eq. 3)."><div class="k">Tần suất</div><div class="v" style="font-size:14px">1 lần / ${fmt.years(r.recurrenceYears)}</div></div>
        ${r.fireballRadius ? `<div class="stat"><div class="k">Quả cầu lửa</div><div class="v">${fmt.dist(r.fireballRadius)}</div></div>` : ''}
        ${r.water ? `<div class="stat"><div class="k">Sóng thần cách 100 km</div><div class="v">${fmt.dist(r.water.waveAt(100_000))}</div></div>
        <div class="stat"><div class="k">Sóng thần cách 1.000 km</div><div class="v">${fmt.dist(r.water.waveAt(1_000_000))}</div></div>` : ''}
      </div>
    </div>
    <div class="section"><button class="btn btn-block" id="methodBtn">📐 Phương pháp & công thức</button></div>`;

  $('methodBtn').addEventListener('click', () => openModal('methodModal'));
  $('results').querySelectorAll('.zone').forEach(el => el.addEventListener('click', () => {
    const id = el.dataset.z;
    state.layers[id] = !(state.layers[id] ?? DEFAULT_LAYERS[id]);
    el.classList.toggle('off', !state.layers[id]);
    drawZones();
  }));
}

let renderTimer = 0;
function onParamChange() {
  syncLabels();
  const p = params();
  const r = computeImpact(p);
  r.p = p;
  r.zones = zonesFrom(r);
  state.result = r;
  if (state.landed) { state.landed = false; world.polygonsData([]); zoneLabels = []; refreshHtml(); }
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderResults, 60); // gom các lần kéo thanh trượt liên tiếp
}

// ---------------------------------------------------------------------------
//  Hoạt cảnh thiên thạch lao xuống
// ---------------------------------------------------------------------------
function makeRock() {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position, v = new THREE.Vector3();
  const seed = Math.random() * 10;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 2) * Math.sin(v.z * 3.3 + seed * 3);
    v.multiplyScalar(1 + 0.22 * n + 0.08 * Math.sin(v.x * 9 + v.y * 7));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6b5d52, roughness: 1, emissive: 0xff5a1f, emissiveIntensity: 0.35, flatShading: true }));
}
function glowSprite(inner, outer, opacity = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
}

const fx = new THREE.Group();
world.scene().add(fx);
let anim = null;

function clearImpact() {
  anim = null;
  fx.clear();
  world.ringsData([]);
  state.landed = false;
  world.polygonsData([]);
  zoneLabels = [];
}

function launch() {
  clearImpact();
  const r = state.result, p = r.p;
  const n = G.vec(p.lat, p.lng, 0).normalize();
  const north = G.vec(p.lat + 0.05, p.lng, 0).sub(G.vec(p.lat, p.lng, 0)).normalize();
  const east = G.vec(p.lat, p.lng + 0.05, 0).sub(G.vec(p.lat, p.lng, 0)).normalize();
  const theta = THREE.MathUtils.degToRad(p.angle), heading = THREE.MathUtils.degToRad(70);
  const horiz = north.clone().multiplyScalar(Math.cos(heading)).addScaledVector(east, Math.sin(heading));
  const dir = horiz.multiplyScalar(Math.cos(theta)).addScaledVector(n, -Math.sin(theta)).normalize();
  // Độ cao nổ được phóng đại ×4 để thấy rõ (30 km thật ≈ 0,5% bán kính Trái Đất)
  const burstAltR = r.isAirburst ? Math.max(0.006, (r.airburstAlt / 6_371_000) * 4) : 0;
  const end = n.clone().multiplyScalar(R * (1 + burstAltR));
  const start = end.clone().addScaledVector(dir, -R * 1.5);

  const rock = makeRock();
  const size = R * 0.012 * THREE.MathUtils.clamp(Math.log10(p.diameter) / 2, 0.6, 2.6);
  rock.scale.setScalar(size);
  const glow = glowSprite('rgba(255,250,220,1)', 'rgba(255,140,40,0.6)');
  glow.scale.setScalar(size * 9);
  const TRAIL = 48;
  const trailGeo = new THREE.BufferGeometry();
  const trailPos = new Float32Array(TRAIL * 3), trailCol = new Float32Array(TRAIL * 3);
  for (let i = 0; i < TRAIL; i++) { start.toArray(trailPos, i * 3); new THREE.Color().setHSL(0.07, 1, 0.6 * (1 - i / TRAIL)).toArray(trailCol, i * 3); }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ size: size * 3.2, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  fx.add(rock, glow, trail);

  // camera nhìn chéo về điểm va chạm
  const altView = THREE.MathUtils.clamp((r.maxRadius / 6_371_000) * 3.2, 0.35, 2.6);
  world.pointOfView({ lat: p.lat - 6 * Math.min(1, altView), lng: p.lng - 10 * Math.min(1, altView), altitude: altView }, 1100);

  anim = { phase: 'fly', t0: performance.now() + 900, dur: 2300, start, end, dir, rock, glow, trail, trailPos, r, p, n };
  $('launch').disabled = true;
  requestAnimationFrame(step);
}

function step(now) {
  if (!anim) return;
  const a = anim;
  if (a.phase === 'fly') {
    const t = Math.max(0, (now - a.t0) / a.dur);
    const k = Math.min(1, t * t * (1.2 - 0.2 * t));          // tăng tốc dần
    const pos = a.start.clone().lerp(a.end, k);
    a.rock.position.copy(pos);
    a.rock.rotation.x += 0.05; a.rock.rotation.y += 0.03;
    a.glow.position.copy(pos);
    a.glow.material.opacity = 0.6 + 0.4 * Math.random();
    a.trailPos.copyWithin(3, 0, a.trailPos.length - 3);
    pos.toArray(a.trailPos, 0);
    a.trail.geometry.attributes.position.needsUpdate = true;
    if (k >= 1) explode(a);
  } else if (a.phase === 'boom') {
    const t = (now - a.t0) / 1000;
    const e = 1 - Math.exp(-t * 2.2);
    a.fireball.scale.setScalar(a.fbSize * (0.2 + e));
    a.fireball.material.opacity = Math.max(0, 1 - t / 2.6);
    a.flashSprite.scale.setScalar(a.fbSize * (1 + t * 6));
    a.flashSprite.material.opacity = Math.max(0, 1 - t / 0.9);
    const P = a.debris.geometry.attributes.position, V = a.debrisVel;
    for (let i = 0; i < V.length; i += 3) {
      P.array[i] += V[i] * 0.016; P.array[i + 1] += V[i + 1] * 0.016; P.array[i + 2] += V[i + 2] * 0.016;
      V[i] *= 0.965; V[i + 1] *= 0.965; V[i + 2] *= 0.965;
      // trọng trường kéo mảnh vỡ về tâm Trái Đất
      V[i] -= a.n.x * 0.04; V[i + 1] -= a.n.y * 0.04; V[i + 2] -= a.n.z * 0.04;
    }
    P.needsUpdate = true;
    a.debris.material.opacity = Math.max(0, 1 - t / 3);
    if (t > 3.2) { fx.clear(); anim = null; $('launch').disabled = false; return; }
  }
  requestAnimationFrame(step);
}

function explode(a) {
  const { r, p } = a;
  fx.remove(a.rock, a.trail);
  a.glow.visible = false;
  // chớp sáng toàn màn hình tại vị trí va chạm
  const sc = world.getScreenCoords(p.lat, p.lng, 0);
  const fl = $('flash');
  fl.style.setProperty('--fx', `${sc.x}px`); fl.style.setProperty('--fy', `${sc.y}px`);
  fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
  document.body.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-5px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(0,0)' }],
    { duration: 500 + Math.min(900, r.energyMt * 2), easing: 'ease-out' });

  const fbSize = R * THREE.MathUtils.clamp(Math.max(r.fireballRadius, 2000) / 6_371_000 * 2.2, 0.02, 0.5);
  const fireball = glowSprite('rgba(255,255,240,1)', 'rgba(255,120,30,0.85)');
  fireball.position.copy(a.end);
  const flashSprite = glowSprite('rgba(255,255,255,1)', 'rgba(255,220,160,0.5)');
  flashSprite.position.copy(a.end);
  const count = 600, dpos = new Float32Array(count * 3), vel = new Float32Array(count * 3), dcol = new Float32Array(count * 3);
  const up = a.n, tmp = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    a.end.toArray(dpos, i * 3);
    tmp.randomDirection();
    if (tmp.dot(up) < 0) tmp.reflect(up);                    // chỉ phun lên phía trên mặt đất
    tmp.multiplyScalar(R * (0.02 + Math.random() * 0.12) * THREE.MathUtils.clamp(Math.log10(r.energyMt + 1) / 3, 0.4, 2.2));
    tmp.toArray(vel, i * 3);
    c.setHSL(0.03 + Math.random() * 0.08, 1, 0.45 + Math.random() * 0.3).toArray(dcol, i * 3);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dg.setAttribute('color', new THREE.BufferAttribute(dcol, 3));
  const debris = new THREE.Points(dg, new THREE.PointsMaterial({ size: R * 0.004, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  fx.add(fireball, flashSprite, debris);
  Object.assign(a, { phase: 'boom', t0: performance.now(), fireball, flashSprite, fbSize, debris, debrisVel: vel });

  // Sóng xung kích (vòng lan rộng tới bán kính 1 psi thật) + sóng thần
  const deg = m => (m / 1000) / 111.195;
  const op1 = r.blast.find(b => b.psi === 1)?.radius ?? 0;
  const rings = [];
  if (op1 > 0) rings.push({ lat: p.lat, lng: p.lng, maxR: deg(op1), speed: deg(op1) / 2.4, repeat: 1e9, color: t => `rgba(255,170,90,${Math.sqrt(1 - t)})` });
  const ts = r.zones.find(z => z.id === 'tsunami');
  if (ts) rings.push({ lat: p.lat, lng: p.lng, maxR: deg(ts.radius), speed: deg(ts.radius) / 3.5, repeat: 700, color: t => `rgba(80,160,255,${0.9 * (1 - t) ** 1.5})` });
  world.ringsData(rings);
  setTimeout(() => world.ringsData([]), 4200);

  setTimeout(() => {
    state.landed = true;
    drawZones();
    renderResults();
    const pop = r.zones.find(z => z.id === 'op5')?.pop ?? 0;
    toast(r.isAirburst ? 'Nổ trên không!' : 'Va chạm!', `${fmt.energy(r.energyMt)}${pop ? ` · ~${fmt.people(pop)} dân đô thị trong vùng 5 psi` : ''}`, r.energyMt > 100 ? 'danger' : 'warn', 4500);
  }, 900);
}

$('launch').addEventListener('click', () => { if (!anim) launch(); });
$('reset').addEventListener('click', () => { clearImpact(); refreshHtml(); renderResults(); $('launch').disabled = false; });
$('share').addEventListener('click', async () => {
  const p = params();
  const u = new URL(location.href);
  u.search = new URLSearchParams({ d: p.diameter, rho: p.density, v: p.velocity, angle: p.angle, lat: p.lat, lng: p.lng, target: p.target }).toString();
  try { await navigator.clipboard.writeText(u.toString()); toast('Đã sao chép đường dẫn', 'Gửi cho bạn bè để họ xem cùng kịch bản.', 'ok'); }
  catch { prompt('Sao chép đường dẫn:', u.toString()); }
});
$('mParams').addEventListener('click', () => $('paramPanel').classList.toggle('m-hide'));

// ---------------------------------------------------------------------------
//  Sự kiện lịch sử
// ---------------------------------------------------------------------------
function applyParams(pp, { lat, lng } = {}) {
  const d = pp.diameter;
  if (d >= 1000) { els.diameter.value = +(d / 1000).toFixed(3); els.unit.value = 'km'; } else { els.diameter.value = d; els.unit.value = 'm'; }
  state.density = pp.density;
  els.comp.value = [...els.comp.options].some(o => +o.value === pp.density) ? String(pp.density) : 'custom';
  els.vel.value = pp.velocity; els.angle.value = pp.angle;
  if (pp.waterDepth) els.depth.value = pp.waterDepth;
  if (lat !== undefined) { els.lat.value = lat; els.lng.value = lng; }
  [els.vel, els.angle, els.depth].forEach(paintRange);
  if (pp.target) setTarget(pp.target); else detectSurface();
}

function runEvent(id) {
  const ev = HISTORIC_EVENTS.find(e => e.id === id);
  if (!ev || anim) return;
  applyParams(ev.params, ev);
  state.scenario = ev;
  $('scenarioName').innerHTML = `${ev.name} · <a href="${ev.wiki}" target="_blank" rel="noopener">Wikipedia ↗</a>`;
  document.querySelectorAll('#events .chip').forEach(c => c.classList.toggle('on', c.dataset.id === id));
  toast(ev.name, ev.text, 'info', 6000);
  clearImpact(); refreshHtml(); onParamChange();
  setTimeout(launch, 200);
}
$('events').innerHTML = HISTORIC_EVENTS.map(e => `<button class="chip" data-id="${e.id}" data-tip-title="${e.name}" data-tip="${e.text}">${e.name}</button>`).join('');
$('events').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) runEvent(b.dataset.id); });

// ---------------------------------------------------------------------------
//  Khởi động
// ---------------------------------------------------------------------------
(async () => {
  // Mặc định: Biển Đông, gần hai quần đảo của Việt Nam
  els.lat.value = 13.5; els.lng.value = 113.5;
  const q = new URLSearchParams(location.search);
  if (q.has('d')) {
    applyParams({ diameter: +q.get('d'), density: +q.get('rho') || 2750, velocity: THREE.MathUtils.clamp(+q.get('v') || 20, 11, 72), angle: +q.get('angle') || 45, target: q.get('target') || undefined },
      q.has('lat') ? { lat: +q.get('lat'), lng: +q.get('lng') } : {});
    if (q.get('name')) $('scenarioName').textContent = `Kịch bản: ${q.get('name')}`;
  }
  setTarget(q.get('target') || 'water', !q.get('target'));
  initRanges();
  syncLabels();
  refreshHtml();
  onParamChange();
  load.set(0.4, 'Tải mặt nạ lục địa & dân số…');
  await Promise.all([landReady, loadPopulation().catch(e => console.warn('population', e))]);
  if (!q.get('target')) detectSurface();
  onParamChange();
  load.done();
  if (innerWidth < 900) $('resultPanel').classList.add('m-hide');
  if (q.has('d')) world.pointOfView({ lat: +els.lat.value, lng: +els.lng.value, altitude: 1.8 }, 1000);
})();
