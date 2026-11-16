// ============================================================================
//  Cơ học quỹ đạo hai vật (Kepler) — dùng chung cho toàn bộ ứng dụng
// ----------------------------------------------------------------------------
//  Hệ toạ độ: hoàng đạo J2000 (x hướng điểm xuân phân, z hướng cực Bắc hoàng đạo).
//  Ánh xạ sang three.js (Y hướng lên):  X = x,  Y = z,  Z = −y   (phép quay thuần,
//  không bị lật gương như mã cũ).
// ============================================================================

export const AU_KM = 149_597_870.7;           // km
export const GM_SUN = 1.32712440018e11;       // km³/s²
export const DAY_S = 86_400;
export const DEG = Math.PI / 180;
export const TWO_PI = Math.PI * 2;
export const J2000_MJD = 51_544.5;            // 2000-01-01 12:00 TT

// --- Thời gian --------------------------------------------------------------
export const mjdToDate = mjd => new Date((mjd - 40_587) * 86_400_000);
export const dateToMJD = date => date.getTime() / 86_400_000 + 40_587;

/** Chuyển động trung bình n [rad/ngày] từ bán trục lớn a [AU] (định luật Kepler III). */
export function meanMotionRadPerDay(aAU) {
  const a = aAU * AU_KM;
  return Math.sqrt(GM_SUN / (a * a * a)) * DAY_S;
}

/** Chu kỳ quỹ đạo [năm]. */
export const periodYears = aAU => Math.pow(aAU, 1.5);

/** Đưa góc về khoảng [−π, π). */
export function wrapPi(x) {
  x = (x + Math.PI) % TWO_PI;
  if (x < 0) x += TWO_PI;
  return x - Math.PI;
}

/**
 * Giải phương trình Kepler  M = E − e·sin E  bằng Newton–Raphson.
 * Điểm khởi đầu E₀ = M + e·sin M (hoặc π khi e lớn) hội tụ cho mọi 0 ≤ e < 1.
 * @param {number} M  dị thường trung bình [rad]
 * @param {number} e  độ lệch tâm
 * @param {number} [E0] giá trị khởi đầu (vd. E ở khung hình trước → 1–2 vòng lặp)
 */
export function solveKepler(M, e, E0) {
  M = wrapPi(M);
  let E = E0 ?? (e < 0.8 ? M + e * Math.sin(M) : (M >= 0 ? Math.PI : -Math.PI));
  for (let k = 0; k < 30; k++) {
    const f = E - e * Math.sin(E) - M;
    const d = f / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Dị thường thực ν từ dị thường lệch tâm E. */
export const trueAnomaly = (E, e) =>
  2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

/**
 * Hai vector cơ sở của mặt phẳng quỹ đạo (P hướng cận điểm, Q vuông góc theo chiều chuyển động),
 * đã đổi sang trục three.js. Khi có P, Q:  r = a(cos E − e)·P + a√(1−e²)·sin E·Q.
 * Tính một lần cho mỗi thiên thể ⇒ mỗi khung hình chỉ cần sin/cos của E.
 * @returns {Float64Array} [Px,Py,Pz,Qx,Qy,Qz] (toạ độ three.js)
 */
export function perifocalBasis(iDeg, nodeDeg, periDeg, out = new Float64Array(6)) {
  const i = iDeg * DEG, O = nodeDeg * DEG, w = periDeg * DEG;
  const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const cw = Math.cos(w), sw = Math.sin(w);
  // hoàng đạo (x, y, z)
  const Px = cw * cO - sw * sO * ci, Py = cw * sO + sw * cO * ci, Pz = sw * si;
  const Qx = -sw * cO - cw * sO * ci, Qy = -sw * sO + cw * cO * ci, Qz = cw * si;
  // → three.js (X = x, Y = z, Z = −y)
  out[0] = Px; out[1] = Pz; out[2] = -Py;
  out[3] = Qx; out[4] = Qz; out[5] = -Qy;
  return out;
}

/** Vị trí (đơn vị AU, trục three.js) của một quỹ đạo tại dị thường lệch tâm E. */
export function positionFromE(a, e, basis, E, out = [0, 0, 0]) {
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  out[0] = xp * basis[0] + yp * basis[3];
  out[1] = xp * basis[1] + yp * basis[4];
  out[2] = xp * basis[2] + yp * basis[5];
  return out;
}

/** Sinh các điểm của elip quỹ đạo (lấy mẫu đều theo E → dày hơn ở cận điểm). */
export function orbitPoints(a, e, basis, segments = 128, scale = 1) {
  const pts = new Float32Array(segments * 3);
  const p = [0, 0, 0];
  for (let k = 0; k < segments; k++) {
    positionFromE(a, e, basis, (k / segments) * TWO_PI, p);
    pts[k * 3] = p[0] * scale; pts[k * 3 + 1] = p[1] * scale; pts[k * 3 + 2] = p[2] * scale;
  }
  return pts;
}

// ============================================================================
//  Lịch thiên văn gần đúng cho các hành tinh
//  Nguồn: E. M. Standish (JPL), "Keplerian Elements for Approximate Positions of the
//  Major Planets", bảng 1 (hợp lệ 1800–2050 SCN).  Mỗi phần tử: [giá trị J2000, tốc độ/thế kỷ]
//  a [AU], e, I [°], L kinh độ trung bình [°], ϖ kinh độ cận điểm [°], Ω kinh độ nút lên [°]
// ============================================================================
export const PLANET_ELEMENTS = {
  Mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175], w: [77.45779628, 0.16047689], O: [48.33076593, -0.12534081] },
  Venus:   { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729], w: [131.60246718, 0.00268329], O: [76.67984255, -0.27769418] },
  Earth:   { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] },
  Mars:    { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], O: [49.55953891, -0.29257343] },
  Jupiter: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], w: [14.72847983, 0.21252668], O: [100.47390909, 0.20469106] },
  Saturn:  { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], w: [92.59887831, -0.41897216], O: [113.66242448, -0.28867794] },
  Uranus:  { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], w: [170.95427630, 0.40805281], O: [74.01692503, 0.04240589] },
  Neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], w: [44.96476227, -0.32241464], O: [131.78422574, -0.00508664] },
  Pluto:   { a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170], I: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], w: [224.06891629, -0.04062942], O: [110.30393684, -0.01183482] },
};

/** Các yếu tố quỹ đạo của hành tinh tại thời điểm MJD (dạng a, e, i, Ω, ω, M — độ). */
export function planetElementsAt(name, mjd) {
  const el = PLANET_ELEMENTS[name];
  const T = (mjd - J2000_MJD) / 36_525; // thế kỷ Julius kể từ J2000
  const v = k => el[k][0] + el[k][1] * T;
  const a = v('a'), e = v('e'), i = v('I'), L = v('L'), varpi = v('w'), node = v('O');
  return { a, e, i, node, peri: varpi - node, M: L - varpi };
}

/** Vị trí nhật tâm (AU, trục three.js) của hành tinh tại MJD. */
export function planetPosition(name, mjd, out = [0, 0, 0]) {
  const el = planetElementsAt(name, mjd);
  const basis = perifocalBasis(el.i, el.node, el.peri);
  const E = solveKepler(el.M * DEG, el.e);
  return positionFromE(el.a, el.e, basis, E, out);
}

// ============================================================================
//  Phân loại tiểu hành tinh gần Trái Đất theo quỹ đạo
//  q = a(1−e) cận điểm, Q = a(1+e) viễn điểm (AU)
// ============================================================================
export const NEO_CLASSES = [
  { id: 'atira', name: 'Atira', color: '#c792ff', rule: 'a < 1 AU, Q < 0,983 AU — nằm hoàn toàn bên trong quỹ đạo Trái Đất' },
  { id: 'aten',  name: 'Aten',  color: '#ff8a5c', rule: 'a < 1 AU, Q > 0,983 AU — cắt quỹ đạo Trái Đất từ bên trong' },
  { id: 'apollo',name: 'Apollo',color: '#ffd15c', rule: 'a > 1 AU, q < 1,017 AU — cắt quỹ đạo Trái Đất từ bên ngoài' },
  { id: 'amor',  name: 'Amor',  color: '#5cc8ff', rule: 'a > 1 AU, 1,017 < q < 1,3 AU — tiếp cận nhưng không cắt quỹ đạo Trái Đất' },
  { id: 'other', name: 'Khác',  color: '#8a94a8', rule: 'q ≥ 1,3 AU (theo dữ liệu tại thời điểm epoch)' },
];

export function classifyNEO(a, e) {
  const q = a * (1 - e), Q = a * (1 + e);
  if (a < 1) return Q < 0.983 ? 0 : 1;
  if (q < 1.017) return 2;
  if (q < 1.3) return 3;
  return 4;
}

// ============================================================================
//  Kích thước từ cấp sao tuyệt đối:  D[km] = 1329 / √pV · 10^(−H/5)
// ============================================================================
export function albedoFromSlope(G) {
  if (!Number.isFinite(G)) return 0.14;
  if (G <= 0.10) return 0.06;  // tối (loại C)
  if (G >= 0.30) return 0.25;  // sáng (loại S/E)
  return 0.14;
}
export function diameterFromH(H, pV = 0.14) {
  if (!Number.isFinite(H) || !(pV > 0)) return NaN;
  return 1329_000 * Math.pow(10, -0.2 * H) / Math.sqrt(pV); // mét
}
