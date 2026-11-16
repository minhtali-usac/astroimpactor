// Kiểm thử các mô hình vật lý bằng trình chạy có sẵn của Node:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeImpact } from '../src/lib/impact.js';
import { solveKepler, planetPosition, classifyNEO, diameterFromH, meanMotionRadPerDay } from '../src/lib/orbit.js';
import { integrateFlyby, periapsis, captureRadius, bPlaneShiftKm, kineticDv, MU_EARTH, R_EARTH } from '../src/lib/deflection.js';
import { subsolarPoint, haversineKm, geodesicRing } from '../src/lib/geo.js';

const within = (x, lo, hi, msg) => assert.ok(x >= lo && x <= hi, `${msg}: ${x} ∉ [${lo}, ${hi}]`);

test('Kepler: nghiệm thoả M = E − e·sin E với mọi e < 1', () => {
  for (const e of [0, 0.1, 0.5, 0.9, 0.97, 0.995]) {
    for (let M = -3.1; M <= 3.1; M += 0.37) {
      const E = solveKepler(M, e);
      assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-10, `e=${e}, M=${M}`);
    }
  }
});

test('Lịch hành tinh: Trái Đất cách Mặt Trời 0,983–1,017 AU', () => {
  for (let mjd = 60000; mjd < 60365; mjd += 30) {
    const [x, y, z] = planetPosition('Earth', mjd);
    within(Math.hypot(x, y, z), 0.9832, 1.0168, `MJD ${mjd}`);
  }
});

test('Định luật Kepler III: n(1 AU) ≈ 360°/năm', () => {
  within((meanMotionRadPerDay(1) * 365.25 * 180) / Math.PI, 359.5, 360.5, 'n');
});

test('Phân loại NEO', () => {
  assert.equal(classifyNEO(0.74, 0.32), 0);   // Atira (Q < 0,983)
  assert.equal(classifyNEO(0.92, 0.19), 1);   // Aten (Apophis)
  assert.equal(classifyNEO(1.13, 0.20), 2);   // Apollo (Bennu)
  assert.equal(classifyNEO(1.46, 0.22), 3);   // Amor (Eros)
});

test('Đường kính từ H: H = 18, pV = 0,14 ⇒ ~ 0,9 km', () => {
  within(diameterFromH(18, 0.14), 850, 950, 'D');
});

test('Va chạm: Chelyabinsk nổ trên không ~30 km, ~0,5 Mt', () => {
  const r = computeImpact({ diameter: 20, density: 3300, velocity: 19, angle: 18 });
  assert.ok(r.isAirburst);
  within(r.airburstAlt / 1000, 20, 40, 'độ cao nổ (km)');
  within(r.energyMt, 0.3, 0.8, 'năng lượng (Mt)');
});

test('Va chạm: Hố Meteor ~1–1,6 km', () => {
  const r = computeImpact({ diameter: 50, density: 7800, velocity: 12.8, angle: 45, target: 'sedimentary' });
  assert.ok(!r.isAirburst);
  within(r.crater.diameter, 1000, 1600, 'đường kính hố (m)');
});

test('Va chạm: Chicxulub tạo hố phức tạp ~100–200 km', () => {
  const r = computeImpact({ diameter: 10000, density: 2750, velocity: 20, angle: 45 });
  assert.equal(r.crater.type, 'complex');
  within(r.crater.diameter / 1000, 100, 200, 'hố (km)');
  within(r.seismicMagnitude, 9, 11, 'độ lớn động đất');
});

test('Va chạm: bán kính vùng ảnh hưởng giảm dần theo ngưỡng', () => {
  const r = computeImpact({ diameter: 300, density: 2750, velocity: 20, angle: 45 });
  const [p20, p5, p1] = r.blast.map(b => b.radius);
  assert.ok(p20 < p5 && p5 < p1);
});

test('Bay sượt: tích phân RK4 khớp cận điểm giải tích', () => {
  const vInf = 15, D0 = 60 * R_EARTH, v0 = Math.sqrt(vInf ** 2 + (2 * MU_EARTH) / D0);
  for (const b of [8100, 12000, 30000]) {
    const r = integrateFlyby([(b * vInf) / v0, 0, -D0], [0, 0, v0], { rSurface: R_EARTH, rStop: D0 });
    assert.ok(Math.abs(r.rMin - periapsis(b, vInf)) / periapsis(b, vInf) < 2e-3, `b=${b}`);
  }
});

test('Hội tụ hấp dẫn: b⊕ > R⊕ và tăng khi v∞ giảm', () => {
  assert.ok(captureRadius(20) > R_EARTH);
  assert.ok(captureRadius(5) > captureRadius(20));
});

test('Làm lệch hướng: 1 cm/s trước 10 năm ⇒ ~9.500 km', () => {
  within(bPlaneShiftKm(0.01, 10 * 365.25 * 86400), 9000, 9600, 'Δζ (km)');
  // DART: tàu 580 kg, 6,1 km/s, β = 3,6 lên Dimorphos ~4,3×10⁹ kg ⇒ Δv ≈ 3 mm/s
  within(kineticDv({ mass: 580, speed: 6.1, beta: 3.6, asteroidMass: 4.3e9 }) * 1000, 2.5, 3.5, 'Δv DART (mm/s)');
});

test('Địa lý: Hà Nội – TP.HCM ~1.140 km; vòng trắc địa đúng bán kính', () => {
  within(haversineKm(21.0278, 105.8342, 10.8231, 106.6297), 1130, 1150, 'km');
  for (const [lng, lat] of geodesicRing(16, 108, 500, 24)) within(haversineKm(16, 108, lat, lng), 499, 501, 'bán kính');
});

test('Điểm cận nhật: vĩ độ = độ xích vĩ Mặt Trời (±23,44°)', () => {
  within(subsolarPoint(new Date('2026-06-21T12:00:00Z')).lat, 23.3, 23.5, 'hạ chí');
  within(subsolarPoint(new Date('2026-12-21T12:00:00Z')).lat, -23.5, -23.3, 'đông chí');
});
