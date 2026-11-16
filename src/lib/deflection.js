// ============================================================================
//  Vật lý làm lệch hướng tiểu hành tinh (phòng thủ hành tinh)
// ----------------------------------------------------------------------------
//  • Va chạm động năng (kiểu DART):  Δv = β · m · u / M
//      β ≈ 3,6 đo được ở thí nghiệm DART–Dimorphos (Cheng và cs., Nature 2023)
//  • Bóc tách bằng laser:  F = Cₘ · P,  Δv = F · t / M  (Cₘ ~ 10⁻⁵–10⁻⁴ N/W)
//  • Độ dịch chuyển trên mặt phẳng B sau thời gian cảnh báo t:
//      Δζ ≈ 3 · Δv · t   (đẩy theo phương tiếp tuyến, t ≫ 1 tháng — Ahrens & Harris 1992)
//    và Δζ ≈ Δv · t khi t ngắn. Ở đây dùng hệ số chuyển tiếp k(t) = 3 − 2·e^(−t/τ), τ = 0,25 năm.
//  • Hội tụ hấp dẫn: bán kính bắt giữ  b⊕ = R · √(1 + v_esc² / v∞²)
// ============================================================================
export const MU_EARTH = 398_600.4418;   // km³/s²
export const R_EARTH = 6_371;           // km
export const ATMOSPHERE_KM = 100;       // độ cao coi như "chạm khí quyển"
export const GEO_ALT_KM = 35_786;
export const DAY = 86_400;
const YEAR = 365.25 * DAY;

export const asteroidMass = (diameterM, density) => (Math.PI / 6) * density * diameterM ** 3; // kg

/** Δv (m/s) do một tàu va chạm khối lượng m (kg), vận tốc tương đối u (km/s). */
export const kineticDv = ({ mass, speed, beta, asteroidMass: M }) => (beta * mass * speed * 1000) / M;

/** Gia tốc (m/s²) do laser công suất P (W) với hệ số ghép xung lượng Cm (N/W). */
export const laserAccel = ({ power, coupling, asteroidMass: M }) => (coupling * power) / M;

/** Hệ số khuếch đại dịch chuyển theo thời gian cảnh báo (1 → 3). */
export const leverage = tSec => 3 - 2 * Math.exp(-tSec / (0.25 * YEAR));

/** Dịch chuyển trên mặt phẳng B (km) khi tác dụng Δv (m/s) lúc còn tSec giây trước va chạm. */
export const bPlaneShiftKm = (dv, tSec) => (dv * tSec * leverage(tSec)) / 1000;

/** Vận tốc thoát tại bán kính r (km/s). */
export const escapeVelocity = (r = R_EARTH) => Math.sqrt((2 * MU_EARTH) / r);

/** Bán kính bắt giữ (km) với v∞ (km/s) — vật thể có |b| nhỏ hơn sẽ chạm bán kính r. */
export const captureRadius = (vInf, r = R_EARTH) => r * Math.sqrt(1 + escapeVelocity(r) ** 2 / (vInf * vInf));

/** Khoảng cách cận điểm (km, tính từ tâm Trái Đất) của quỹ đạo hyperbol với tham số va chạm b. */
export function periapsis(bKm, vInf) {
  const v2 = vInf * vInf;
  const e = Math.sqrt(1 + ((bKm * v2) / MU_EARTH) ** 2);
  return (MU_EARTH / v2) * (e - 1);
}

/**
 * Tích phân số quỹ đạo dưới lực hấp dẫn Trái Đất (RK4, bước thích nghi).
 * Đầu vào bằng km và km/s. Trả về mảng mẫu {t, x, y, z} và thông tin tiếp cận.
 *  - start: vị trí ban đầu, vel: vận tốc ban đầu
 *  - dừng khi chạm bề mặt, hoặc đã qua cận điểm và đi xa hơn rStop
 */
export function integrateFlyby(start, vel, { rSurface = R_EARTH, rStop = 400_000, maxSteps = 6000 } = {}) {
  let [x, y, z] = start, [vx, vy, vz] = vel, t = 0;
  const out = [{ t, x, y, z }];
  let rMin = Infinity, tMin = 0, hit = false, passed = false;
  const acc = (px, py, pz) => {
    const r2 = px * px + py * py + pz * pz, r = Math.sqrt(r2), k = -MU_EARTH / (r2 * r);
    return [k * px, k * py, k * pz];
  };
  for (let s = 0; s < maxSteps; s++) {
    const r = Math.hypot(x, y, z), v = Math.hypot(vx, vy, vz);
    const h = Math.min(120, Math.max(1, (0.004 * r) / v)); // giây — bước nhỏ khi ở gần
    const a1 = acc(x, y, z);
    const x2 = x + vx * h / 2, y2 = y + vy * h / 2, z2 = z + vz * h / 2;
    const v2x = vx + a1[0] * h / 2, v2y = vy + a1[1] * h / 2, v2z = vz + a1[2] * h / 2;
    const a2 = acc(x2, y2, z2);
    const x3 = x + v2x * h / 2, y3 = y + v2y * h / 2, z3 = z + v2z * h / 2;
    const v3x = vx + a2[0] * h / 2, v3y = vy + a2[1] * h / 2, v3z = vz + a2[2] * h / 2;
    const a3 = acc(x3, y3, z3);
    const x4 = x + v3x * h, y4 = y + v3y * h, z4 = z + v3z * h;
    const v4x = vx + a3[0] * h, v4y = vy + a3[1] * h, v4z = vz + a3[2] * h;
    const a4 = acc(x4, y4, z4);
    x += (h / 6) * (vx + 2 * v2x + 2 * v3x + v4x);
    y += (h / 6) * (vy + 2 * v2y + 2 * v3y + v4y);
    z += (h / 6) * (vz + 2 * v2z + 2 * v3z + v4z);
    vx += (h / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
    vy += (h / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
    vz += (h / 6) * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2]);
    t += h;
    const rn = Math.hypot(x, y, z);
    if (rn < rMin) { rMin = rn; tMin = t; } else passed = true;
    if (rn <= rSurface) {
      // nội suy điểm chạm bề mặt
      const prev = out[out.length - 1];
      const rp = Math.hypot(prev.x, prev.y, prev.z), f = (rp - rSurface) / Math.max(1e-9, rp - rn);
      out.push({ t: prev.t + (t - prev.t) * f, x: prev.x + (x - prev.x) * f, y: prev.y + (y - prev.y) * f, z: prev.z + (z - prev.z) * f });
      hit = true; rMin = rSurface; tMin = out[out.length - 1].t;
      break;
    }
    out.push({ t, x, y, z });
    if (passed && rn > rStop) break;
  }
  return { samples: out, hit, rMin, tArrival: tMin };
}

/** Nội suy vị trí trên quỹ đạo đã tích phân tại thời điểm t (giây). */
export function sampleAt(samples, t, out = [0, 0, 0]) {
  if (t <= samples[0].t) { const s = samples[0]; out[0] = s.x; out[1] = s.y; out[2] = s.z; return out; }
  let lo = 0, hi = samples.length - 1;
  if (t >= samples[hi].t) { const s = samples[hi]; out[0] = s.x; out[1] = s.y; out[2] = s.z; return out; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (samples[m].t <= t) lo = m; else hi = m; }
  const a = samples[lo], b = samples[hi], f = (t - a.t) / (b.t - a.t);
  out[0] = a.x + (b.x - a.x) * f; out[1] = a.y + (b.y - a.y) * f; out[2] = a.z + (b.z - a.z) * f;
  return out;
}
