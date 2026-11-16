// Chất lượng thích ứng: tự hạ độ phân giải khi máy yếu, nâng lại khi dư sức.
// Đo thời gian khung hình bằng vòng requestAnimationFrame riêng nên dùng được cho mọi renderer.
export function adaptiveQuality(renderer, { min = 0.7, max = Math.min(devicePixelRatio || 1, 2), onChange } = {}) {
  let ratio = max, last = performance.now(), sum = 0, n = 0, fast = 0;
  renderer.setPixelRatio(ratio);
  onChange?.(ratio);
  const set = r => {
    r = Math.max(min, Math.min(max, r));
    if (Math.abs(r - ratio) < 0.02) return;
    ratio = r; renderer.setPixelRatio(ratio); onChange?.(ratio);
  };
  (function tick(now) {
    requestAnimationFrame(tick);
    const dt = now - last; last = now;
    if (document.hidden || dt > 1500) { sum = n = 0; return; } // tab ẩn hoặc đứng hình do tải trang
    sum += dt; n++;
    if (n < 40 && sum < 1500) return; // đủ 40 khung hình hoặc 1,5 giây
    const avg = sum / n; sum = n = 0;
    if (avg > 26) { fast = 0; set(ratio * 0.8); }              // dưới ~38 fps ⇒ hạ độ phân giải
    else if (avg < 15.5) { if (++fast >= 3) { fast = 0; set(ratio * 1.15); } } // trên ~64 fps, ổn định ⇒ nâng lại
    else fast = 0;
  })(performance.now());
  return { get ratio() { return ratio; } };
}
