// ============================================================================
//  Mô hình hậu quả va chạm thiên thạch
//  Theo: G. S. Collins, H. J. Melosh, R. A. Marcus (2005),
//        "Earth Impact Effects Program", Meteoritics & Planetary Science 40(6), 817–840.
//  Các số hiệu (Eq. n) tham chiếu bài báo trên. Đơn vị SI trừ khi ghi chú.
// ============================================================================

export const G_EARTH = 9.81;          // m/s²
export const R_EARTH = 6_371_000;     // m
export const SCALE_HEIGHT = 8_000;    // H — độ cao quy mô khí quyển (m)
export const RHO_AIR_0 = 1;           // mật độ khí quyển mặt đất dùng trong mô hình (kg/m³)
export const DRAG_COEFF = 2;          // C_D
export const PANCAKE_FACTOR = 7;      // f_p — hệ số "bánh kếp" khi vỡ vụn
export const MT_TNT = 4.184e15;       // J / megaton TNT
export const KT_TNT = 4.184e12;
export const SIMPLE_COMPLEX_D = 3_200; // m — đường kính chuyển hố đơn giản → phức tạp trên Trái Đất

export const TARGETS = {
  sedimentary: { label: 'Đá trầm tích', rho: 2500 },
  crystalline: { label: 'Đá kết tinh',  rho: 2750 },
  water:       { label: 'Đại dương',    rho: 1000 },
};

export const PSI = 6_894.76; // Pa

/** Ngưỡng áp suất dư của sóng xung kích (Pa) */
export const OVERPRESSURE_LEVELS = [
  { id: 'op20', psi: 20, label: 'Bê tông cốt thép bị phá huỷ', color: '#ff2d55' },
  { id: 'op5',  psi: 5,  label: 'Hầu hết nhà dân đổ sập',      color: '#ff7a1a' },
  { id: 'op1',  psi: 1,  label: 'Kính cửa sổ vỡ vụn',           color: '#ffd23f' },
];

/** Ngưỡng nhiệt lượng (J/m²) cho vụ nổ 1 Mt; tỉ lệ với E_Mt^(1/6) (Collins và cs. 2005, Bảng 3). */
export const THERMAL_LEVELS = [
  { id: 'th3', phi1Mt: 4.2e5, label: 'Bỏng độ 3',  color: '#ff3b6b' },
  { id: 'th2', phi1Mt: 2.5e5, label: 'Bỏng độ 2',  color: '#ff9f43' },
  { id: 'th1', phi1Mt: 1.3e5, label: 'Bỏng độ 1',  color: '#feca57' },
];
const LUMINOUS_EFFICIENCY = 3e-3; // η — tỉ lệ năng lượng phát xạ nhiệt

const rhoAir = z => RHO_AIR_0 * Math.exp(-z / SCALE_HEIGHT);

/** Tích phân Simpson cho hàm f trên [a, b]. */
function simpson(f, a, b, n = 200) {
  if (b <= a) return 0;
  if (n % 2) n++;
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let k = 1; k < n; k++) s += f(a + k * h) * (k % 2 ? 4 : 2);
  return (s * h) / 3;
}

/** Tìm r sao cho fn(r) = target với fn giảm đơn điệu (chia đôi trên thang log). */
function invertDecreasing(fn, target, rMin, rMax) {
  if (fn(rMin) < target) return 0;
  if (fn(rMax) > target) return rMax;
  let lo = Math.log(rMin), hi = Math.log(rMax);
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (fn(Math.exp(mid)) > target) lo = mid; else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

/**
 * Tính toàn bộ hậu quả va chạm.
 * @param {object} p
 * @param {number} p.diameter  đường kính thiên thạch L₀ (m)
 * @param {number} p.density   khối lượng riêng ρᵢ (kg/m³)
 * @param {number} p.velocity  vận tốc khi vào khí quyển v₀ (km/s)
 * @param {number} p.angle     góc va chạm so với mặt phẳng ngang θ (độ)
 * @param {'sedimentary'|'crystalline'|'water'} p.target
 * @param {number} [p.waterDepth=3700] độ sâu nước (m) nếu target = water
 */
export function computeImpact({ diameter, density, velocity, angle, target = 'sedimentary', waterDepth = 3700 }) {
  const L0 = Math.max(0.1, diameter);
  const rhoI = Math.max(100, density);
  const v0 = Math.max(1, velocity) * 1000;
  const theta = Math.min(90, Math.max(1, angle)) * Math.PI / 180;
  const sinT = Math.sin(theta);

  // --- Năng lượng & khối lượng (Eq. 1) -------------------------------------
  const mass = (Math.PI / 6) * rhoI * L0 ** 3;
  const energy0 = 0.5 * mass * v0 * v0;
  const energyMt0 = energy0 / MT_TNT;
  const recurrenceYears = 109 * Math.pow(energyMt0, 0.78); // Eq. 3

  // --- Xuyên qua khí quyển --------------------------------------------------
  const strength = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rhoI));                      // Eq. 10: Yᵢ
  const If = (4.07 * DRAG_COEFF * SCALE_HEIGHT * strength) / (rhoI * L0 * v0 * v0 * sinT); // Eq. 11

  let breakupAlt = null, airburstAlt = null, vImpact, intact = false;
  const vIntact = v0 * Math.exp((-3 * RHO_AIR_0 * DRAG_COEFF * SCALE_HEIGHT) / (4 * rhoI * L0 * sinT)); // Eq. 8 (z = 0)

  if (If >= 1) {
    intact = true;               // đủ bền, xuống tới mặt đất nguyên vẹn
    vImpact = vIntact;
  } else {
    const zStar = -SCALE_HEIGHT * (Math.log(strength / (RHO_AIR_0 * v0 * v0)) + 1.308 - 0.314 * If - 1.303 * Math.sqrt(1 - If)); // Eq. 12
    if (zStar <= 0) {
      intact = true;
      vImpact = vIntact;
    } else {
      breakupAlt = zStar;
      const rhoStar = rhoAir(zStar);
      const vStar = v0 * Math.exp((-3 * rhoStar * DRAG_COEFF * SCALE_HEIGHT) / (4 * rhoI * L0 * sinT)); // Eq. 8
      const l = L0 * sinT * Math.sqrt(rhoI / (DRAG_COEFF * rhoStar));                               // Eq. 13: độ dài phân tán
      const zb = zStar - 2 * SCALE_HEIGHT * Math.log(1 + (l / (2 * SCALE_HEIGHT)) * Math.sqrt(PANCAKE_FACTOR ** 2 - 1)); // Eq. 18
      if (zb > 0) {
        airburstAlt = zb;
        vImpact = null;
      } else {
        // Đường kính mảnh vỡ mở rộng L(z) (Eq. 16) và vận tốc chạm đất (Eq. 17)
        const Lz = z => L0 * Math.sqrt(1 + ((2 * SCALE_HEIGHT) / l) ** 2 * (Math.exp((zStar - z) / (2 * SCALE_HEIGHT)) - 1) ** 2);
        const integral = simpson(z => Math.exp((zStar - z) / SCALE_HEIGHT) * Lz(z) ** 2, 0, zStar, 400);
        vImpact = vStar * Math.exp((-0.75 * DRAG_COEFF * rhoStar * integral) / (rhoI * L0 ** 3 * sinT));
      }
    }
  }

  const isAirburst = airburstAlt !== null;
  // Năng lượng giải phóng: vụ nổ trên không giải phóng gần như toàn bộ động năng ở độ cao z_b
  const energy = isAirburst ? energy0 : 0.5 * mass * vImpact * vImpact;
  const energyMt = energy / MT_TNT;
  const energyKt = energy / KT_TNT;
  const burstHeight = isAirburst ? airburstAlt : 0;

  // --- Hố va chạm (Eq. 21–27) ---------------------------------------------
  let crater = null, water = null;
  const g = G_EARTH;
  if (!isAirburst) {
    let vRock = vImpact, rhoT = TARGETS[target]?.rho ?? 2500;
    if (target === 'water') {
      const rhoW = 1000;
      const Dtcw = 1.365 * Math.cbrt(rhoI / rhoW) * L0 ** 0.78 * vImpact ** 0.44 * g ** -0.22 * Math.cbrt(sinT); // khoang nước tạm thời
      vRock = vImpact * Math.exp((-3 * rhoW * DRAG_COEFF * waterDepth) / (2 * rhoI * L0 * sinT));             // vận tốc chạm đáy biển
      const rimWave = Math.min(Dtcw / 14.1, waterDepth);  // biên độ sóng tại mép khoang (xấp xỉ)
      water = {
        depth: waterDepth,
        cavityDiameter: Dtcw,
        seafloorVelocity: vRock,
        rimWaveAmplitude: rimWave,
        /** biên độ sóng thần (m) tại khoảng cách r (m), suy giảm ~1/r */
        waveAt: r => (r <= Dtcw / 2 ? rimWave : rimWave * (Dtcw / 2) / r),
      };
      rhoT = 2700;
    }
    const Dtc = 1.161 * Math.cbrt(rhoI / rhoT) * L0 ** 0.78 * vRock ** 0.44 * g ** -0.22 * Math.cbrt(sinT); // Eq. 21
    let Dfr, depth, type;
    if (Dtc * 1.25 < SIMPLE_COMPLEX_D) {
      type = 'simple';
      Dfr = 1.25 * Dtc;                                         // Eq. 22
      const dtc = Dtc / (2 * Math.SQRT2);
      const hfr = (0.07 * Dtc ** 4) / Dfr ** 3;                 // Eq. 24
      const Vbr = 0.032 * Dfr ** 3;                             // Eq. 23
      const tbr = (2.8 * Vbr * (dtc + hfr)) / (dtc * Dfr ** 2); // Eq. 25
      depth = Math.max(dtc * 0.2, dtc + hfr - tbr);
    } else {
      type = 'complex';
      Dfr = (1.17 * Dtc ** 1.13) / SIMPLE_COMPLEX_D ** 0.13;    // Eq. 27
      depth = 0.294 * (Dfr / 1000) ** 0.301 * 1000;             // Eq. 28
    }
    // Khi rơi xuống biển sâu, nước có thể hãm gần hết vận tốc ⇒ không tạo hố đáy biển đáng kể
    crater = Dfr >= 10 ? { transientDiameter: Dtc, diameter: Dfr, depth, type, seafloor: target === 'water' } : null;
  }

  // --- Quả cầu lửa & bức xạ nhiệt (Eq. 32–37) -----------------------------
  const fireballRadius = 0.002 * Math.cbrt(energy);     // Eq. 32 (m)
  const hasFireball = isAirburst || (vImpact ?? 0) > 15_000;
  const thermalAt = r => {
    const slant = Math.hypot(r, burstHeight);
    // phần quả cầu lửa còn nhìn thấy trên đường chân trời (Eq. 36–37)
    const delta = r / R_EARTH;
    const hidden = (1 - Math.cos(delta)) * R_EARTH - burstHeight;
    let f = 1;
    if (hidden > 0) {
      if (hidden >= fireballRadius) return 0;
      const dd = Math.acos(hidden / fireballRadius);
      f = (2 / Math.PI) * (dd - (hidden / fireballRadius) * Math.sin(dd));
    }
    return (f * LUMINOUS_EFFICIENCY * energy) / (2 * Math.PI * slant * slant);
  };
  const thermal = hasFireball
    ? THERMAL_LEVELS.map(lv => ({
        ...lv,
        threshold: lv.phi1Mt * Math.pow(Math.max(energyMt, 1e-6), 1 / 6),
        radius: invertDecreasing(thermalAt, lv.phi1Mt * Math.pow(Math.max(energyMt, 1e-6), 1 / 6), 1, 4_000_000),
      }))
    : [];

  // --- Sóng xung kích không khí (Eq. 54; nổ trên không xấp xỉ bằng khoảng cách nghiêng) ---
  const Px = 75_000, Rx = 290;
  const overpressureAt = r => {
    const d = Math.hypot(r, burstHeight);
    const r1 = d / Math.cbrt(Math.max(energyKt, 1e-9));
    const p = ((Px * Rx) / (4 * r1)) * (1 + 3 * Math.pow(Rx / r1, 1.3));
    // Nổ trên không: sóng phản xạ từ mặt đất cộng hưởng ≈ gấp đôi áp suất tới (xấp xỉ)
    return burstHeight > 0 ? 2 * p : p;
  };
  const windFromPressure = p => {
    const P0 = 1e5, c0 = 330;
    return ((5 * p) / (7 * P0)) * c0 / Math.sqrt(1 + (6 * p) / (7 * P0)); // Eq. 58
  };
  const blast = OVERPRESSURE_LEVELS.map(lv => {
    const pa = lv.psi * PSI;
    return { ...lv, pressure: pa, radius: invertDecreasing(overpressureAt, pa, 1, 5_000_000), wind: windFromPressure(pa) };
  });

  // --- Động đất (Eq. 40) ---------------------------------------------------
  const seismicMagnitude = isAirburst ? null : 0.67 * Math.log10(energy) - 5.87;

  return {
    input: { diameter: L0, density: rhoI, velocity: v0 / 1000, angle: theta * 180 / Math.PI, target, waterDepth },
    mass, energy0, energy, energyMt, energyMt0, recurrenceYears,
    strength, breakupAlt, airburstAlt, isAirburst, intact,
    impactVelocity: vImpact,
    crater, water,
    fireballRadius: hasFireball ? fireballRadius : 0,
    thermal, blast, seismicMagnitude,
    overpressureAt, thermalAt,
    /** bán kính lớn nhất bị ảnh hưởng (m) — dùng để chọn mức phóng camera */
    maxRadius: Math.max(...blast.map(b => b.radius), ...thermal.map(t => t.radius), crater?.diameter ?? 0),
  };
}

/** So sánh năng lượng với các sự kiện quen thuộc để dễ hình dung. */
export const ENERGY_REFERENCES = [
  { mt: 0.015, label: 'bom Hiroshima (15 kt)' },
  { mt: 0.5, label: 'thiên thạch Chelyabinsk 2013' },
  { mt: 10, label: 'sự kiện Tunguska 1908' },
  { mt: 50, label: 'bom Sa Hoàng (Tsar Bomba)' },
  { mt: 1e8, label: 'va chạm Chicxulub (tuyệt chủng khủng long)' },
];

export function energyComparison(mt) {
  // mốc lớn nhất không vượt quá năng lượng (để luôn nói "gấp N lần …")
  const below = ENERGY_REFERENCES.filter(r => r.mt <= mt * 1.5);
  const best = below.length ? below.at(-1) : ENERGY_REFERENCES[0];
  return { ...best, ratio: mt / best.mt };
}
