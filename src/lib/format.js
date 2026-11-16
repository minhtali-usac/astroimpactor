// Định dạng số liệu theo kiểu Việt Nam (dấu phẩy thập phân, dấu chấm phân nghìn)
const nf = (digits = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const cache = new Map();
export function num(x, digits = 0) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  if (!cache.has(digits)) cache.set(digits, nf(digits));
  return cache.get(digits).format(x);
}

/** Số có 3 chữ số có nghĩa, kèm luỹ thừa 10 khi quá lớn/nhỏ. */
export function sig(x, s = 3) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) {
    const exp = Math.floor(Math.log10(ax));
    return `${num(x / 10 ** exp, s - 1)}×10${superscript(exp)}`;
  }
  const digits = Math.max(0, s - 1 - Math.floor(Math.log10(ax)));
  return num(x, digits);
}
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const superscript = n => String(n).split('').map(c => SUP[c] ?? c).join('');

/** Khoảng cách từ mét. */
export function dist(m) {
  if (!Number.isFinite(m)) return '—';
  if (m <= 0) return 'không đáng kể';
  if (m < 1000) return `${sig(m)} m`;
  if (m < 1e9) return `${sig(m / 1000)} km`;
  return `${sig(m / 1.495978707e11)} AU`;
}

/** Năng lượng từ megaton TNT. */
export function energy(mt) {
  if (!Number.isFinite(mt)) return '—';
  if (mt < 1e-3) return `${sig(mt * 1e6)} tấn TNT`;
  if (mt < 1) return `${sig(mt * 1e3)} kiloton TNT`;
  if (mt < 1e3) return `${sig(mt)} megaton TNT`;
  if (mt >= 1e7) return `${sig(mt)} megaton TNT`;
  return `${sig(mt / 1e3)} gigaton TNT`;
}

export function years(y) {
  if (!Number.isFinite(y)) return '—';
  if (y < 1) return `${sig(y * 365.25)} ngày`;
  if (y < 1e3) return `${sig(y)} năm`;
  if (y < 1e6) return `${sig(y / 1e3)} nghìn năm`;
  if (y < 1e9) return `${sig(y / 1e6)} triệu năm`;
  return `${sig(y / 1e9)} tỷ năm`;
}

export function people(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1e3) return num(n);
  if (n < 1e6) return `${sig(n / 1e3)} nghìn`;
  if (n < 1e9) return `${sig(n / 1e6)} triệu`;
  return `${sig(n / 1e9)} tỷ`;
}

export function dateVN(d, withTime = false) {
  const pad = x => String(x).padStart(2, '0');
  const s = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return withTime ? `${s} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC` : s;
}

export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
