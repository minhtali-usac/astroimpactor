// ============================================================================
//  Hình học trên mặt cầu Trái Đất
// ============================================================================
export const R_EARTH_KM = 6371.0088;
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

export const normLng = lng => ((((lng + 180) % 360) + 360) % 360) - 180;

/** Khoảng cách vòng lớn (km) — công thức haversine. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R;
  const dp = p2 - p1, dl = (lng2 - lng1) * D2R;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Điểm đích khi đi từ (lat, lng) theo phương vị `bearing` (rad) một cung `delta` (rad). */
export function destination(lat, lng, bearing, delta) {
  const p1 = lat * D2R, l1 = lng * D2R;
  const sp = Math.sin(p1) * Math.cos(delta) + Math.cos(p1) * Math.sin(delta) * Math.cos(bearing);
  const p2 = Math.asin(sp);
  const l2 = l1 + Math.atan2(Math.sin(bearing) * Math.sin(delta) * Math.cos(p1), Math.cos(delta) - Math.sin(p1) * sp);
  return [normLng(l2 * R2D), p2 * R2D]; // GeoJSON: [lng, lat]
}

/**
 * Vòng tròn trắc địa bán kính `radiusKm` quanh tâm, dạng vòng GeoJSON [lng, lat].
 * `jitter(θ)` (tuỳ chọn) trả về hệ số nhân bán kính để tạo mép hố không đều.
 */
export function geodesicRing(lat, lng, radiusKm, steps = 96, jitter = null) {
  const ring = [];
  for (let k = 0; k <= steps; k++) {
    const th = (k % steps) / steps * Math.PI * 2;
    const r = radiusKm * (jitter ? jitter(th) : 1);
    ring.push(destination(lat, lng, th, r / R_EARTH_KM));
  }
  // Phương vị tăng dần ⇒ vòng đi theo chiều kim đồng hồ — đúng quy ước "vòng ngoài" của
  // d3-geo/three-globe trên mặt cầu (ngược chiều sẽ bị hiểu là phần bù, phủ kín cả địa cầu).
  return ring;
}

/** Đa giác hình vành khuyên (annulus) giữa hai bán kính, dạng GeoJSON Polygon coordinates. */
export function annulus(lat, lng, rInnerKm, rOuterKm, steps = 96) {
  const outer = geodesicRing(lat, lng, rOuterKm, steps);
  if (rInnerKm <= 0) return [outer];
  return [outer, geodesicRing(lat, lng, rInnerKm, steps).reverse()];
}

// --- Điểm trong đa giác (phẳng trên lng/lat; đủ dùng cho mặt nạ lục địa 1:110m) ---
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}
export function pointInMultiPolygon(lng, lat, multi) {
  for (const poly of multi) {
    if (!inRing(lng, lat, poly[0])) continue;
    let hole = false;
    for (let h = 1; h < poly.length; h++) if (inRing(lng, lat, poly[h])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

/**
 * Toạ độ điểm cận nhật (Mặt Trời ở thiên đỉnh) tại thời điểm `date`.
 * Công thức gần đúng của Almanac Thiên văn (sai số < 0,01°).
 * @returns {{lat:number, lng:number}}
 */
export function subsolarPoint(date = new Date()) {
  const n = date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545.0; // ngày kể từ J2000
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * D2R;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmstDeg = (280.46061837 + 360.98564736629 * n) % 360;
  return { lat: dec * R2D, lng: normLng(ra * R2D - gmstDeg) };
}

// --- Địa danh hành chính đặc biệt ------------------------------------------
/** Hai quần đảo thuộc chủ quyền Việt Nam (Đà Nẵng và Khánh Hoà). */
export const VIETNAM_ARCHIPELAGOS = [
  { id: 'hoangsa', name: 'Quần đảo Hoàng Sa', sub: 'Việt Nam · TP. Đà Nẵng', lat: 16.5, lng: 112.0 },
  { id: 'truongsa', name: 'Quần đảo Trường Sa', sub: 'Việt Nam · tỉnh Khánh Hoà', lat: 10.0, lng: 114.3 },
];

/** Các đảo tiêu biểu (dùng để vẽ chấm nhỏ trên địa cầu). */
export const VIETNAM_ISLANDS = [
  // Hoàng Sa
  { name: 'Đảo Phú Lâm', lat: 16.834, lng: 112.338 },
  { name: 'Đảo Hoàng Sa', lat: 16.533, lng: 111.611 },
  { name: 'Đảo Tri Tôn', lat: 15.783, lng: 111.200 },
  { name: 'Đảo Linh Côn', lat: 16.670, lng: 112.733 },
  { name: 'Đảo Quang Hoà', lat: 16.450, lng: 111.700 },
  { name: 'Đảo Duy Mộng', lat: 16.450, lng: 111.533 },
  // Trường Sa
  { name: 'Đảo Trường Sa', lat: 8.644, lng: 111.920 },
  { name: 'Đảo Song Tử Tây', lat: 11.430, lng: 114.330 },
  { name: 'Đảo Sơn Ca', lat: 10.376, lng: 114.479 },
  { name: 'Đảo Nam Yết', lat: 10.183, lng: 114.360 },
  { name: 'Đảo Sinh Tồn', lat: 9.883, lng: 114.330 },
  { name: 'Đảo An Bang', lat: 7.890, lng: 112.910 },
  { name: 'Đảo Ba Bình', lat: 10.377, lng: 114.365 },
  { name: 'Đảo Thị Tứ', lat: 11.055, lng: 114.284 },
];
