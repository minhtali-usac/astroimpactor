// Chất lượng thích ứng: chỉ hạ độ phân giải khi thật sự giật, và luôn nâng lại khi máy hết giật.
//  • Không bao giờ thấp hơn 1 điểm ảnh CSS (min = 1) nên hình luôn sắc nét tối thiểu như bản gốc.
//  • Chỉ hoạt động trên màn hình độ phân giải cao (devicePixelRatio > 1); màn hình thường giữ nguyên.
//  • Hạ khi < ~30 fps; nâng khi ≥ ~50 fps (đạt được trên màn hình 60 Hz); có thời gian chờ để không dao động.
export function adaptiveQuality(renderer, { min = 1, max = Math.min(devicePixelRatio || 1, 2), onChange } = {}) {
  let ratio = max, last = performance.now(), sum = 0, n = 0, good = 0, lockUntil = 0;
  renderer.setPixelRatio(ratio);
  onChange?.(ratio);
  if (max <= min) return { get ratio() { return ratio; } };
  const set = r => {
    r = Math.max(min, Math.min(max, r));
    if (Math.abs(r - ratio) < 0.02) return;
    ratio = r; renderer.setPixelRatio(ratio); onChange?.(ratio);
  };
  const t0 = performance.now();
  (function tick(now) {
    requestAnimationFrame(tick);
    const dt = now - last; last = now;
    if (document.hidden || dt > 1500 || now - t0 < 4000) { sum = n = 0; return; } // bỏ qua 4 s đầu (đang tải ảnh)
    sum += dt; n++;
    if (n < 40 && sum < 1500) return;
    const avg = sum / n; sum = n = 0;
    if (avg > 33) { good = 0; set(ratio * 0.85); lockUntil = now + 8000; }
    else if (avg < 20 && now > lockUntil) { if (++good >= 2) { good = 0; set(ratio * 1.2); } }
    else good = 0;
  })(performance.now());
  return { get ratio() { return ratio; } };
}
